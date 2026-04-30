import { describe, it, expect } from 'vitest';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { AgentTrace, YieldOption } from '../types';

describe('ExecutorAgent', () => {
  it('should have ENS-style identity', () => {
    const agent = new ExecutorAgent();
    expect(agent.name).toBe('executor.relay.eth');
    expect(agent.id).toBe('executor.relay.eth');
  });

  it('should return success result with correct fields', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    const { result } = await agent.execute(plan, trace, 1, 1000);

    expect(result.protocol).toBe('Aave');
    expect(result.apy).toBe('4.2%');
    expect(result.action).toBe('deposit');
    expect(result.status).toBe('success');
    expect(result.attempt).toBe(1);
  });

  it('should include attempt number in result', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    const { result } = await agent.execute(plan, trace, 2, 1000);

    expect(result.attempt).toBe(2);
  });

  it('should return fixed confidence of 0.9', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    const { confidence } = await agent.execute(plan, trace, 1, 1000);

    expect(confidence).toBe(0.9);
  });

  it('should produce user-facing narrative in trace', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    await agent.execute(plan, trace, 1, 1000);

    const narrativeEntry = trace.find(t => t.message.includes('Deposit successful'));
    expect(narrativeEntry).toBeDefined();
    expect(narrativeEntry!.message).toContain('4.2% APY');
  });

  it('should produce strictly increasing timestamps', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    await agent.execute(plan, trace, 1, 1000);

    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]!.timestamp).toBeGreaterThan(trace[i - 1]!.timestamp);
    }
  });

  it('should use ENS-style agent name in all trace entries', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    await agent.execute(plan, trace, 1, 1000);

    for (const entry of trace) {
      expect(entry.agent).toBe('executor.relay.eth');
    }
  });
});
