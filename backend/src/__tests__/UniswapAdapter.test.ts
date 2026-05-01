import { describe, it, expect } from 'vitest';
import { UniswapAdapter } from '../adapters/UniswapAdapter';

describe('UniswapAdapter', () => {
  const adapter = new UniswapAdapter();

  it('should return a quote for ETH→USDC', async () => {
    const quote = await adapter.getQuote({
      tokenIn: 'ETH',
      tokenOut: 'USDC',
      amount: '1000000000000000000',
    });

    expect(quote).not.toBeNull();
    expect(quote!.amountOut.length).toBeGreaterThan(0);
    expect(typeof quote!.priceImpact).toBe('number');
    expect(quote!.priceImpact).toBeGreaterThanOrEqual(0);
    expect(quote!.gasEstimate.length).toBeGreaterThan(0);
    expect(quote!.route.length).toBeGreaterThan(0);
    expect(['uniswap', 'coingecko', 'cache']).toContain(quote!.source);
  });

  it('should return a quote for WETH→DAI', async () => {
    const quote = await adapter.getQuote({
      tokenIn: 'WETH',
      tokenOut: 'DAI',
      amount: '1000000000000000000',
    });

    expect(quote).not.toBeNull();
    expect(quote!.amountOut.length).toBeGreaterThan(0);
  });

  it('should cache results on second call', async () => {
    const q1 = await adapter.getQuote({ tokenIn: 'ETH', tokenOut: 'USDC', amount: '1000000000000000000' });
    const q2 = await adapter.getQuote({ tokenIn: 'ETH', tokenOut: 'USDC', amount: '1000000000000000000' });

    expect(q1).not.toBeNull();
    expect(q2).not.toBeNull();
    // Cached result should be identical
    expect(q1!.amountOut).toBe(q2!.amountOut);
  });

  it('should return null for unknown token pairs', async () => {
    const quote = await adapter.getQuote({
      tokenIn: 'ZZZZZ',
      tokenOut: 'YYYYY',
      amount: '1000',
    });

    expect(quote).toBeNull();
  });

  it('should have valid price impact (0-100)', async () => {
    const quote = await adapter.getQuote({
      tokenIn: 'ETH',
      tokenOut: 'USDC',
      amount: '1000000000000000000',
    });

    expect(quote).not.toBeNull();
    expect(quote!.priceImpact).toBeGreaterThanOrEqual(0);
    expect(quote!.priceImpact).toBeLessThanOrEqual(100);
  });
});
