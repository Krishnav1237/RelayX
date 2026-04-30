import { describe, it, expect } from 'vitest';
import { RiskAgent } from '../agents/RiskAgent';
import { AgentTrace, YieldOption } from '../types';

describe('RiskAgent', () => {
  it('should have ENS-style identity', () => {
    const agent = new RiskAgent();
    expect(agent.name).toBe('risk.relay.eth');
    expect(agent.id).toBe('risk.relay.eth');
  });

  it('should reject Morpho (4.6%, medium risk) — triggers retry path', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Morpho', apy: 4.6, riskLevel: 'medium' };

    const { result } = await agent.review(plan, trace, 1000);

    expect(result.decision).toBe('reject');
    expect(result.flags).toBeDefined();
    expect(result.flags!.length).toBeGreaterThan(0);
  });

  it('should approve Aave (4.2%, low risk)', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    const { result } = await agent.review(plan, trace, 1000);

    expect(result.decision).toBe('approve');
  });

  it('should reject high risk protocols regardless of APY', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Risky', apy: 3.0, riskLevel: 'high' };

    const { result } = await agent.review(plan, trace, 1000);

    expect(result.decision).toBe('reject');
    expect(result.flags).toContain('Protocol has high risk profile');
  });

  it('should approve medium risk with APY below threshold', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'MediumSafe', apy: 4.0, riskLevel: 'medium' };

    const { result } = await agent.review(plan, trace, 1000);

    expect(result.decision).toBe('approve');
  });

  it('should return confidence that never equals 1.0', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    const { confidence } = await agent.review(plan, trace, 1000);

    expect(confidence).toBeLessThanOrEqual(0.95);
    expect(confidence).toBeGreaterThan(0);
  });

  it('should have lower confidence for rejections than approvals', async () => {
    const agent = new RiskAgent();

    const trace1: AgentTrace[] = [];
    const { confidence: approveConf } = await agent.review(
      { protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace1, 1000
    );

    const trace2: AgentTrace[] = [];
    const { confidence: rejectConf } = await agent.review(
      { protocol: 'Morpho', apy: 4.6, riskLevel: 'medium' }, trace2, 1000
    );

    expect(approveConf).toBeGreaterThan(rejectConf);
  });

  it('should adjust threshold with strong ENS reputation', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'MediumOk', apy: 4.5, riskLevel: 'medium' };

    // With strong ENS (score > 0.85), threshold is 4.55, so 4.5 < 4.55 → approve
    const { result } = await agent.review(plan, trace, 1000, undefined, {
      sources: ['vitalik.eth'],
      resolved: ['vitalik.eth'],
      reputationScore: 0.95,
    });

    expect(result.decision).toBe('approve');
  });

  it('should be stricter with weak ENS reputation', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'MediumOk', apy: 4.3, riskLevel: 'medium' };

    // With weak ENS (score < 0.7), threshold is 4.2, so 4.3 >= 4.2 → reject
    const { result } = await agent.review(plan, trace, 1000, undefined, {
      sources: ['unknown.eth'],
      resolved: [],
      reputationScore: 0.4,
    });

    expect(result.decision).toBe('reject');
  });

  it('should produce strictly increasing timestamps', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000);

    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]!.timestamp).toBeGreaterThan(trace[i - 1]!.timestamp);
    }
  });

  it('should use ENS-style agent name in all trace entries', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000);

    for (const entry of trace) {
      expect(entry.agent).toBe('risk.relay.eth');
    }
  });
});
