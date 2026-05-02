import { describe, it, expect } from 'vitest';
import { ExecutionService } from '../orchestrator/ExecutionService';

describe('Full Integration', () => {
  const service = new ExecutionService();

  it('should complete full execution flow with live data', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    // Core response shape
    expect(r.intent).toBe('get best yield on ETH');
    expect(r.trace.length).toBeGreaterThan(0);
    expect(r.final_result).toBeDefined();
    expect(r.final_result.status).toBe('success');
    expect(r.final_result.action).toBe('deposit');
    expect(r.final_result.protocol.length).toBeGreaterThan(0);
    expect(r.summary).toBeDefined();

    // Summary fields
    expect(r.summary.initialProtocol.length).toBeGreaterThan(0);
    expect(r.summary.finalProtocol.length).toBeGreaterThan(0);
    expect(typeof r.summary.wasRetried).toBe('boolean');
    expect(typeof r.summary.confidence).toBe('number');
    expect(r.summary.confidence).toBeGreaterThan(0);
    expect(r.summary.confidence).toBeLessThanOrEqual(1);
    expect(r.summary.explanation.length).toBeGreaterThan(0);

    // Decision impact
    expect(r.summary.decisionImpact).toBeDefined();
    expect(r.summary.decisionImpact.ens.length).toBeGreaterThan(0);
    expect(r.summary.decisionImpact.axl.length).toBeGreaterThan(0);

    // Confidence breakdown
    const debug = r.debug as Record<string, unknown>;
    const breakdown = debug.confidenceBreakdown as Record<string, number>;
    expect(breakdown.yield).toBeGreaterThan(0);
    expect(breakdown.risk).toBeGreaterThan(0);
    expect(breakdown.execution).toBe(0.9);

    // Timestamps strictly increasing
    for (let i = 1; i < r.trace.length; i++) {
      expect(r.trace[i]!.timestamp).toBeGreaterThanOrEqual(r.trace[i - 1]!.timestamp);
    }

    // Only valid agent names
    const validNames = [
      'yield.relay.eth',
      'risk.relay.eth',
      'executor.relay.eth',
      'system.relay.eth',
    ];
    for (const e of r.trace) {
      expect(validNames).toContain(e.agent);
    }

    // Trace starts with system
    expect(r.trace[0]!.agent).toBe('system.relay.eth');
    expect(r.trace[0]!.step).toBe('start');

    // Print trace for visual verification
    console.log('\n=== TRACE ===');
    for (const e of r.trace) console.log(`[${e.agent}] ${e.step} → ${e.message}`);
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(r.summary, null, 2));
  });
});
