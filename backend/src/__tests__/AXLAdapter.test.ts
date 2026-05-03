import { describe, it, expect } from 'vitest';
import { AXLAdapter } from '../adapters/AXLAdapter.js';

describe('AXLAdapter', () => {
  const adapter = new AXLAdapter();

  it('should return an array from broadcast (empty when no nodes available)', async () => {
    const responses = await adapter.broadcast({
      type: 'yield_request',
      payload: { intent: 'test' },
    });
    expect(Array.isArray(responses)).toBe(true);
    // No live AXL nodes in test env → empty array
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

  it('should handle broadcast when AXL is down gracefully', async () => {
    const result = await adapter.broadcast({
      type: 'yield_request',
      payload: { data: 'test' },
    });
    expect(Array.isArray(result)).toBe(true);
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

  it('isRealNodeAvailable returns boolean', async () => {
    const result = await adapter.isRealNodeAvailable();
    expect(typeof result).toBe('boolean');
  });

  it('getHealth returns a health object', async () => {
    const health = await adapter.getHealth();
    expect(typeof health.status).toBe('string');
    expect(typeof health.peerCount).toBe('number');
    expect(['real', 'sim', 'offline']).toContain(health.status);
  });
});
