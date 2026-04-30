import { describe, it, expect } from 'vitest';
import { YieldAgent } from '../agents/YieldAgent';
import { RiskAgent } from '../agents/RiskAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { AgentTrace, YieldOption } from '../types';

describe('Edge Cases', () => {
  describe('Retry selects different protocol', () => {
    it('attempt 1 and attempt 2 should select different protocols when multiple exist', async () => {
      const agent = new YieldAgent();
      const t1: AgentTrace[] = [];
      const r1 = await agent.think('get best yield on ETH', 1, t1, 1000);
      const t2: AgentTrace[] = [];
      const r2 = await agent.think('get best yield on ETH', 2, t2, 1000);
      // Only assert different if there are multiple options
      if (r1.options.length > 1) {
        expect(r1.selectedOption.protocol).not.toBe(r2.selectedOption.protocol);
      }
    });
  });

  describe('Confidence bounds', () => {
    it('YieldAgent confidence between 0 and 0.95', async () => {
      const agent = new YieldAgent();
      for (let attempt = 1; attempt <= 3; attempt++) {
        const trace: AgentTrace[] = [];
        const result = await agent.think('get best yield on ETH', attempt, trace, 1000);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(0.95);
      }
    });

    it('RiskAgent confidence never 1.0', async () => {
      const agent = new RiskAgent();
      const plans: YieldOption[] = [
        { protocol: 'A', apy: 4.2, riskLevel: 'low' },
        { protocol: 'B', apy: 4.6, riskLevel: 'medium' },
        { protocol: 'C', apy: 3.0, riskLevel: 'high' },
      ];
      for (const plan of plans) {
        const trace: AgentTrace[] = [];
        const { confidence } = await agent.review(plan, trace, 1000);
        expect(confidence).toBeLessThanOrEqual(0.95);
        expect(confidence).not.toBe(1.0);
      }
    });

    it('ExecutorAgent confidence exactly 0.9', async () => {
      const agent = new ExecutorAgent();
      const trace: AgentTrace[] = [];
      const { confidence } = await agent.execute({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1, 1000);
      expect(confidence).toBe(0.9);
    });
  });

  describe('Edge inputs', () => {
    it('YieldAgent handles very long intent', async () => {
      const agent = new YieldAgent();
      const trace: AgentTrace[] = [];
      const result = await agent.think('get best yield on ETH ' + 'a'.repeat(500), 1, trace, 1000);
      expect(result.selectedOption).toBeDefined();
    });

    it('RiskAgent handles undefined riskLevel', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const { result } = await agent.review({ protocol: 'Unknown', apy: 4.5 }, trace, 1000);
      expect(result.decision).toBeDefined();
    });

    it('RiskAgent handles zero APY', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const { result } = await agent.review({ protocol: 'Zero', apy: 0, riskLevel: 'low' }, trace, 1000);
      expect(result.decision).toBe('approve');
    });

    it('RiskAgent handles negative APY', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const { result } = await agent.review({ protocol: 'Neg', apy: -1, riskLevel: 'low' }, trace, 1000);
      expect(result.decision).toBe('approve');
    });
  });

  describe('Trace integrity', () => {
    it('no empty agent names', async () => {
      const agent = new YieldAgent();
      const trace: AgentTrace[] = [];
      await agent.think('test', 1, trace, 1000);
      for (const e of trace) expect(e.agent.length).toBeGreaterThan(0);
    });

    it('no empty steps', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000);
      for (const e of trace) expect(e.step.length).toBeGreaterThan(0);
    });

    it('no empty messages', async () => {
      const agent = new ExecutorAgent();
      const trace: AgentTrace[] = [];
      await agent.execute({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1, 1000);
      for (const e of trace) expect(e.message.length).toBeGreaterThan(0);
    });
  });

  describe('ENS tier boundaries', () => {
    it('score 0.9 is strong', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const { ensInfluence } = await agent.review(
        { protocol: 'A', apy: 4.2, riskLevel: 'low' }, trace, 1000, undefined,
        { sources: ['a.eth'], resolved: ['a.eth'], reputationScore: 0.9 }
      );
      expect(ensInfluence.tier).toBe('strong');
    });

    it('score 0.89 is neutral', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const { ensInfluence } = await agent.review(
        { protocol: 'A', apy: 4.2, riskLevel: 'low' }, trace, 1000, undefined,
        { sources: ['a.eth'], resolved: ['a.eth'], reputationScore: 0.89 }
      );
      expect(ensInfluence.tier).toBe('neutral');
    });

    it('score 0.69 is weak', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const { ensInfluence } = await agent.review(
        { protocol: 'A', apy: 4.2, riskLevel: 'low' }, trace, 1000, undefined,
        { sources: ['a.eth'], resolved: [], reputationScore: 0.69 }
      );
      expect(ensInfluence.tier).toBe('weak');
    });

    it('no ENS context = neutral tier', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const { ensInfluence } = await agent.review(
        { protocol: 'A', apy: 4.2, riskLevel: 'low' }, trace, 1000
      );
      expect(ensInfluence.tier).toBe('neutral');
    });
  });
});
