import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

interface ENSCacheEntry {
  address: string | null;
  records: Record<string, string>;
  timestamp: number;
}

const ENS_RECORD_KEYS = ['role', 'description', 'version', 'success_rate', 'reputation'] as const;
const CACHE_DURATION_MS = 5 * 60 * 1000;

export class ENSAdapter {
  private readonly client = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  private cache: Record<string, ENSCacheEntry> = {};

  async resolveName(name: string): Promise<string | null> {
    const cachedEntry = await this.getOrFetch(name);
    return cachedEntry.address;
  }

  async getTextRecords(name: string): Promise<Record<string, string>> {
    const cachedEntry = await this.getOrFetch(name);
    return { ...cachedEntry.records };
  }

  private getCacheKey(name: string): string {
    return name.trim().toLowerCase();
  }

  private isCacheFresh(entry: ENSCacheEntry): boolean {
    return Date.now() - entry.timestamp < CACHE_DURATION_MS;
  }

  private async getOrFetch(name: string): Promise<ENSCacheEntry> {
    const key = this.getCacheKey(name);

    if (!key) {
      return {
        address: null,
        records: {},
        timestamp: Date.now(),
      };
    }

    const cachedEntry = this.cache[key];
    if (cachedEntry && this.isCacheFresh(cachedEntry)) {
      return cachedEntry;
    }

    const freshEntry = await this.fetchAndCache(key);
    this.cache[key] = freshEntry;
    return freshEntry;
  }

  private async fetchAndCache(name: string): Promise<ENSCacheEntry> {
    let address: string | null = null;
    const records: Record<string, string> = {};

    try {
      address = await this.client.getEnsAddress({ name });
    } catch {
      address = null;
    }

    for (const key of ENS_RECORD_KEYS) {
      try {
        const value = await this.client.getEnsText({ name, key });
        if (typeof value === 'string' && value.trim().length > 0) {
          records[key] = value;
        }
      } catch {
        // Ignore missing/unsupported text records.
      }
    }

    return {
      address,
      records,
      timestamp: Date.now(),
    };
  }
}
