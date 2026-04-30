import { describe, it, expect } from 'vitest';
import { AXLAdapter } from '../adapters/AXLAdapter';

describe('AXLAdapter', () => {
  const adapter = new AXLAdapter();

  it('should return an array from broadcast (empty when no nodes available)', async () => {
    const responses = await adapter.broadcast({
      type: 'yield_request',
      payload: { intent: 'test' },
    });
    expect(Array.isArray(responses)).toBe(true);
    // No live AXL nodes in test env → empty array (no simulated data)
  });

  it('should not crash on broadcast with risk_request', async () => {
    const responses = await adapter.broadcast({
      type: 'risk_request',
      payload: { protocol: 'Aave', apy: 4.2, riskLevel: 'low' },
    });
    expect(Array.isArray(responses)).toBe(true);
  });

  it('should not crash on broadcast with execution_signal', async () => {
    const responses = await adapter.broadcast({
      type: 'execution_signal',
      payload: { protocol: 'Aave', status: 'success' },
    });
    expect(Array.isArray(responses)).toBe(true);
  });

  it('should not crash on sendMessage when AXL is down', async () => {
    const result = await adapter.sendMessage('test-target', { data: 'test' });
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should handle malformed broadcast payload gracefully', async () => {
    const responses = await adapter.broadcast({ invalid: true });
    expect(Array.isArray(responses)).toBe(true);
  });

  it('should return empty array not undefined', async () => {
    const responses = await adapter.broadcast({
      type: 'yield_request',
      payload: {},
    });
    expect(responses).not.toBeUndefined();
    expect(responses).not.toBeNull();
    expect(Array.isArray(responses)).toBe(true);
  });
});
