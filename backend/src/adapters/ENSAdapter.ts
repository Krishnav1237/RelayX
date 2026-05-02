import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

interface ENSCacheEntry {
  address: string | null;
  records: Record<string, string>;
  timestamp: number;
}

const PUBLIC_RPC_ENDPOINTS = ['https://rpc.ankr.com/eth'] as const;
const RPC_ENDPOINTS = [process.env.ALCHEMY_MAINNET_RPC_URL, ...PUBLIC_RPC_ENDPOINTS].filter(
  (rpc): rpc is string => typeof rpc === 'string' && rpc.trim().length > 0
);
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
    client: createPublicClient({ chain: mainnet, transport: http(rpc) }),
  }));

  private readonly client = this.rpcClients[0]!.client;
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
      ENS_RECORD_KEYS.map(async (key) => {
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
    return name.trim().toLowerCase();
  }

  private isValidEnsName(name: unknown): name is string {
    return typeof name === 'string' && name.includes('.eth');
  }

  private isFresh(timestamp: number | undefined): boolean {
    if (timestamp === undefined) return false;
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
