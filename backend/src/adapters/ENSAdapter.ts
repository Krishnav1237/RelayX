import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

interface ENSCacheEntry {
  address: string | null;
  records: Record<string, string>;
  timestamp: number;
}

const RPC_ENDPOINTS = ['https://eth-mainnet.g.alchemy.com/v2/pZEHBt4D9N1I1LQumNIFs', 'https://rpc.ankr.com/eth'] as const;
const ENS_RECORD_KEYS = ['description', 'url', 'com.twitter', 'com.github'] as const;
const CACHE_DURATION_MS = 5 * 60 * 1000;
const ENS_TIMEOUT_MS = 2000;
const RPC_ATTEMPT_TIMEOUT_MS = Math.max(1, Math.floor(ENS_TIMEOUT_MS / RPC_ENDPOINTS.length));

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

export class ENSAdapter {
  private readonly rpcClients = RPC_ENDPOINTS.map((rpc) => ({
    rpc,
    client: createPublicClient({
      chain: mainnet,
      transport: http(rpc),
    }),
  }));

  private readonly client = this.rpcClients[0]!.client;

  private cache: Record<string, ENSCacheEntry> = {};
  private addressFetchedAt: Record<string, number> = {};
  private recordsFetchedAt: Record<string, number> = {};

  async resolveName(name: string): Promise<string | null> {
    if (!this.isValidEnsName(name)) {
      console.warn('[ENSAdapter] resolveName skipped: invalid ENS name');
      return null;
    }

    const cacheKey = this.getCacheKey(name);
    console.log(`[ENSAdapter] resolveName start: ${name}`);

    if (!cacheKey) {
      console.warn('[ENSAdapter] resolveName skipped: empty ENS name');
      return null;
    }

    const cachedEntry = this.cache[cacheKey];
    if (cachedEntry && this.isFresh(this.addressFetchedAt[cacheKey])) {
      console.log(`[ENS CACHE HIT] ${cacheKey}`);
      return cachedEntry.address;
    }

    try {
      console.log(`[ENSAdapter] resolveName before viem: ${cacheKey}`);
      const address = await this.withRpcFallback<string | null>(
        cacheKey,
        'resolveName',
        (client) => client.getEnsAddress({ name: cacheKey })
      );
      console.log('[ENS FIX CHECK] address:', cacheKey, address);
      console.log(`[ENSAdapter] resolveName response: ${cacheKey} -> ${address ?? 'null'}`);

      this.cache[cacheKey] = {
        address: address ?? null,
        records: cachedEntry?.records ?? {},
        timestamp: Date.now(),
      };
      this.addressFetchedAt[cacheKey] = Date.now();

      return address ?? null;
    } catch (error) {
      console.error(`[ENSAdapter] resolveName error: ${cacheKey}`);
      console.error(error);

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
    if (!this.isValidEnsName(name)) {
      console.warn('[ENSAdapter] getTextRecords skipped: invalid ENS name');
      return {};
    }

    const cacheKey = this.getCacheKey(name);
    console.log(`[ENSAdapter] getTextRecords start: ${name}`);

    if (!cacheKey) {
      console.warn('[ENSAdapter] getTextRecords skipped: empty ENS name');
      return {};
    }

    const cachedEntry = this.cache[cacheKey];
    if (cachedEntry && this.isFresh(this.recordsFetchedAt[cacheKey])) {
      console.log(`[ENS CACHE HIT] ${cacheKey}`);
      return { ...cachedEntry.records };
    }

    const records: Record<string, string> = {};
    const recordEntries = await Promise.all(
      ENS_RECORD_KEYS.map(async (key) => {
        try {
          console.log(`[ENSAdapter] getTextRecords fetch key: ${cacheKey} -> ${key}`);
          const value = await this.withRpcFallback<string | null>(
            cacheKey,
            `getTextRecords(${key})`,
            (client) => client.getEnsText({ name: cacheKey, key })
          );
          console.log('[ENS FIX CHECK] text:', cacheKey, key, value);
          console.log(`[ENSAdapter] getTextRecords key response: ${cacheKey} -> ${key} = ${value ?? 'null'}`);
          return [key, value] as const;
        } catch (error) {
          console.error(`[ENSAdapter] getTextRecords key error: ${cacheKey} -> ${key}`);
          console.error(error);
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

    console.log(
      `[ENSAdapter] getTextRecords complete: ${cacheKey} keys=${Object.keys(records).join(',') || 'none'}`
    );
    return { ...records };
  }

  private getCacheKey(name: string): string {
    return name.trim().toLowerCase();
  }

  private isValidEnsName(name: unknown): name is string {
    return typeof name === 'string' && name.includes('.eth');
  }

  private isFresh(timestamp: number | undefined): boolean {
    if (timestamp === undefined) {
      return false;
    }
    return Date.now() - timestamp < CACHE_DURATION_MS;
  }

  private async withRpcFallback<T>(
    name: string,
    label: string,
    fn: (client: ReturnType<typeof createPublicClient>) => Promise<T>
  ): Promise<T | null> {
    const clientsToTry = [
      { rpc: RPC_ENDPOINTS[0], client: this.client },
      ...this.rpcClients.slice(1),
    ];

    for (let index = 0; index < clientsToTry.length; index++) {
      const { rpc, client } = clientsToTry[index]!;

      try {
        return await withTimeout(
          fn(client),
          RPC_ATTEMPT_TIMEOUT_MS,
          `${label}(${name}) via ${rpc}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const shortMessage = message.split('\n')[0] ?? message;
        if (message.includes('timeout')) {
          console.error(`[ENS TIMEOUT] ${label} ${name}`);
        } else {
          console.error(`[ENS ERROR] ${name} ${shortMessage}`);
        }

        if (index < clientsToTry.length - 1) {
          console.warn('[ENS FALLBACK] trying next RPC');
        }
      }
    }

    return null;
  }
}
