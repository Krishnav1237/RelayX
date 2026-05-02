import { YieldOption } from '../types';

const DEFILLAMA_URL = 'https://yields.llama.fi/pools';
const FETCH_TIMEOUT_MS = 8000;
const FRESH_CACHE_TTL_MS = 60_000;
const STALE_CACHE_TTL_MS = 10 * 60_000;

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

const ASSET_SYNONYMS: Record<string, readonly string[]> = {
  ETH: ['ETH', 'WETH'],
  WETH: ['WETH', 'ETH'],
  USDC: ['USDC'],
  USDT: ['USDT'],
  DAI: ['DAI'],
  WBTC: ['WBTC', 'BTC'],
  STETH: ['STETH', 'WSTETH'],
};

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
    if (!key) return [];

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < FRESH_CACHE_TTL_MS) {
      return this.withSource(cached.options, 'cache');
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

    if (cached && Date.now() - cached.timestamp < STALE_CACHE_TTL_MS) {
      return this.withSource(cached.options, 'cache');
    }

    return [];
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

    for (const pool of pools) {
      if (!isRecord(pool)) continue;

      const symbol = typeof pool.symbol === 'string' ? pool.symbol : '';
      const chain = typeof pool.chain === 'string' ? pool.chain : '';
      const project = typeof pool.project === 'string' ? pool.project : '';
      const apy = typeof pool.apy === 'number' ? pool.apy : 0;
      const tvlUsd = typeof pool.tvlUsd === 'number' ? pool.tvlUsd : 0;
      const poolId = typeof pool.pool === 'string' ? pool.pool : undefined;

      if (!project.trim()) continue;
      if (!this.symbolMatchesAsset(symbol, asset)) continue;
      if (chain !== 'Ethereum') continue;
      if (tvlUsd < 1_000_000) continue;
      if (apy <= 0 || apy > 50) continue;

      const protocolKey = project.toLowerCase();
      const riskLevel = PROTOCOL_RISK_MAP[protocolKey] ?? 'medium';
      const protocolName = this.formatProtocolName(project);

      const existing = seen.get(protocolKey);
      if (!existing || apy > existing.apy) {
        seen.set(protocolKey, {
          protocol: protocolName,
          apy: Math.round(apy * 100) / 100,
          riskLevel,
          chain,
          poolId,
          source: 'defillama',
          tvlUsd: Math.round(tvlUsd),
        });
      }
    }

    return [...seen.values()]
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 5);
  }

  private symbolMatchesAsset(symbol: string, asset: string): boolean {
    const assetUpper = asset.toUpperCase();
    const acceptedSymbols = ASSET_SYNONYMS[assetUpper] ?? [assetUpper];
    const symbolParts = symbol
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(part => part.length > 0);

    return acceptedSymbols.some(accepted => symbolParts.includes(accepted));
  }

  private withSource(options: YieldOption[], source: 'cache'): YieldOption[] {
    return options.map(option => ({ ...option, source }));
  }

  private formatProtocolName(raw: string): string {
    return raw
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
