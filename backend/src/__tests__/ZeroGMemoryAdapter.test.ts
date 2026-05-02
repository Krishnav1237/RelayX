import { describe, expect, it } from 'vitest';
import { RiskAgent } from '../agents/RiskAgent';
import { ExecutionService } from '../orchestrator/ExecutionService';
import { AgentTrace } from '../types';
import { ExecutionMemory, ZeroGMemoryAdapter, ZeroGMemoryStore } from '../adapters/ZeroGMemoryAdapter';

class FailingMemoryStore implements ZeroGMemoryStore {
  readonly enabled = true;

  async appendExecution(_data: ExecutionMemory): Promise<void> {
    throw new Error('0G offline');
  }

  async getRecentExecutions(_limit: number): Promise<ExecutionMemory[]> {
    throw new Error('0G offline');
  }

  async getProtocolStats(_protocol: string): Promise<null> {
    throw new Error('0G offline');
  }

  async setProtocolStats(): Promise<void> {
    throw new Error('0G offline');
  }
}

describe('ZeroGMemoryAdapter', () => {
  it('stores execution history and updates protocol stats', async () => {
    const memory = ZeroGMemoryAdapter.inMemory();

    await memory.storeExecution({
      intent: 'get best yield on ETH',
      selectedProtocol: 'Aave',
      confidence: 0.8,
      outcome: 'success',
      timestamp: 1000,
    });
    await memory.storeExecution({
      intent: 'get best yield on ETH',
      selectedProtocol: 'Aave',
      confidence: 0.6,
      outcome: 'failed',
      timestamp: 2000,
    });

    const stats = await memory.getProtocolStats('Aave');
    expect(stats).not.toBeNull();
    expect(stats!.protocol).toBe('Aave');
    expect(stats!.executionCount).toBe(2);
    expect(stats!.successRate).toBe(0.5);
    expect(stats!.avgConfidence).toBe(0.7);

    const recent = await memory.getRecentExecutions(1);
    expect(recent.length).toBe(1);
    expect(recent[0]!.timestamp).toBe(2000);
  });

  it('increases confidence when historical success is strong', async () => {
    const memory = ZeroGMemoryAdapter.inMemory([
      { protocol: 'Aave', successRate: 0.92, avgConfidence: 0.9, executionCount: 50 },
    ]);
    const agent = new RiskAgent(memory);
    const trace: AgentTrace[] = [];

    const { confidence, result } = await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000);

    expect(result.decision).toBe('approve');
    expect(confidence).toBe(0.9);
    const memoryTrace = trace.find(entry => entry.message.includes('Memory: Aave has 92% success rate'));
    expect(memoryTrace).toBeDefined();
    expect(memoryTrace!.metadata?.influence).toBe('positive');
  });

  it('penalizes risk when historical success is weak', async () => {
    const memory = ZeroGMemoryAdapter.inMemory([
      { protocol: 'Morpho', successRate: 0.42, avgConfidence: 0.55, executionCount: 24 },
    ]);
    const agent = new RiskAgent(memory);
    const trace: AgentTrace[] = [];

    const { confidence, result } = await agent.review({ protocol: 'Morpho', apy: 4.1, riskLevel: 'medium' }, trace, 1000);

    expect(result.decision).toBe('approve');
    expect(result.riskScore).toBe(30);
    expect(confidence).toBe(0.68);
    expect(result.flags?.some(flag => flag.includes('Memory reports low historical success'))).toBe(true);
    const memoryTrace = trace.find(entry => entry.message.includes('Memory: Morpho has 42% success rate'));
    expect(memoryTrace).toBeDefined();
    expect(memoryTrace!.metadata?.influence).toBe('negative');
  });

  it('falls back cleanly when 0G is unavailable', async () => {
    const memory = new ZeroGMemoryAdapter(new FailingMemoryStore());
    const agent = new RiskAgent(memory);
    const trace: AgentTrace[] = [];

    const { result } = await agent.review({ protocol: 'Aave', apy: 4.2, riskLevel: 'low' }, trace, 1000);

    expect(result.decision).toBe('approve');
    expect(trace.some(entry => entry.message === 'Memory unavailable — proceeding without historical context')).toBe(true);
  });

  it('demo mode uses seeded memory to reject first choice and influence retry', async () => {
    const service = new ExecutionService();
    const result = await service.execute({ intent: 'get best yield on ETH', context: { demo: true } });

    expect(result.summary.wasRetried).toBe(true);
    expect(result.summary.initialProtocol).toBe('Morpho');
    expect(result.summary.finalProtocol).toBe('Aave V3');
    expect(result.trace.some(entry => entry.message.includes('Memory: Morpho has 42% success rate'))).toBe(true);
    expect(result.trace.some(entry => entry.message.includes('Memory retry preference: selected Aave V3'))).toBe(true);
  });
});
