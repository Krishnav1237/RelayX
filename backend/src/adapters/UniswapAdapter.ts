import { UniswapQuoteResult } from '../types';

const UNISWAP_API_URL = 'https://api.uniswap.org/v1/quote';
const COINGECKO_SIMPLE_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price';
const UNISWAP_TIMEOUT_MS = 3000;
const COINGECKO_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 30_000;

interface TokenMetadata {
  address: string;
  coingeckoId: string;
  decimals: number;
}

const TOKEN_METADATA: Record<string, TokenMetadata> = {
  WETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    coingeckoId: 'weth',
    decimals: 18,
  },
  ETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    coingeckoId: 'ethereum',
    decimals: 18,
  },
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    coingeckoId: 'usd-coin',
    decimals: 6,
  },
  USDT: {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    coingeckoId: 'tether',
    decimals: 6,
  },
  DAI: {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    coingeckoId: 'dai',
    decimals: 18,
  },
  WBTC: {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    coingeckoId: 'wrapped-bitcoin',
    decimals: 8,
  },
};

interface QuoteParams {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  chainId?: number;
}

interface CacheEntry {
  quote: UniswapQuoteResult;
  timestamp: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class UniswapAdapter {
  private cache = new Map<string, CacheEntry>();

  async getQuote(params: QuoteParams): Promise<UniswapQuoteResult | null> {
    const normalizedParams = {
      ...params,
      tokenIn: params.tokenIn.trim().toUpperCase(),
      tokenOut: params.tokenOut.trim().toUpperCase(),
    };
    const cacheKey = `${normalizedParams.tokenIn}-${normalizedParams.tokenOut}-${normalizedParams.amount}-${normalizedParams.chainId ?? 1}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.quote, source: 'cache' };
    }

    const uniswapQuote = await this.fetchUniswapQuote(normalizedParams);
    if (uniswapQuote) {
      this.cache.set(cacheKey, { quote: uniswapQuote, timestamp: Date.now() });
      return uniswapQuote;
    }

    const marketQuote = await this.fetchCoinGeckoQuote(normalizedParams);
    if (marketQuote) {
      this.cache.set(cacheKey, { quote: marketQuote, timestamp: Date.now() });
      return marketQuote;
    }

    if (cached) return { ...cached.quote, source: 'cache' };
    return null;
  }

  private async fetchUniswapQuote(params: QuoteParams): Promise<UniswapQuoteResult | null> {
    const apiKey = process.env.UNISWAP_API_KEY;
    if (!apiKey) return null;

    const tokenIn = TOKEN_METADATA[params.tokenIn];
    const tokenOut = TOKEN_METADATA[params.tokenOut];
    if (!tokenIn || !tokenOut) {
      console.warn(`[UNISWAP] Unknown token: ${params.tokenIn} or ${params.tokenOut}`);
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UNISWAP_TIMEOUT_MS);

    try {
      const response = await fetch(UNISWAP_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          tokenInChainId: params.chainId ?? 1,
          tokenOutChainId: params.chainId ?? 1,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amount: params.amount,
          type: 'EXACT_INPUT',
          configs: [{ routingType: 'CLASSIC', protocols: ['V3'] }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`[UNISWAP] API HTTP ${response.status}`);
        return null;
      }

      const data: unknown = await response.json();
      return this.parseUniswapQuoteResponse(data, params, tokenOut);
    } catch (error) {
      console.error('[UNISWAP] API call failed:', error instanceof Error ? error.message : error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchCoinGeckoQuote(params: QuoteParams): Promise<UniswapQuoteResult | null> {
    const tokenIn = TOKEN_METADATA[params.tokenIn];
    const tokenOut = TOKEN_METADATA[params.tokenOut];
    if (!tokenIn || !tokenOut) return null;

    const amountIn = this.baseUnitsToNumber(params.amount, tokenIn.decimals);
    if (amountIn === null || amountIn <= 0) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COINGECKO_TIMEOUT_MS);

    try {
      const ids = `${tokenIn.coingeckoId},${tokenOut.coingeckoId}`;
      const url = `${COINGECKO_SIMPLE_PRICE_URL}?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_last_updated_at=true`;
      const headers: Record<string, string> = {};
      if (process.env.COINGECKO_API_KEY) {
        headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
      }

      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) {
        console.error(`[COINGECKO] API HTTP ${response.status}`);
        return null;
      }

      const body: unknown = await response.json();
      if (!isRecord(body)) return null;

      const inputPrice = this.getUsdPrice(body, tokenIn.coingeckoId);
      const outputPrice = this.getUsdPrice(body, tokenOut.coingeckoId);
      if (inputPrice === null || outputPrice === null || outputPrice <= 0) return null;

      const amountOut = (amountIn * inputPrice) / outputPrice;
      const lastUpdatedAt = Math.min(
        this.getLastUpdatedAt(body, tokenIn.coingeckoId) ?? Number.MAX_SAFE_INTEGER,
        this.getLastUpdatedAt(body, tokenOut.coingeckoId) ?? Number.MAX_SAFE_INTEGER
      );

      return {
        amountOut: this.formatDecimal(amountOut),
        priceImpact: 0,
        gasEstimate: '0',
        route: `CoinGecko spot ${params.tokenIn} -> ${params.tokenOut}`,
        source: 'coingecko',
        lastUpdatedAt: lastUpdatedAt === Number.MAX_SAFE_INTEGER ? undefined : lastUpdatedAt,
      };
    } catch (error) {
      console.error('[COINGECKO] API call failed:', error instanceof Error ? error.message : error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseUniswapQuoteResponse(
    data: unknown,
    params: QuoteParams,
    tokenOut: TokenMetadata
  ): UniswapQuoteResult | null {
    if (!isRecord(data)) return null;

    const quote = isRecord(data.quote) ? data.quote : data;
    const decimalAmount =
      this.readString(quote, ['quoteDecimals']) ??
      this.readString(quote, ['amountOutReadable']) ??
      this.readString(quote, ['output', 'amountReadable']);
    const rawAmount =
      this.readString(quote, ['amountOut']) ??
      this.readString(quote, ['amount']) ??
      this.readString(quote, ['output', 'amount']);
    const amountOut =
      decimalAmount ?? (rawAmount ? this.formatBaseUnits(rawAmount, tokenOut.decimals) : null);

    if (!amountOut) return null;

    const priceImpact =
      this.readNumber(quote, ['priceImpact']) ??
      this.readNumber(quote, ['priceImpactPercent']) ??
      0;

    const gasEstimate =
      this.readString(quote, ['gasUseEstimate']) ??
      this.readString(quote, ['gasUseEstimateUSD']) ??
      this.readString(quote, ['gasFee']) ??
      '0';

    if (!Number.isFinite(priceImpact)) return null;

    console.log('[UNISWAP] Live quote received');
    return {
      amountOut,
      priceImpact: Math.round(Math.abs(priceImpact) * 100) / 100,
      gasEstimate,
      route: this.extractRoute(data, params),
      source: 'uniswap',
    };
  }

  private extractRoute(data: unknown, params: QuoteParams): string {
    if (!isRecord(data)) return `Uniswap ${params.tokenIn} -> ${params.tokenOut}`;

    if (Array.isArray(data.route)) {
      const legs = data.route.filter(isRecord).map((leg) => {
        const tokenIn =
          isRecord(leg.tokenIn) && typeof leg.tokenIn.symbol === 'string'
            ? leg.tokenIn.symbol
            : '?';
        const tokenOut =
          isRecord(leg.tokenOut) && typeof leg.tokenOut.symbol === 'string'
            ? leg.tokenOut.symbol
            : '?';
        return `${tokenIn} -> ${tokenOut}`;
      });
      if (legs.length > 0) return `${legs.join(' -> ')} via Uniswap`;
    }

    return `Uniswap ${params.tokenIn} -> ${params.tokenOut}`;
  }

  private readString(value: unknown, path: readonly string[]): string | null {
    const found = this.readPath(value, path);
    return typeof found === 'string' && found.length > 0 ? found : null;
  }

  private readNumber(value: unknown, path: readonly string[]): number | null {
    const found = this.readPath(value, path);
    if (typeof found === 'number') return found;
    if (typeof found === 'string') {
      const parsed = Number(found);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readPath(value: unknown, path: readonly string[]): unknown {
    let current: unknown = value;
    for (const key of path) {
      if (!isRecord(current)) return undefined;
      current = current[key];
    }
    return current;
  }

  private getUsdPrice(body: Record<string, unknown>, id: string): number | null {
    const entry = body[id];
    if (!isRecord(entry)) return null;
    return typeof entry.usd === 'number' && Number.isFinite(entry.usd) ? entry.usd : null;
  }

  private getLastUpdatedAt(body: Record<string, unknown>, id: string): number | null {
    const entry = body[id];
    if (!isRecord(entry)) return null;
    return typeof entry.last_updated_at === 'number' && Number.isFinite(entry.last_updated_at)
      ? entry.last_updated_at
      : null;
  }

  private baseUnitsToNumber(amount: string, decimals: number): number | null {
    try {
      const raw = BigInt(amount);
      return Number(raw) / 10 ** decimals;
    } catch {
      const parsed = Number(amount);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  private formatBaseUnits(amount: string, decimals: number): string | null {
    const value = this.baseUnitsToNumber(amount, decimals);
    return value === null ? null : this.formatDecimal(value);
  }

  private formatDecimal(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const maximumFractionDigits = value >= 1000 ? 2 : value >= 1 ? 6 : 8;
    return new Intl.NumberFormat('en-US', {
      useGrouping: false,
      maximumFractionDigits,
    }).format(value);
  }
}
