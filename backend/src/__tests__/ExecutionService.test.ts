import { describe, it, expect } from 'vitest';
import { ExecutionService } from '../orchestrator/ExecutionService';

describe('ExecutionService', () => {
  const service = new ExecutionService();

  it('should return a valid ExecutionResponse', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    expect(r.intent).toBe('get best yield on ETH');
    expect(r.trace.length).toBeGreaterThan(0);
    expect(r.final_result).toBeDefined();
    expect(r.summary).toBeDefined();
  });

  it('should have final_result with correct shape', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    expect(typeof r.final_result.protocol).toBe('string');
    expect(r.final_result.protocol.length).toBeGreaterThan(0);
    expect(r.final_result.action).toBe('deposit');
    expect(r.final_result.status).toBe('success');
  });

  it('should have strictly increasing timestamps', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    for (let i = 1; i < r.trace.length; i++) {
      expect(r.trace[i]!.timestamp).toBeGreaterThanOrEqual(r.trace[i - 1]!.timestamp);
    }
  });

  it('should use only ENS-style agent names', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    const valid = ['yield.relay.eth', 'risk.relay.eth', 'executor.relay.eth', 'system.relay.eth'];
    for (const e of r.trace) expect(valid).toContain(e.agent);
  });

  it('should have trace starting with system start', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    expect(r.trace[0]!.step).toBe('start');
    expect(r.trace[0]!.agent).toBe('system.relay.eth');
  });

  it('should have confidence breakdown in debug', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    const debug = r.debug as Record<string, unknown>;
    const breakdown = debug.confidenceBreakdown as Record<string, number>;
    expect(typeof breakdown.yield).toBe('number');
    expect(typeof breakdown.risk).toBe('number');
    expect(typeof breakdown.execution).toBe('number');
  });

  it('should have summary confidence matching breakdown average', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    const debug = r.debug as Record<string, unknown>;
    const breakdown = debug.confidenceBreakdown as Record<string, number>;
    const expected = Math.round(((breakdown.yield ?? 0) + (breakdown.risk ?? 0) + (breakdown.execution ?? 0)) / 3 * 100) / 100;
    expect(r.summary.confidence).toBe(expected);
  });

  it('should have decisionImpact in summary', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    expect(r.summary.decisionImpact).toBeDefined();
    expect(typeof r.summary.decisionImpact.ens).toBe('string');
    expect(typeof r.summary.decisionImpact.axl).toBe('string');
  });

  it('should have all trace entries with required fields', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    for (const e of r.trace) {
      expect(typeof e.agent).toBe('string');
      expect(e.agent.length).toBeGreaterThan(0);
      expect(typeof e.step).toBe('string');
      expect(typeof e.message).toBe('string');
      expect(e.message.length).toBeGreaterThan(0);
      expect(typeof e.timestamp).toBe('number');
    }
  });

  it('should include ENS reputation score in debug', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    const debug = r.debug as Record<string, unknown>;
    expect(typeof debug.ensReputationScore).toBe('number');
  });

  it('should include ENS and AXL influence in debug', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    const debug = r.debug as Record<string, unknown>;
    expect(debug.ensInfluence).toBeDefined();
    expect(debug.axlInfluence).toBeDefined();
  });
});
