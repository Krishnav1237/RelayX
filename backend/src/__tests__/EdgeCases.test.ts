import { describe, it, expect } from 'vitest';
import { YieldAgent } from '../agents/YieldAgent';
import { RiskAgent } from '../agents/RiskAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { AgentTrace, YieldOption } from '../types';

describe('Edge Cases', () => {
  describe('Retry does not select same protocol', () => {
    it('attempt 1 and attempt 2 should select different protocols', async () => {
      const agent = new YieldAgent();

      const trace1: AgentTrace[] = [];
      const result1 = await agent.think('test', 1, trace1, 1000);

      const trace2: AgentTrace[] = [];
      const result2 = await agent.think('test', 2, trace2, 1000);

      expect(result1.selectedOption.protocol).not.toBe(result2.selectedOption.protocol);
    });
  });

  describe('Confidence bounds', () => {
    it('YieldAgent confidence should be between 0 and 0.95', async () => {
      const agent = new YieldAgent();
      for (let attempt = 1; attempt <= 3; attempt++) {
        const trace: AgentTrace[] = [];
        const result = await agent.think('test', attempt, trace, 1000);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(0.95);
      }
    });

    it('RiskAgent confidence should never be 1.0', async () => {
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

    it('ExecutorAgent confidence should be exactly 0.9', async () => {
      const agent = new ExecutorAgent();
      const trace: AgentTrace[] = [];
      const { confidence } = await agent.execute(
        { protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1, 1000
      );
      expect(confidence).toBe(0.9);
    });
  });

  describe('Empty and edge input handling', () => {
    it('YieldAgent should handle very long intent strings', async () => {
      const agent = new YieldAgent();
      const trace: AgentTrace[] = [];
      const longIntent = 'a'.repeat(10000);
      const result = await agent.think(longIntent, 1, trace, 1000);
      expect(result.selectedOption).toBeDefined();
    });

    it('RiskAgent should handle undefined riskLevel', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const plan: YieldOption = { protocol: 'Unknown', apy: 4.5 };

      const { result } = await agent.review(plan, trace, 1000);
      expect(result.decision).toBeDefined();
    });

    it('RiskAgent should handle zero APY', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const plan: YieldOption = { protocol: 'Zero', apy: 0, riskLevel: 'low' };

      const { result } = await agent.review(plan, trace, 1000);
      expect(result.decision).toBe('approve');
    });

    it('RiskAgent should handle negative APY', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      const plan: YieldOption = { protocol: 'Negative', apy: -1, riskLevel: 'low' };

      const { result } = await agent.review(plan, trace, 1000);
      expect(result.decision).toBe('approve');
    });
  });

  describe('Trace integrity', () => {
    it('no trace entry should have empty agent name', async () => {
      const agent = new YieldAgent();
      const trace: AgentTrace[] = [];
      await agent.think('test', 1, trace, 1000);

      for (const entry of trace) {
        expect(entry.agent.length).toBeGreaterThan(0);
      }
    });

    it('no trace entry should have empty step', async () => {
      const agent = new RiskAgent();
      const trace: AgentTrace[] = [];
      await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000);

      for (const entry of trace) {
        expect(entry.step.length).toBeGreaterThan(0);
      }
    });

    it('no trace entry should have empty message', async () => {
      const agent = new ExecutorAgent();
      const trace: AgentTrace[] = [];
      await agent.execute({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1, 1000);

      for (const entry of trace) {
        expect(entry.message.length).toBeGreaterThan(0);
      }
    });
  });
});
