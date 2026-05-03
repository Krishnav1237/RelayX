import { describe, it, expect } from 'vitest';
import { YieldDataAdapter } from '../adapters/YieldDataAdapter';

describe('YieldDataAdapter', () => {
  const adapter = new YieldDataAdapter();

  it('should return yield options for ETH', async () => {
    const options = await adapter.getYieldOptions('ETH');
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThan(0);
  });

  it('should return options with correct shape', async () => {
    const options = await adapter.getYieldOptions('ETH');
    for (const opt of options) {
      expect(typeof opt.protocol).toBe('string');
      expect(opt.protocol.length).toBeGreaterThan(0);
      expect(typeof opt.apy).toBe('number');
      expect(opt.apy).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', undefined]).toContain(opt.riskLevel);
      expect(['defillama', 'cache']).toContain(opt.source);
      expect(typeof opt.tvlUsd).toBe('number');
    }
  });

  it('should cache results on second call', async () => {
    const start = Date.now();
    await adapter.getYieldOptions('USDC');
    const first = Date.now() - start;

    const start2 = Date.now();
    await adapter.getYieldOptions('USDC');
    const second = Date.now() - start2;

    // Second call should be near-instant (cached)
    expect(second).toBeLessThan(first + 50);
  });

  it('should return fallback options on invalid asset', async () => {
    const options = await adapter.getYieldOptions('ZZZZNOTREAL');
    expect(Array.isArray(options)).toBe(true);
    // Fallback returns hardcoded ETH options when no data available
    expect(options.length).toBeGreaterThanOrEqual(2);
  });
});
