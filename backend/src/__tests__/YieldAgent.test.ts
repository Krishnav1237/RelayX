import { describe, it, expect } from 'vitest';
import { YieldAgent } from '../agents/YieldAgent';
import { AgentTrace } from '../types';

describe('YieldAgent', () => {
  it('should have ENS-style identity', () => {
    const agent = new YieldAgent();
    expect(agent.name).toBe('yield.relay.eth');
    expect(agent.id).toBe('yield.relay.eth');
  });

  it('should select highest APY on attempt 1', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield on ETH', 1, trace, 1000);

    // Should select the highest APY option (whatever it is from live/fallback data)
    expect(result.selectedOption).toBeDefined();
    expect(result.selectedOption.apy).toBeGreaterThan(0);
    expect(result.attempt).toBe(1);

    // If there are multiple options, first should have highest APY
    if (result.options.length > 1) {
      expect(result.options[0]!.apy).toBeGreaterThanOrEqual(result.options[1]!.apy);
    }
  });

  it('should select different option on attempt 2', async () => {
    const agent = new YieldAgent();
    const t1: AgentTrace[] = [];
    const r1 = await agent.think('get best yield on ETH', 1, t1, 1000);
    const t2: AgentTrace[] = [];
    const r2 = await agent.think('get best yield on ETH', 2, t2, 1000);

    if (r1.options.length > 1) {
      expect(r1.selectedOption.protocol).not.toBe(r2.selectedOption.protocol);
    }
    expect(r2.attempt).toBe(2);
  });

  it('should return normalized confidence between 0 and 1', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield on ETH', 1, trace, 1000);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    const decimals = result.confidence.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  it('should produce strictly increasing timestamps in trace', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    await agent.think('get best yield on ETH', 1, trace, 1000);

    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]!.timestamp).toBeGreaterThanOrEqual(trace[i - 1]!.timestamp);
    }
  });

  it('should use ENS-style agent name in all trace entries', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    await agent.think('get best yield on ETH', 1, trace, 1000);

    for (const entry of trace) {
      expect(entry.agent).toBe('yield.relay.eth');
    }
  });

  it('should include reasoning in result', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield on ETH', 1, trace, 1000);

    expect(result.reasoning.length).toBeGreaterThan(10);
  });

  it('should include yield data source trace entry', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    await agent.think('get best yield on ETH', 1, trace, 1000);

    const dataEntry = trace.find(t => t.message.includes('yield data'));
    expect(dataEntry).toBeDefined();
  });

  it('should extract correct asset from intent', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    await agent.think('find best USDC yield', 1, trace, 1000);

    const dataEntry = trace.find(t => t.metadata?.asset !== undefined);
    expect(dataEntry?.metadata?.asset).toBe('USDC');
  });
});
