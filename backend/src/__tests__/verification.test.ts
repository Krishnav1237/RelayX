import { describe, it, expect } from 'vitest';
import { ExecutionService } from '../orchestrator/ExecutionService';

describe('Verification Scenarios', () => {
  const service = new ExecutionService();

  it('BASELINE: live yield, ENS, full trace', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    expect(r.final_result.status).toBe('success');
    expect(r.final_result.apy).toContain('%');
    expect(r.trace.length).toBeGreaterThanOrEqual(8);
    expect(r.summary.explanation.length).toBeGreaterThan(10);
    expect(r.summary.decisionImpact.ens.length).toBeGreaterThan(0);
    expect(r.summary.decisionImpact.axl.length).toBeGreaterThan(0);

    // All 4 agents must appear
    const agents = new Set(r.trace.map((t) => t.agent));
    expect(agents.has('system.relay.eth')).toBe(true);
    expect(agents.has('yield.relay.eth')).toBe(true);
    expect(agents.has('risk.relay.eth')).toBe(true);
    expect(agents.has('executor.relay.eth')).toBe(true);
  });

  it('NO AXL: still works, clean trace', async () => {
    // AXL nodes are down in test env
    const r = await service.execute({ intent: 'get best yield on ETH' });

    const axlTrace = r.trace.find((t) => t.message.includes('AXL'));
    expect(axlTrace).toBeDefined();
    expect(r.final_result.status).toBe('success');
  });

  it('STRONG ENS: vitalik.eth context', async () => {
    const r = await service.execute({
      intent: 'get best yield on ETH',
      context: { ens: 'vitalik.eth' },
    });

    expect(r.final_result.status).toBe('success');
    const debug = r.debug as Record<string, unknown>;
    expect(typeof debug.ensReputationScore).toBe('number');
  });

  it('NO ENS CONTEXT: neutral, no penalties', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    expect(r.final_result.status).toBe('success');
    // Should not have weak ENS penalties
    const debug = r.debug as Record<string, unknown>;
    const ensScore = debug.ensReputationScore as number;
    expect(ensScore).toBeGreaterThanOrEqual(0.5);
  });

  it('LIVE DATA: retry path when top yield fails risk review', async () => {
    const r = await service.execute({
      intent: 'get best yield on ETH',
    });

    expect(r.summary.wasRetried).toBe(true);
    expect(r.summary.initialProtocol).toBe('Morpho');
    expect(r.summary.finalProtocol).not.toBe('Morpho');
    expect(r.summary.explanation).toContain('Initially selected');
    expect(r.summary.explanation).toContain('switched to');
  });

  it('OUTPUT CONTRACT: all required fields present', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    // final_result
    expect(typeof r.final_result.protocol).toBe('string');
    expect(r.final_result.protocol.length).toBeGreaterThan(0);
    expect(r.final_result.apy).toMatch(/%$/);
    expect(['success', 'failed']).toContain(r.final_result.status);

    // summary
    expect(r.summary.selectedProtocol.length).toBeGreaterThan(0);
    expect(r.summary.initialProtocol.length).toBeGreaterThan(0);
    expect(r.summary.finalProtocol.length).toBeGreaterThan(0);
    expect(typeof r.summary.wasRetried).toBe('boolean');
    expect(r.summary.confidence).toBeGreaterThan(0);
    expect(r.summary.confidence).toBeLessThanOrEqual(0.95);
    expect(r.summary.explanation.length).toBeGreaterThan(10);
    expect(r.summary.decisionImpact.ens.length).toBeGreaterThan(0);
    expect(r.summary.decisionImpact.axl.length).toBeGreaterThan(0);

    // trace
    for (const e of r.trace) {
      expect(e.agent.length).toBeGreaterThan(0);
      expect(e.step.length).toBeGreaterThan(0);
      expect(e.message.length).toBeGreaterThan(0);
      expect(e.timestamp).toBeGreaterThan(0);
    }

    // timestamps increasing
    for (let i = 1; i < r.trace.length; i++) {
      expect(r.trace[i]!.timestamp).toBeGreaterThanOrEqual(r.trace[i - 1]!.timestamp);
    }
  });

  it('CONFIDENCE SANITY: breakdown matches summary', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    const debug = r.debug as Record<string, unknown>;
    const breakdown = debug.confidenceBreakdown as Record<string, number>;

    const expected =
      Math.round(
        (((breakdown.yield ?? 0) + (breakdown.risk ?? 0) + (breakdown.execution ?? 0)) / 3) * 100
      ) / 100;
    expect(r.summary.confidence).toBe(expected);

    // All within bounds
    expect(breakdown.yield).toBeGreaterThanOrEqual(0);
    expect(breakdown.yield).toBeLessThanOrEqual(0.95);
    expect(breakdown.risk).toBeGreaterThanOrEqual(0);
    expect(breakdown.risk).toBeLessThanOrEqual(0.95);
    expect(breakdown.execution).toBeLessThanOrEqual(0.95);
  });
});
