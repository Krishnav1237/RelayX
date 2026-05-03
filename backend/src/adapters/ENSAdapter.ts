import { createPublicClient, http } from 'viem';
import { normalize } from 'viem/ens';
import { getRelayXChain, getRelayXRpcUrls } from '../config/chain.js';

interface ENSCacheEntry {
  address: string | null;
  records: Record<string, string>;
  timestamp: number;
}

const DEFAULT_ENS_RECORD_KEYS = ['description', 'url', 'com.twitter', 'com.github'] as const;
const DEFAULT_CACHE_DURATION_MS = 5 * 60 * 1000;
const ENS_TIMEOUT_MS = 4000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

export class ENSAdapter {
  private readonly chainConfig = getRelayXChain();
  private readonly rpcEndpoints = getRelayXRpcUrls();
  private readonly cacheDurationMs = readBoundedInteger(
    process.env.ENS_CACHE_TTL_MS,
    DEFAULT_CACHE_DURATION_MS,
    0,
    60 * 60_000
  );
  private readonly recordKeys = getRecordKeys();
  private readonly rpcAttemptTimeoutMs = Math.max(
    1,
    Math.floor(ENS_TIMEOUT_MS / Math.max(1, this.rpcEndpoints.length))
  );
  private readonly rpcClients = this.rpcEndpoints.map((rpc) => ({
    rpc,
    client: createPublicClient({ chain: this.chainConfig.chain, transport: http(rpc) }),
  }));

  private cache: Record<string, ENSCacheEntry> = {};
  private addressFetchedAt: Record<string, number> = {};
  private recordsFetchedAt: Record<string, number> = {};

  async resolveName(name: string): Promise<string | null> {
    if (!this.isValidEnsName(name)) return null;

    const cacheKey = this.getCacheKey(name);
    if (!cacheKey) return null;

    const cachedEntry = this.cache[cacheKey];
    if (cachedEntry && this.isFresh(this.addressFetchedAt[cacheKey])) {
      return cachedEntry.address;
    }

    try {
      const address = await this.withRpcFallback<string | null>(cacheKey, 'resolveName', (client) =>
        client.getEnsAddress({ name: cacheKey })
      );

      this.cache[cacheKey] = {
        address: address ?? null,
        records: cachedEntry?.records ?? {},
        timestamp: Date.now(),
      };
      this.addressFetchedAt[cacheKey] = Date.now();
      return address ?? null;
    } catch (error) {
      console.error(
        `[ENS] resolveName failed: ${cacheKey}`,
        error instanceof Error ? error.message : error
      );
      this.cache[cacheKey] = {
        address: null,
        records: cachedEntry?.records ?? {},
        timestamp: Date.now(),
      };
      this.addressFetchedAt[cacheKey] = Date.now();
      return null;
    }
  }

  async getTextRecords(name: string): Promise<Record<string, string>> {
    if (!this.isValidEnsName(name)) return {};

    const cacheKey = this.getCacheKey(name);
    if (!cacheKey) return {};

    const cachedEntry = this.cache[cacheKey];
    if (cachedEntry && this.isFresh(this.recordsFetchedAt[cacheKey])) {
      return { ...cachedEntry.records };
    }

    const records: Record<string, string> = {};
    const recordEntries = await Promise.all(
      this.recordKeys.map(async (key) => {
        try {
          const value = await this.withRpcFallback<string | null>(
            cacheKey,
            `getTextRecords(${key})`,
            (client) => client.getEnsText({ name: cacheKey, key })
          );
          return [key, value] as const;
        } catch {
          return [key, null] as const;
        }
      })
    );

    for (const [key, value] of recordEntries) {
      if (typeof value === 'string' && value.trim().length > 0) {
        records[key] = value;
      }
    }

    this.cache[cacheKey] = {
      address: cachedEntry?.address ?? null,
      records,
      timestamp: Date.now(),
    };
    this.recordsFetchedAt[cacheKey] = Date.now();
    return { ...records };
  }

  private getCacheKey(name: string): string {
    try {
      return normalize(name.trim().toLowerCase());
    } catch {
      return '';
    }
  }

  private isValidEnsName(name: unknown): name is string {
    return typeof name === 'string' && name.includes('.eth');
  }

  private isFresh(timestamp: number | undefined): boolean {
    if (timestamp === undefined) return false;
    return Date.now() - timestamp < this.cacheDurationMs;
  }

  private async withRpcFallback<T>(
    name: string,
    label: string,
    fn: (client: ReturnType<typeof createPublicClient>) => Promise<T>
  ): Promise<T | null> {
    const clientsToTry = this.rpcClients;

    for (let index = 0; index < clientsToTry.length; index++) {
      const { rpc, client } = clientsToTry[index]!;
      try {
        return await withTimeout(
          fn(client),
          this.rpcAttemptTimeoutMs,
          `${label}(${name}) via ${rpc}`
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('timeout')) {
          console.error(`[ENS] timeout: ${label} ${name}`);
        } else {
          console.error(`[ENS] error: ${name} ${msg.split('\n')[0]}`);
        }
      }
    }
    return null;
  }
}

function getRecordKeys(): string[] {
  const configured = process.env.ENS_TEXT_RECORD_KEYS?.split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  return configured && configured.length > 0 ? [...new Set(configured)] : [...DEFAULT_ENS_RECORD_KEYS];
}

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
