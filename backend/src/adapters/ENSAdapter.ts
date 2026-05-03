/**
 * ENSAdapter — Ethereum Name Service resolution on MAINNET ONLY.
 *
 * ENS contracts only exist on Ethereum mainnet. This adapter always uses
 * mainnet RPCs regardless of the execution chain (which may be Sepolia).
 *
 * Primary RPC: ALCHEMY_MAINNET_RPC_URL (from .env)
 * Fallback:    Public Ankr mainnet RPC
 */

import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

interface ENSCacheEntry {
  address: string | null;
  records: Record<string, string>;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const RPC_TIMEOUT_MS = 3000;

export class ENSAdapter {
  private client: ReturnType<typeof createPublicClient> | null = null;
  private cache = new Map<string, ENSCacheEntry>();

  private getClient(): ReturnType<typeof createPublicClient> {
    if (!this.client) {
      const rpcUrl = process.env.ALCHEMY_MAINNET_RPC_URL || 'https://rpc.ankr.com/eth';
      this.client = createPublicClient({
        chain: mainnet,
        transport: http(rpcUrl, { timeout: RPC_TIMEOUT_MS }),
      });
      console.log(`[ENS] Mainnet RPC: ${rpcUrl.includes('alchemy') ? 'Alchemy' : 'public'}`);
    }
    return this.client;
  }

  async resolveName(name: string): Promise<string | null> {
    const key = this.normalize(name);
    if (!key) return null;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.address;
    }

    try {
      const address = await this.getClient().getEnsAddress({ name: key });
      this.cache.set(key, {
        address: address ?? null,
        records: cached?.records ?? {},
        timestamp: Date.now(),
      });
      return address ?? null;
    } catch (err) {
      console.error(`[ENS] resolveName(${key}):`, err instanceof Error ? err.message.split('\n')[0] : err);
      // Cache the failure so we don't retry immediately
      this.cache.set(key, {
        address: null,
        records: cached?.records ?? {},
        timestamp: Date.now(),
      });
      return null;
    }
  }

  async getTextRecords(name: string): Promise<Record<string, string>> {
    const key = this.normalize(name);
    if (!key) return {};

    const cached = this.cache.get(key);
    if (cached && cached.records && Object.keys(cached.records).length > 0 && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.records };
    }

    const recordKeys = ['description', 'url', 'com.twitter', 'com.github'];
    const records: Record<string, string> = {};

    const results = await Promise.allSettled(
      recordKeys.map(async (rk) => {
        const value = await this.getClient().getEnsText({ name: key, key: rk });
        return [rk, value] as const;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const [rk, value] = result.value;
        if (typeof value === 'string' && value.trim().length > 0) {
          records[rk] = value;
        }
      }
    }

    this.cache.set(key, {
      address: cached?.address ?? null,
      records,
      timestamp: Date.now(),
    });

    return records;
  }

  private normalize(name: string): string {
    try {
      return normalize(name.trim().toLowerCase());
    } catch {
      return '';
    }
  }
}
