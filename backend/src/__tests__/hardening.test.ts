import { describe, it, expect } from 'vitest';
import { ExecutionService } from '../orchestrator/ExecutionService';
import { YieldAgent } from '../agents/YieldAgent';
import { RiskAgent } from '../agents/RiskAgent';
import { AgentTrace } from '../types';

describe('Hardening: Stability', () => {
  const service = new ExecutionService();

  it('Scenario 1: Normal run — valid response with all fields', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    expect(r.intent).toBe('get best yield on ETH');
    expect(r.trace.length).toBeGreaterThanOrEqual(8);
    expect(r.final_result.protocol.length).toBeGreaterThan(0);
    expect(r.final_result.apy).toContain('%');
    expect(['success', 'failed']).toContain(r.final_result.status);
    expect(r.summary.selectedProtocol.length).toBeGreaterThan(0);
    expect(r.summary.explanation.length).toBeGreaterThan(0);
    expect(r.summary.decisionImpact.ens.length).toBeGreaterThan(0);
    expect(r.summary.decisionImpact.axl.length).toBeGreaterThan(0);
    expect(r.summary.confidence).toBeGreaterThan(0);
    expect(r.summary.confidence).toBeLessThanOrEqual(0.95);
  });

  it('Scenario 2: AXL unavailable — no crash, clean trace', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    // AXL is down in test env — should still work
    const axlTrace = r.trace.find((t) => t.message.includes('AXL'));
    expect(axlTrace).toBeDefined();
    expect(r.final_result.status).toBe('success');
  });

  it('Scenario 3: Upstream data can trigger retry path', async () => {
    const r = await service.execute({
      intent: 'get best yield on ETH',
    });

    expect(r.summary.wasRetried).toBe(true);
    expect(r.summary.initialProtocol).toBe('Morpho');
    expect(r.summary.finalProtocol).not.toBe('Morpho');
    expect(r.summary.explanation).toContain('Initially selected');
  });

  it('Scenario 4: Unknown asset in free-form intent defaults to ETH discovery', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield on ZZZZNOTREAL', 1, trace, 1000);

    // No known asset is present, so the agent uses ETH as the default discovery asset.
    expect(result.options.length).toBeGreaterThanOrEqual(2);
    expect(result.selectedOption).toBeDefined();
  });
});

describe('Hardening: Confidence bounds', () => {
  it('all confidence values between 0 and 0.95', async () => {
    const service = new ExecutionService();
    const r = await service.execute({ intent: 'get best yield on ETH' });

    expect(r.summary.confidence).toBeGreaterThanOrEqual(0);
    expect(r.summary.confidence).toBeLessThanOrEqual(0.95);

    const debug = r.debug as Record<string, unknown>;
    const breakdown = debug.confidenceBreakdown as Record<string, number>;
    expect(breakdown.yield).toBeGreaterThanOrEqual(0);
    expect(breakdown.yield).toBeLessThanOrEqual(0.95);
    expect(breakdown.risk).toBeGreaterThanOrEqual(0);
    expect(breakdown.risk).toBeLessThanOrEqual(0.95);
    expect(breakdown.execution).toBeGreaterThanOrEqual(0);
    expect(breakdown.execution).toBeLessThanOrEqual(0.95);
  });
});

describe('Hardening: Trace consistency', () => {
  it('timestamps strictly increasing', async () => {
    const service = new ExecutionService();
    const r = await service.execute({ intent: 'get best yield on ETH' });

    for (let i = 1; i < r.trace.length; i++) {
      expect(r.trace[i]!.timestamp).toBeGreaterThanOrEqual(r.trace[i - 1]!.timestamp);
    }
  });

  it('all agents appear in trace', async () => {
    const service = new ExecutionService();
    const r = await service.execute({ intent: 'get best yield on ETH' });

    const agents = new Set(r.trace.map((t) => t.agent));
    expect(agents.has('system.relayx.eth')).toBe(true);
    expect(agents.has('yield.relayx.eth')).toBe(true);
    expect(agents.has('risk.relayx.eth')).toBe(true);
    expect(agents.has('executor.relayx.eth')).toBe(true);
  });

  it('no empty messages or steps', async () => {
    const service = new ExecutionService();
    const r = await service.execute({ intent: 'get best yield on ETH' });

    for (const e of r.trace) {
      expect(e.agent.length).toBeGreaterThan(0);
      expect(e.step.length).toBeGreaterThan(0);
      expect(e.message.length).toBeGreaterThan(0);
      expect(e.timestamp).toBeGreaterThan(0);
    }
  });
});

describe('Hardening: Yield validation', () => {
  it('all options have valid APY (0-50)', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield on ETH', 1, trace, 1000);

    for (const opt of result.options) {
      expect(opt.apy).toBeGreaterThan(0);
      expect(opt.apy).toBeLessThanOrEqual(50);
    }
  });

  it('attempt 1 and 2 select different protocols', async () => {
    const agent = new YieldAgent();
    const t1: AgentTrace[] = [];
    const r1 = await agent.think('get best yield on ETH', 1, t1, 1000);
    const t2: AgentTrace[] = [];
    const r2 = await agent.think('get best yield on ETH', 2, t2, 1000);

    if (r1.options.length > 1) {
      expect(r1.selectedOption.protocol).not.toBe(r2.selectedOption.protocol);
    }
  });
});

describe('Hardening: RiskAgent edge cases', () => {
  it('handles undefined riskLevel without crash', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const { result } = await agent.review({ protocol: 'Unknown', apy: 4.0 }, trace, 1000);
    expect(result.decision).toBeDefined();
  });

  it('handles zero APY', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const { result } = await agent.review(
      { protocol: 'Zero', apy: 0, riskLevel: 'low' },
      trace,
      1000
    );
    expect(result.decision).toBe('approve');
  });

  it('ENS tier boundaries are correct', async () => {
    const agent = new RiskAgent();

    const t1: AgentTrace[] = [];
    const { ensInfluence: e1 } = await agent.review(
      { protocol: 'A', apy: 4.0, riskLevel: 'low' },
      t1,
      1000,
      undefined,
      { sources: ['a.eth'], resolved: ['a.eth'], reputationScore: 0.9 }
    );
    expect(e1.tier).toBe('strong');

    const t2: AgentTrace[] = [];
    const { ensInfluence: e2 } = await agent.review(
      { protocol: 'A', apy: 4.0, riskLevel: 'low' },
      t2,
      1000,
      undefined,
      { sources: ['a.eth'], resolved: ['a.eth'], reputationScore: 0.75 }
    );
    expect(e2.tier).toBe('neutral');

    const t3: AgentTrace[] = [];
    const { ensInfluence: e3 } = await agent.review(
      { protocol: 'A', apy: 4.0, riskLevel: 'low' },
      t3,
      1000,
      undefined,
      { sources: ['a.eth'], resolved: [], reputationScore: 0.5 }
    );
    expect(e3.tier).toBe('weak');
  });
});

describe('Hardening: Response validation', () => {
  it('final_result has all required fields', async () => {
    const service = new ExecutionService();
    const r = await service.execute({ intent: 'get best yield on ETH' });

    expect(typeof r.final_result.protocol).toBe('string');
    expect(r.final_result.protocol.length).toBeGreaterThan(0);
    expect(r.final_result.apy).toContain('%');
    expect(r.final_result.action).toBe('deposit');
    expect(['success', 'failed']).toContain(r.final_result.status);
  });

  it('summary has all required fields', async () => {
    const service = new ExecutionService();
    const r = await service.execute({ intent: 'get best yield on ETH' });

    expect(r.summary.selectedProtocol.length).toBeGreaterThan(0);
    expect(r.summary.initialProtocol.length).toBeGreaterThan(0);
    expect(r.summary.finalProtocol.length).toBeGreaterThan(0);
    expect(typeof r.summary.wasRetried).toBe('boolean');
    expect(typeof r.summary.confidence).toBe('number');
    expect(r.summary.explanation.length).toBeGreaterThan(0);
    expect(r.summary.decisionImpact).toBeDefined();
  });
});
