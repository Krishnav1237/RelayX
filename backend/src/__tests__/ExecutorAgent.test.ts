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

  it('should include Uniswap swap quote in result', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    const { result } = await agent.execute(plan, trace, 1, 1000);

    // Should have swap data from an upstream quote source
    expect(result.swap).toBeDefined();
    expect(result.swap!.amountOut.length).toBeGreaterThan(0);
    expect(typeof result.swap!.priceImpact).toBe('number');
    expect(result.swap!.gasEstimate.length).toBeGreaterThan(0);
    expect(result.swap!.route.length).toBeGreaterThan(0);
    expect(['uniswap', 'coingecko', 'cache']).toContain(result.swap!.source);
  });

  it('should include Uniswap trace entries', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    await agent.execute(plan, trace, 1, 1000);

    const quoteEntry = trace.find(t => t.step === 'quote');
    expect(quoteEntry).toBeDefined();
    expect(quoteEntry!.message).toContain('Uniswap');

    const routeEntry = trace.find(t => t.step === 'quote' && t.message.includes('route'));
    expect(routeEntry).toBeDefined();
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
  });

  it('should produce strictly increasing timestamps', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'Aave', apy: 4.2, riskLevel: 'low' };

    await agent.execute(plan, trace, 1, 1000);

    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]!.timestamp).toBeGreaterThanOrEqual(trace[i - 1]!.timestamp);
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

  it('should handle unknown protocol gracefully', async () => {
    const agent = new ExecutorAgent();
    const trace: AgentTrace[] = [];
    const plan: YieldOption = { protocol: 'UnknownProtocol', apy: 5.0, riskLevel: 'medium' };

    const { result } = await agent.execute(plan, trace, 1, 1000);

    expect(result.status).toBe('success');
    // Should still get a swap quote (defaults to ETH→USDC)
    expect(result.swap).toBeDefined();
  });
});
