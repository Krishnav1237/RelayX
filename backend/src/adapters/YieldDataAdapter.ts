import { YieldOption } from '../types';

const DEFILLAMA_URL = 'https://yields.llama.fi/pools';
const FETCH_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 60_000;

const PROTOCOL_RISK_MAP: Record<string, YieldOption['riskLevel']> = {
  'aave': 'low',
  'aave-v3': 'low',
  'aave-v2': 'low',
  'compound': 'low',
  'compound-v3': 'low',
  'compound-v2': 'low',
  'morpho': 'medium',
  'morpho-blue': 'medium',
  'spark': 'low',
  'yearn': 'medium',
  'lido': 'low',
  'rocket-pool': 'low',
  'maker': 'low',
  'convex-finance': 'medium',
  'curve-dex': 'medium',
};

const FALLBACK_OPTIONS: YieldOption[] = [
  { protocol: 'Aave', apy: 4.2, riskLevel: 'low' },
  { protocol: 'Compound', apy: 3.8, riskLevel: 'low' },
];

interface CacheEntry {
  options: YieldOption[];
  timestamp: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class YieldDataAdapter {
  private cache = new Map<string, CacheEntry>();

  async getYieldOptions(asset: string): Promise<YieldOption[]> {
    const key = asset.trim().toUpperCase();

    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.options;
    }

    try {
      const options = await this.fetchFromDefiLlama(key);
      if (options.length > 0) {
        this.cache.set(key, { options, timestamp: Date.now() });
        return options;
      }
    } catch (error) {
      console.error('[YieldDataAdapter] DefiLlama fetch failed:', error instanceof Error ? error.message : error);
    }

    // Return cached if available, otherwise fallback
    if (cached) return cached.options;
    return [...FALLBACK_OPTIONS];
  }

  private async fetchFromDefiLlama(asset: string): Promise<YieldOption[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(DEFILLAMA_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`DefiLlama HTTP ${response.status}`);

      const body: unknown = await response.json();
      if (!isRecord(body) || !Array.isArray(body.data)) return [];

      return this.parseDefiLlamaPools(body.data as unknown[], asset);
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseDefiLlamaPools(pools: unknown[], asset: string): YieldOption[] {
    const seen = new Map<string, YieldOption>();
    const assetUpper = asset.toUpperCase();

    for (const pool of pools) {
      if (!isRecord(pool)) continue;

      const symbol = typeof pool.symbol === 'string' ? pool.symbol.toUpperCase() : '';
      const chain = typeof pool.chain === 'string' ? pool.chain : '';
      const project = typeof pool.project === 'string' ? pool.project : '';
      const apy = typeof pool.apy === 'number' ? pool.apy : 0;
      const tvlUsd = typeof pool.tvlUsd === 'number' ? pool.tvlUsd : 0;

      // Filter: must contain the asset, be on Ethereum, have meaningful TVL
      if (!symbol.includes(assetUpper)) continue;
      if (chain !== 'Ethereum') continue;
      if (tvlUsd < 1_000_000) continue;
      if (apy <= 0 || apy > 50) continue;

      const protocolKey = project.toLowerCase();
      const riskLevel = PROTOCOL_RISK_MAP[protocolKey] ?? 'medium';
      const protocolName = this.formatProtocolName(project);

      // Keep highest APY per protocol
      const existing = seen.get(protocolKey);
      if (!existing || apy > existing.apy) {
        seen.set(protocolKey, {
          protocol: protocolName,
          apy: Math.round(apy * 100) / 100,
          riskLevel,
        });
      }
    }

    // Sort by APY descending, take top 5
    return [...seen.values()]
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 5);
  }

  private formatProtocolName(raw: string): string {
    return raw
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
