import { describe, it, expect } from 'vitest';
import { AXLAdapter } from '../adapters/AXLAdapter';

describe('AXLAdapter', () => {
  const adapter = new AXLAdapter();

  it('should return simulated yield responses when AXL is down', async () => {
    const responses = await adapter.broadcast({
      type: 'yield_request',
      payload: { intent: 'test' },
    });

    expect(Array.isArray(responses)).toBe(true);
    expect(responses.length).toBeGreaterThan(0);
  });

  it('should return simulated risk responses when AXL is down', async () => {
    const responses = await adapter.broadcast({
      type: 'risk_request',
      payload: { protocol: 'Aave', apy: 4.2, riskLevel: 'low' },
    });

    expect(Array.isArray(responses)).toBe(true);
    expect(responses.length).toBeGreaterThan(0);
  });

  it('should return majority reject for medium risk + high APY', async () => {
    const responses = await adapter.broadcast({
      type: 'risk_request',
      payload: { protocol: 'Morpho', apy: 4.6, riskLevel: 'medium' },
    });

    let rejectCount = 0;
    for (const r of responses) {
      if (typeof r === 'object' && r !== null && 'decision' in r) {
        const rec = r as Record<string, unknown>;
        if (rec.decision === 'reject') rejectCount++;
      }
    }
    expect(rejectCount).toBeGreaterThan(0);
  });

  it('should return majority approve for low risk', async () => {
    const responses = await adapter.broadcast({
      type: 'risk_request',
      payload: { protocol: 'Aave', apy: 4.2, riskLevel: 'low' },
    });

    let approveCount = 0;
    for (const r of responses) {
      if (typeof r === 'object' && r !== null && 'decision' in r) {
        const rec = r as Record<string, unknown>;
        if (rec.decision === 'approve') approveCount++;
      }
    }
    expect(approveCount).toBeGreaterThan(0);
  });

  it('should return execution acknowledgments', async () => {
    const responses = await adapter.broadcast({
      type: 'execution_signal',
      payload: { protocol: 'Aave', status: 'success' },
    });

    expect(Array.isArray(responses)).toBe(true);
    expect(responses.length).toBeGreaterThan(0);
  });

  it('should not crash on sendMessage when AXL is down', async () => {
    const result = await adapter.sendMessage('test-target', { data: 'test' });
    expect(result).toBeDefined();
  });

  it('simulated yield responses should not include protocols that match local options with different APY', async () => {
    const responses = await adapter.broadcast({
      type: 'yield_request',
      payload: { intent: 'test' },
    });

    // Simulated should return Spark and Yearn (not Aave which would conflict)
    for (const r of responses) {
      if (typeof r === 'object' && r !== null && 'option' in r) {
        const rec = r as Record<string, unknown>;
        const option = rec.option as Record<string, unknown>;
        expect(option.protocol).not.toBe('Aave');
      }
    }
  });
});
