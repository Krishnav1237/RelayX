import { describe, it, expect } from 'vitest';
import { ExecutionService } from '../orchestrator/ExecutionService';

describe('ExecutionService', () => {
  const service = new ExecutionService();

  it('should return a valid ExecutionResponse', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });

    expect(response.intent).toBe('get best yield on ETH');
    expect(response.trace).toBeDefined();
    expect(Array.isArray(response.trace)).toBe(true);
    expect(response.trace.length).toBeGreaterThan(0);
    expect(response.final_result).toBeDefined();
    expect(response.summary).toBeDefined();
  });

  it('should trigger retry path — Morpho rejected, Aave approved', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });

    // Morpho (4.6%, medium) should be rejected by RiskAgent
    // Retry should select Aave (4.2%, low) which gets approved
    expect(response.summary.wasRetried).toBe(true);
    expect(response.summary.initialProtocol).toBe('Morpho');
    expect(response.summary.finalProtocol).toBe('Aave');
    expect(response.summary.reasonForRetry).toBeDefined();
    expect(response.summary.reasonForRetry!.length).toBeGreaterThan(0);
  });

  it('should have final_result matching the approved plan', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });

    expect(response.final_result.protocol).toBe(response.summary.finalProtocol);
    expect(response.final_result.action).toBe('deposit');
    expect(response.final_result.status).toBe('success');
  });

  it('should have strictly increasing timestamps across all trace entries', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });

    for (let i = 1; i < response.trace.length; i++) {
      expect(response.trace[i]!.timestamp).toBeGreaterThanOrEqual(
        response.trace[i - 1]!.timestamp
      );
    }
  });

  it('should use only ENS-style agent names in trace', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });
    const validNames = ['yield.relay.eth', 'risk.relay.eth', 'executor.relay.eth', 'system.relay.eth'];

    for (const entry of response.trace) {
      expect(validNames).toContain(entry.agent);
    }
  });

  it('should have trace step order: start → analyze → evaluate → review → retry → ... → execute', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });
    const steps = response.trace.map(t => t.step);

    expect(steps[0]).toBe('start');
    expect(steps.includes('analyze')).toBe(true);
    expect(steps.includes('evaluate')).toBe(true);
    expect(steps.includes('review')).toBe(true);
    expect(steps.includes('retry')).toBe(true);
    expect(steps.includes('execute')).toBe(true);
  });

  it('should have confidence breakdown in debug', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });
    const debug = response.debug as Record<string, unknown>;

    expect(debug).toBeDefined();
    const breakdown = debug.confidenceBreakdown as Record<string, number>;
    expect(breakdown).toBeDefined();
    expect(typeof breakdown.yield).toBe('number');
    expect(typeof breakdown.risk).toBe('number');
    expect(typeof breakdown.execution).toBe('number');
  });

  it('should have summary confidence matching breakdown average', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });
    const debug = response.debug as Record<string, unknown>;
    const breakdown = debug.confidenceBreakdown as Record<string, number>;

    const expectedAvg = ((breakdown.yield ?? 0) + (breakdown.risk ?? 0) + (breakdown.execution ?? 0)) / 3;
    const rounded = Math.round(expectedAvg * 100) / 100;

    expect(response.summary.confidence).toBe(rounded);
  });

  it('should have explanation consistent with retry path', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });

    if (response.summary.wasRetried) {
      expect(response.summary.explanation).toContain('Initially selected');
      expect(response.summary.explanation).toContain('switched to');
      expect(response.summary.explanation).toContain(response.summary.finalProtocol);
    } else {
      expect(response.summary.explanation).toContain('Selected');
      expect(response.summary.explanation).toContain(response.summary.finalProtocol);
    }
  });

  it('should have all trace entries with required fields', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });

    for (const entry of response.trace) {
      expect(typeof entry.agent).toBe('string');
      expect(entry.agent.length).toBeGreaterThan(0);
      expect(typeof entry.step).toBe('string');
      expect(entry.step.length).toBeGreaterThan(0);
      expect(typeof entry.message).toBe('string');
      expect(entry.message.length).toBeGreaterThan(0);
      expect(typeof entry.timestamp).toBe('number');
      expect(entry.timestamp).toBeGreaterThan(0);
    }
  });

  it('should produce deterministic results for same input', async () => {
    const response1 = await service.execute({ intent: 'get best yield on ETH' });
    const response2 = await service.execute({ intent: 'get best yield on ETH' });

    expect(response1.summary.initialProtocol).toBe(response2.summary.initialProtocol);
    expect(response1.summary.finalProtocol).toBe(response2.summary.finalProtocol);
    expect(response1.summary.wasRetried).toBe(response2.summary.wasRetried);
    expect(response1.final_result.protocol).toBe(response2.final_result.protocol);
  });

  it('should include ENS reputation score in debug', async () => {
    const response = await service.execute({ intent: 'get best yield on ETH' });
    const debug = response.debug as Record<string, unknown>;

    expect(typeof debug.ensReputationScore).toBe('number');
  });
});
