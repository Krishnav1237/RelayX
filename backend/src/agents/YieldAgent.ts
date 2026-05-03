import { BaseAgent } from './BaseAgent.js';
import { AXLMessage, AgentTrace, YieldOption, YieldThinkResult } from '../types/index.js';
import { AXLAdapter } from '../adapters/AXLAdapter.js';
import { YieldDataAdapter } from '../adapters/YieldDataAdapter.js';
import { getAgentEnsName } from '../config/agents.js';

interface ProtocolComparison {
  protocol: string;
  apy: number;
  riskLevel: string;
  tradeOff: string;
}

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class YieldAgent extends BaseAgent {
  private axlAdapter = new AXLAdapter();
  private yieldDataAdapter = new YieldDataAdapter();

  constructor() {
    const agentName = getAgentEnsName('yield');
    super(agentName, agentName);
  }

  async think(
    intent: string,
    attempt: number,
    trace: AgentTrace[],
    timestamp: number,
    externalMetadata?: Record<string, unknown>
  ): Promise<YieldThinkResult & { confidence: number }> {
    let ts = timestamp;

    // Step: analyze intent
    trace.push(
      this.log('analyze', `Analyzing user intent: "${intent}"`, { attempt }, ts, externalMetadata)
    );
    ts += 10;

    // Fetch live yield data, falling back only to cached upstream data.
    const asset = this.extractAsset(intent);
    let liveOptions = await this.yieldDataAdapter.getYieldOptions(asset);

    const isLiveData = liveOptions.some((o) => o.source === 'defillama');
    const sourceLabel = isLiveData
      ? 'DefiLlama live'
      : liveOptions.length > 0
        ? 'cached DefiLlama'
        : 'no DefiLlama data';

    trace.push(
      this.log(
        'analyze',
        `Fetched ${sourceLabel} yield data (${liveOptions.length} protocols)`,
        {
          asset,
          protocols: liveOptions.map((o) => ({
            protocol: o.protocol,
            apy: o.apy,
            source: o.source,
            tvlUsd: o.tvlUsd,
            poolId: o.poolId,
          })),
          isLiveData,
        },
        ts,
        externalMetadata
      )
    );
    ts += 10;

    // Sort by APY descending
    const sortedLocalOptions = [...liveOptions].sort((a, b) => {
      if (b.apy !== a.apy) return b.apy - a.apy;
      return a.protocol.localeCompare(b.protocol);
    });

    // AXL broadcast for peer yield suggestions
    const axlMessage: AXLMessage = {
      from: this.name,
      to: 'axl.network',
      type: 'yield_request',
      payload: { intent, asset },
      timestamp: Date.now(),
    };

    let remoteResponses: unknown[] = [];
    try {
      remoteResponses = await this.axlAdapter.broadcast(axlMessage);
    } catch {
      remoteResponses = [];
    }

    const remoteOptions = this.extractRemoteOptions(remoteResponses);
    const hasAXLPeers = remoteResponses.length > 0;

    // Merge: live data takes priority, AXL adds new protocols only
    const sortedOptions = this.mergeAndSortOptions(sortedLocalOptions, remoteOptions);

    if (sortedOptions.length === 0) {
      throw new Error(
        `No yield data available for ${asset} (DefiLlama and AXL both returned 0 options)`
      );
    }

    const axlLabel = hasAXLPeers
      ? `AXL live peers: received ${remoteOptions.length} external yield strategies`
      : 'AXL: no peers available';
    trace.push(
      this.log(
        'evaluate',
        axlLabel,
        {
          remoteProtocols: remoteOptions.map((o) => o.protocol),
          peersContacted: remoteResponses.length,
        },
        ts,
        externalMetadata
      )
    );
    ts += 10;

    // Build comparison narrative
    const comparisons: ProtocolComparison[] = sortedOptions.map((opt) => ({
      protocol: opt.protocol,
      apy: opt.apy,
      riskLevel: opt.riskLevel ?? 'unknown',
      tradeOff:
        opt.riskLevel === 'low'
          ? 'lower risk, stable yield'
          : opt.riskLevel === 'medium'
            ? 'moderate risk, higher yield potential'
            : 'higher risk, highest yield potential',
    }));

    // Select based on attempt number
    const selectedIndex = Math.min(attempt - 1, sortedOptions.length - 1);
    const selectedOption = sortedOptions[selectedIndex]!;

    // Calculate confidence
    const maxApy = sortedOptions[0]!.apy;
    const minApy = sortedOptions[sortedOptions.length - 1]!.apy;
    const apyGap = maxApy - minApy;

    let baseConfidence = 0.7 + apyGap / 10;
    if (attempt > 1) baseConfidence += 0.05;
    if (isLiveData) baseConfidence += 0.03; // Slight boost for real data
    const confidence = normalizeConfidence(Math.min(0.95, baseConfidence));

    // Build reasoning
    const protocolList = comparisons
      .map((c) => `${c.protocol} (${c.apy}%, ${c.riskLevel} risk)`)
      .join(', ');

    const reasoning =
      attempt === 1
        ? `Compared ${protocolList}. Selected ${selectedOption.protocol} due to highest yield of ${selectedOption.apy}% APY, despite ${selectedOption.riskLevel ?? 'unknown'} risk profile.`
        : `Retry attempt ${attempt}: Selected ${selectedOption.protocol} (${selectedOption.apy}% APY, ${selectedOption.riskLevel ?? 'unknown'} risk) as a safer alternative after initial rejection.`;

    trace.push(
      this.log(
        'evaluate',
        `Evaluating yield strategies across ${sortedOptions.length} protocols`,
        {
          options: sortedOptions.map((o) => ({
            protocol: o.protocol,
            apy: o.apy,
            riskLevel: o.riskLevel,
          })),
          comparisons,
          confidence,
          isLiveData,
        },
        ts,
        externalMetadata
      )
    );
    ts += 10;

    trace.push(
      this.log(
        'evaluate',
        reasoning,
        {
          selectedOption,
          attempt,
          confidence,
        },
        ts,
        externalMetadata
      )
    );

    // LLM explanation removed - now handled at final stage in ExecutionService

    return { options: sortedOptions, selectedOption, reasoning, attempt, confidence };
  }

  private extractAsset(intent: string): string {
    const upper = intent.toUpperCase();
    const configuredTokens = (process.env.YIELD_SUPPORTED_ASSETS ?? '')
      .split(',')
      .map((token) => token.trim().toUpperCase())
      .filter((token) => token.length > 0);
    const tokens = [
      ...new Set(['ETH', 'USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'STETH', ...configuredTokens]),
    ].sort((a, b) => b.length - a.length);
    for (const token of tokens) {
      if (upper.includes(token)) return token;
    }
    return 'ETH';
  }

  private mergeAndSortOptions(
    localOptions: YieldOption[],
    remoteOptions: YieldOption[]
  ): YieldOption[] {
    const mergedByProtocol = new Map<string, YieldOption>();
    for (const option of localOptions) {
      mergedByProtocol.set(option.protocol.trim().toLowerCase(), option);
    }
    for (const option of remoteOptions) {
      const key = option.protocol.trim().toLowerCase();
      if (!mergedByProtocol.has(key)) mergedByProtocol.set(key, option);
    }
    return [...mergedByProtocol.values()].sort((a, b) => {
      if (b.apy !== a.apy) return b.apy - a.apy;
      return a.protocol.localeCompare(b.protocol);
    });
  }

  private extractRemoteOptions(responses: unknown[]): YieldOption[] {
    const extracted: YieldOption[] = [];
    for (const response of responses) {
      if (!isRecord(response)) continue;
      const candidates: unknown[] = [];
      if (response.option) candidates.push(response.option);
      if (Array.isArray(response.options)) candidates.push(...response.options);
      if (isRecord(response.payload)) {
        if (response.payload.option) candidates.push(response.payload.option);
        if (Array.isArray(response.payload.options)) candidates.push(...response.payload.options);
      }
      for (const c of candidates) {
        const parsed = this.parseYieldOption(c);
        if (parsed) extracted.push(parsed);
      }
    }
    return extracted;
  }

  private parseYieldOption(value: unknown): YieldOption | null {
    if (!isRecord(value)) return null;
    if (typeof value.protocol !== 'string' || typeof value.apy !== 'number') return null;
    const protocol = value.protocol.trim();
    if (!protocol) return null;
    if (value.apy <= 0 || value.apy > 50) return null;
    const rl = value.riskLevel;
    const riskLevel = rl === 'low' || rl === 'medium' || rl === 'high' ? rl : undefined;
    return { protocol, apy: value.apy, riskLevel };
  }
}
