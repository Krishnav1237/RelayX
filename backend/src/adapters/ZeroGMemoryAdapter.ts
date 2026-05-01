export interface ExecutionMemory {
  intent: string;
  selectedProtocol: string;
  rejectedProtocol?: string;
  confidence: number;
  outcome: 'success' | 'failed';
  timestamp: number;
}

export interface ProtocolStats {
  protocol: string;
  successRate: number;
  avgConfidence: number;
  executionCount: number;
}

export interface ZeroGMemoryStore {
  readonly enabled: boolean;
  appendExecution(data: ExecutionMemory): Promise<void>;
  getRecentExecutions(limit: number): Promise<ExecutionMemory[]>;
  getProtocolStats(protocol: string): Promise<ProtocolStats | null>;
  setProtocolStats(stats: ProtocolStats): Promise<void>;
}

const DEFAULT_STREAM_ID = 'relayx.execution.memory';
const REQUEST_TIMEOUT_MS = 2500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeProtocol(protocol: string): string {
  return protocol.trim().toLowerCase();
}

function protocolStatsKey(protocol: string): string {
  return `protocol:${normalizeProtocol(protocol)}:stats`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function decodeMaybeBase64(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return value;
  if (trimmed.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) return value;

  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    return /^[\t\n\r -~]*$/.test(decoded) && decoded.length > 0 ? decoded : value;
  } catch {
    return value;
  }
}

function parseExecutionMemory(value: unknown): ExecutionMemory | null {
  if (typeof value === 'string') {
    try {
      return parseExecutionMemory(JSON.parse(decodeMaybeBase64(value)));
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) return null;
  if (typeof value.intent !== 'string') return null;
  if (typeof value.selectedProtocol !== 'string') return null;
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return null;
  if (value.outcome !== 'success' && value.outcome !== 'failed') return null;
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return null;

  return {
    intent: value.intent,
    selectedProtocol: value.selectedProtocol,
    rejectedProtocol: typeof value.rejectedProtocol === 'string' ? value.rejectedProtocol : undefined,
    confidence: clamp01(value.confidence),
    outcome: value.outcome,
    timestamp: value.timestamp,
  };
}

function parseProtocolStats(value: unknown): ProtocolStats | null {
  if (!isRecord(value)) return null;
  if (typeof value.protocol !== 'string') return null;
  if (typeof value.successRate !== 'number' || !Number.isFinite(value.successRate)) return null;
  if (typeof value.avgConfidence !== 'number' || !Number.isFinite(value.avgConfidence)) return null;
  if (typeof value.executionCount !== 'number' || !Number.isInteger(value.executionCount)) return null;

  return {
    protocol: value.protocol,
    successRate: clamp01(value.successRate),
    avgConfidence: clamp01(value.avgConfidence),
    executionCount: Math.max(0, value.executionCount),
  };
}

class DisabledZeroGMemoryStore implements ZeroGMemoryStore {
  readonly enabled = false;

  async appendExecution(_data: ExecutionMemory): Promise<void> {
    return undefined;
  }

  async getRecentExecutions(_limit: number): Promise<ExecutionMemory[]> {
    return [];
  }

  async getProtocolStats(_protocol: string): Promise<ProtocolStats | null> {
    return null;
  }

  async setProtocolStats(_stats: ProtocolStats): Promise<void> {
    return undefined;
  }
}

export class InMemoryZeroGMemoryStore implements ZeroGMemoryStore {
  readonly enabled = true;
  private readonly executions: ExecutionMemory[] = [];
  private readonly stats = new Map<string, ProtocolStats>();

  constructor(seedStats: ProtocolStats[] = [], seedExecutions: ExecutionMemory[] = []) {
    for (const stat of seedStats) {
      this.stats.set(protocolStatsKey(stat.protocol), { ...stat });
    }
    for (const execution of seedExecutions) {
      this.executions.push({ ...execution });
    }
  }

  async appendExecution(data: ExecutionMemory): Promise<void> {
    this.executions.push({ ...data });
  }

  async getRecentExecutions(limit: number): Promise<ExecutionMemory[]> {
    return [...this.executions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Math.max(0, limit))
      .map(execution => ({ ...execution }));
  }

  async getProtocolStats(protocol: string): Promise<ProtocolStats | null> {
    const stats = this.stats.get(protocolStatsKey(protocol));
    return stats ? { ...stats } : null;
  }

  async setProtocolStats(stats: ProtocolStats): Promise<void> {
    this.stats.set(protocolStatsKey(stats.protocol), { ...stats });
  }
}

class HttpZeroGMemoryStore implements ZeroGMemoryStore {
  readonly enabled = true;

  constructor(
    private readonly kvUrl: string,
    private readonly logUrl: string,
    private readonly streamId: string
  ) {}

  async appendExecution(data: ExecutionMemory): Promise<void> {
    await this.postJson(this.logUrl, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'log_append',
      params: [this.streamId, data],
    });
  }

  async getRecentExecutions(limit: number): Promise<ExecutionMemory[]> {
    const response = await this.postJson(this.logUrl, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'log_getRecent',
      params: [this.streamId, Math.max(0, limit)],
    });
    const result = this.unwrapResult(response);
    const items = Array.isArray(result) ? result : isRecord(result) && Array.isArray(result.entries) ? result.entries : [];

    return items
      .map(item => parseExecutionMemory(item))
      .filter((item): item is ExecutionMemory => item !== null);
  }

  async getProtocolStats(protocol: string): Promise<ProtocolStats | null> {
    const key = protocolStatsKey(protocol);
    const response = await this.postJson(this.kvUrl, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'kv_getValue',
      params: [this.streamId, encodeBase64(key)],
    });

    const result = this.unwrapResult(response);
    const rawValue = this.extractValue(result);
    if (!rawValue) return null;

    try {
      return parseProtocolStats(JSON.parse(rawValue));
    } catch {
      return null;
    }
  }

  async setProtocolStats(stats: ProtocolStats): Promise<void> {
    const key = protocolStatsKey(stats.protocol);
    await this.postJson(this.kvUrl, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'kv_setValue',
      params: [this.streamId, encodeBase64(key), encodeBase64(JSON.stringify(stats))],
    });
  }

  private async postJson(url: string, body: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`0G HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private unwrapResult(response: unknown): unknown {
    if (!isRecord(response)) return response;
    if (response.error !== undefined) {
      throw new Error(`0G RPC error: ${JSON.stringify(response.error)}`);
    }
    return response.result ?? response;
  }

  private extractValue(result: unknown): string | null {
    if (typeof result === 'string') return decodeMaybeBase64(result);
    if (!isRecord(result)) return null;

    const value = result.value ?? result.data ?? result.Value;
    if (typeof value === 'string') return decodeMaybeBase64(value);
    if (Array.isArray(value)) return Buffer.from(value).toString('utf8');

    return null;
  }
}

export class ZeroGMemoryAdapter {
  private lastUnavailableReason: string | null = null;

  constructor(private readonly store: ZeroGMemoryStore = ZeroGMemoryAdapter.createDefaultStore()) {}

  static inMemory(seedStats: ProtocolStats[] = [], seedExecutions: ExecutionMemory[] = []): ZeroGMemoryAdapter {
    return new ZeroGMemoryAdapter(new InMemoryZeroGMemoryStore(seedStats, seedExecutions));
  }

  static demo(): ZeroGMemoryAdapter {
    return ZeroGMemoryAdapter.inMemory([
      { protocol: 'Morpho', successRate: 0.42, avgConfidence: 0.55, executionCount: 24 },
      { protocol: 'Aave', successRate: 0.94, avgConfidence: 0.91, executionCount: 50 },
      { protocol: 'Aave V3', successRate: 0.94, avgConfidence: 0.91, executionCount: 50 },
    ]);
  }

  isEnabled(): boolean {
    return this.store.enabled;
  }

  getLastUnavailableReason(): string | null {
    return this.lastUnavailableReason;
  }

  async storeExecution(data: ExecutionMemory): Promise<void> {
    if (!this.store.enabled) {
      this.lastUnavailableReason = '0G memory is not configured';
      return;
    }

    try {
      this.lastUnavailableReason = null;
      const normalized: ExecutionMemory = {
        ...data,
        selectedProtocol: data.selectedProtocol.trim(),
        confidence: clamp01(data.confidence),
      };

      await this.store.appendExecution(normalized);

      const existing = await this.store.getProtocolStats(normalized.selectedProtocol);
      const executionCount = (existing?.executionCount ?? 0) + 1;
      const previousSuccesses = existing ? existing.successRate * existing.executionCount : 0;
      const successes = previousSuccesses + (normalized.outcome === 'success' ? 1 : 0);
      const previousConfidenceTotal = existing ? existing.avgConfidence * existing.executionCount : 0;

      await this.store.setProtocolStats({
        protocol: normalized.selectedProtocol,
        successRate: round(successes / executionCount),
        avgConfidence: round((previousConfidenceTotal + normalized.confidence) / executionCount),
        executionCount,
      });
    } catch (error) {
      this.lastUnavailableReason = error instanceof Error ? error.message : String(error);
    }
  }

  async getRecentExecutions(limit: number): Promise<ExecutionMemory[]> {
    if (!this.store.enabled) {
      this.lastUnavailableReason = '0G memory is not configured';
      return [];
    }

    try {
      this.lastUnavailableReason = null;
      return await this.store.getRecentExecutions(Math.max(0, limit));
    } catch (error) {
      this.lastUnavailableReason = error instanceof Error ? error.message : String(error);
      return [];
    }
  }

  async getProtocolStats(protocol: string): Promise<ProtocolStats | null> {
    if (!this.store.enabled) {
      this.lastUnavailableReason = '0G memory is not configured';
      return null;
    }

    try {
      this.lastUnavailableReason = null;
      return await this.store.getProtocolStats(protocol);
    } catch (error) {
      this.lastUnavailableReason = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  private static createDefaultStore(): ZeroGMemoryStore {
    const kvUrl = process.env.ZEROG_MEMORY_KV_URL;
    const logUrl = process.env.ZEROG_MEMORY_LOG_URL;
    if (!kvUrl || !logUrl) return new DisabledZeroGMemoryStore();

    return new HttpZeroGMemoryStore(kvUrl, logUrl, process.env.ZEROG_MEMORY_STREAM_ID ?? DEFAULT_STREAM_ID);
  }
}
