import { describe, it, expect } from 'vitest';
import { RiskAgent } from '../agents/RiskAgent';
import { AgentTrace, YieldOption } from '../types';

describe('RiskAgent', () => {
  it('should have ENS-style identity', () => {
    const agent = new RiskAgent();
    expect(agent.name).toBe('risk.relay.eth');
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
    const { result } = await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000);
    expect(result.decision).toBe('approve');
  });

  it('should reject high risk regardless of APY', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const { result } = await agent.review({ protocol: 'Risky', apy: 3.0, riskLevel: 'high' }, trace, 1000);
    expect(result.decision).toBe('reject');
  });

  it('should approve medium risk with APY below threshold', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const { result } = await agent.review({ protocol: 'MediumSafe', apy: 4.0, riskLevel: 'medium' }, trace, 1000);
    expect(result.decision).toBe('approve');
  });

  it('should return confidence <= 0.95', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const { confidence } = await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000);
    expect(confidence).toBeLessThanOrEqual(0.95);
    expect(confidence).toBeGreaterThan(0);
  });

  it('should have lower confidence for rejections', async () => {
    const agent = new RiskAgent();
    const t1: AgentTrace[] = [];
    const { confidence: c1 } = await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, t1, 1000);
    const t2: AgentTrace[] = [];
    const { confidence: c2 } = await agent.review({ protocol: 'Morpho', apy: 4.6, riskLevel: 'medium' }, t2, 1000);
    expect(c1).toBeGreaterThan(c2);
  });

  it('should return ENS influence with correct tier', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const { ensInfluence } = await agent.review(
      { protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000, undefined,
      { sources: ['vitalik.eth'], resolved: ['vitalik.eth'], reputationScore: 0.95 }
    );
    expect(ensInfluence.tier).toBe('strong');
    expect(ensInfluence.effect).toBe('increased tolerance');
  });

  it('should return weak ENS tier for low reputation', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const { ensInfluence } = await agent.review(
      { protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000, undefined,
      { sources: ['unknown.eth'], resolved: [], reputationScore: 0.4 }
    );
    expect(ensInfluence.tier).toBe('weak');
    expect(ensInfluence.effect).toBe('decreased tolerance');
  });

  it('should return AXL influence with approval ratio', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const { axlInfluence } = await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000);
    expect(axlInfluence.approvalRatio).toBeGreaterThanOrEqual(0);
    expect(axlInfluence.approvalRatio).toBeLessThanOrEqual(1);
    expect(['boost', 'penalty', 'retry', 'none']).toContain(axlInfluence.decisionImpact);
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
