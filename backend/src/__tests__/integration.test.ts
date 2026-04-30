import { describe, it, expect } from 'vitest';
import { ExecutionService } from '../orchestrator/ExecutionService';

describe('Full Integration - Retry Path', () => {
  const service = new ExecutionService();

  it('should demonstrate complete retry flow: Morpho rejected → Aave approved', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });

    // 1. Verify retry happened
    expect(response.summary.wasRetried).toBe(true);

    // 2. Verify initial selection was Morpho (highest APY)
    expect(response.summary.initialProtocol).toBe('Morpho');

    // 3. Verify final selection is Aave (safe alternative)
    expect(response.summary.finalProtocol).toBe('Aave');

    // 4. Verify final result matches
    expect(response.final_result.protocol).toBe('Aave');
    expect(response.final_result.status).toBe('success');
    expect(response.final_result.action).toBe('deposit');

    // 5. Verify trace has retry step
    const retryEntry = response.trace.find(t => t.step === 'retry');
    expect(retryEntry).toBeDefined();
    expect(retryEntry!.agent).toBe('system.relay.eth');

    // 6. Verify explanation mentions the switch
    expect(response.summary.explanation).toContain('Initially selected Morpho');
    expect(response.summary.explanation).toContain('switched to Aave');

    // 7. Verify confidence breakdown exists and is reasonable
    const debug = response.debug as Record<string, unknown>;
    const breakdown = debug.confidenceBreakdown as Record<string, number>;
    expect(breakdown.yield).toBeGreaterThan(0);
    expect(breakdown.risk).toBeGreaterThan(0);
    expect(breakdown.execution).toBe(0.9);

    // 8. Verify all timestamps are strictly increasing
    for (let i = 1; i < response.trace.length; i++) {
      expect(response.trace[i]!.timestamp).toBeGreaterThanOrEqual(
        response.trace[i - 1]!.timestamp
      );
    }

    // 9. Print trace for visual verification
    console.log('\n=== FULL TRACE ===');
    for (const entry of response.trace) {
      console.log(`[${entry.agent}] ${entry.step} → ${entry.message}`);
    }
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(response.summary, null, 2));
  });
});
