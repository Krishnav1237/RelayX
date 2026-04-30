import { UniswapQuoteResult } from '../types';

const UNISWAP_API_URL = 'https://api.uniswap.org/v1/quote';
const UNISWAP_TIMEOUT_MS = 2000;
const CACHE_TTL_MS = 30_000;

// Well-known Ethereum mainnet token addresses
const TOKEN_ADDRESSES: Record<string, string> = {
  'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'ETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
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
    const cacheKey = `${params.tokenIn}-${params.tokenOut}-${params.amount}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.quote;
    }

    // Try real API first
    const liveQuote = await this.fetchLiveQuote(params);
    if (liveQuote) {
      this.cache.set(cacheKey, { quote: liveQuote, timestamp: Date.now() });
      return liveQuote;
    }

    // Return cached if available
    if (cached) return cached.quote;

    // Mock fallback — deterministic
    return this.getMockQuote(params);
  }

  private async fetchLiveQuote(params: QuoteParams): Promise<UniswapQuoteResult | null> {
    const tokenInAddress = TOKEN_ADDRESSES[params.tokenIn.toUpperCase()];
    const tokenOutAddress = TOKEN_ADDRESSES[params.tokenOut.toUpperCase()];

    if (!tokenInAddress || !tokenOutAddress) {
      console.warn(`[UNISWAP] Unknown token: ${params.tokenIn} or ${params.tokenOut}`);
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UNISWAP_TIMEOUT_MS);

    try {
      const response = await fetch(UNISWAP_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenInChainId: params.chainId ?? 1,
          tokenOutChainId: params.chainId ?? 1,
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
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
      return this.parseQuoteResponse(data);
    } catch (error) {
      console.error('[UNISWAP] API call failed:', error instanceof Error ? error.message : error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseQuoteResponse(data: unknown): UniswapQuoteResult | null {
    if (!isRecord(data)) return null;

    // Uniswap API returns quote in nested structure
    const quote = isRecord(data.quote) ? data.quote : data;

    const amountOut = typeof quote.amountOut === 'string' ? quote.amountOut
      : typeof quote.quoteDecimals === 'string' ? quote.quoteDecimals
      : typeof quote.amount === 'string' ? quote.amount
      : null;

    if (!amountOut) return null;

    const priceImpact = typeof quote.priceImpact === 'number' ? quote.priceImpact
      : typeof quote.priceImpact === 'string' ? parseFloat(quote.priceImpact)
      : 0;

    const gasEstimate = typeof quote.gasUseEstimate === 'string' ? quote.gasUseEstimate
      : typeof quote.gasUseEstimateUSD === 'string' ? quote.gasUseEstimateUSD
      : '150000';

    if (!Number.isFinite(priceImpact)) return null;

    console.log('[UNISWAP] Live quote received');
    return {
      amountOut,
      priceImpact: Math.round(Math.abs(priceImpact) * 100) / 100,
      gasEstimate,
      route: this.extractRoute(data),
      source: 'live',
    };
  }

  private extractRoute(data: unknown): string {
    if (!isRecord(data)) return 'Uniswap V3';

    // Try to extract route description
    if (Array.isArray(data.route)) {
      const legs = data.route
        .filter(isRecord)
        .map(leg => {
          const tokenIn = isRecord(leg.tokenIn) && typeof leg.tokenIn.symbol === 'string' ? leg.tokenIn.symbol : '?';
          const tokenOut = isRecord(leg.tokenOut) && typeof leg.tokenOut.symbol === 'string' ? leg.tokenOut.symbol : '?';
          return `${tokenIn} → ${tokenOut}`;
        });
      if (legs.length > 0) return legs.join(' → ') + ' via Uniswap V3';
    }

    return 'Uniswap V3';
  }

  private getMockQuote(params: QuoteParams): UniswapQuoteResult {
    // Deterministic mock based on token pair
    const mockAmounts: Record<string, string> = {
      'WETH-USDC': '3200',
      'ETH-USDC': '3200',
      'USDC-WETH': '0.3125',
      'WETH-DAI': '3195',
      'WBTC-USDC': '62000',
    };

    const key = `${params.tokenIn.toUpperCase()}-${params.tokenOut.toUpperCase()}`;
    const amountOut = mockAmounts[key] ?? '1000';

    console.log('[UNISWAP] Using mock quote (API unavailable)');
    return {
      amountOut,
      priceImpact: 0.3,
      gasEstimate: '150000',
      route: `${params.tokenIn} → ${params.tokenOut} via Uniswap V3`,
      source: 'mock',
    };
  }
}
