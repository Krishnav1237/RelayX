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
    const result = await agent.think('get best yield', 1, trace, 1000);

    // Morpho has highest APY at 4.6
    expect(result.selectedOption.protocol).toBe('Morpho');
    expect(result.selectedOption.apy).toBe(4.6);
    expect(result.attempt).toBe(1);
  });

  it('should select second-best option on attempt 2', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield', 2, trace, 1000);

    // Second option after Morpho should be Aave (4.2, local takes priority)
    expect(result.selectedOption.protocol).toBe('Aave');
    expect(result.selectedOption.apy).toBe(4.2);
    expect(result.attempt).toBe(2);
  });

  it('should not let simulated AXL override local Aave APY', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield', 1, trace, 1000);

    // Local Aave is 4.2, simulated AXL returns Aave at 4.25
    // Local should take priority
    const aaveOption = result.options.find(o => o.protocol === 'Aave');
    expect(aaveOption?.apy).toBe(4.2);
  });

  it('should include remote-only protocols from AXL', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield', 1, trace, 1000);

    // Spark comes from simulated AXL and doesn't exist locally
    const sparkOption = result.options.find(o => o.protocol === 'Spark');
    expect(sparkOption).toBeDefined();
    expect(sparkOption?.apy).toBe(4.15);
  });

  it('should return normalized confidence between 0 and 1', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield', 1, trace, 1000);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    // Check it's rounded to 2 decimal places
    expect(result.confidence.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it('should have higher confidence on retry (attempt 2)', async () => {
    const agent = new YieldAgent();
    const trace1: AgentTrace[] = [];
    const result1 = await agent.think('get best yield', 1, trace1, 1000);

    const trace2: AgentTrace[] = [];
    const result2 = await agent.think('get best yield', 2, trace2, 1000);

    expect(result2.confidence).toBeGreaterThanOrEqual(result1.confidence);
  });

  it('should produce strictly increasing timestamps in trace', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    await agent.think('get best yield', 1, trace, 1000);

    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]!.timestamp).toBeGreaterThan(trace[i - 1]!.timestamp);
    }
  });

  it('should use ENS-style agent name in all trace entries', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    await agent.think('get best yield', 1, trace, 1000);

    for (const entry of trace) {
      expect(entry.agent).toBe('yield.relay.eth');
    }
  });

  it('should include reasoning in result', async () => {
    const agent = new YieldAgent();
    const trace: AgentTrace[] = [];
    const result = await agent.think('get best yield', 1, trace, 1000);

    expect(result.reasoning).toContain('Morpho');
    expect(result.reasoning.length).toBeGreaterThan(10);
  });
});
