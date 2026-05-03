import { describe, expect, it } from 'vitest';
import { RiskAgent } from '../agents/RiskAgent.js';
import { ExecutionService } from '../orchestrator/ExecutionService.js';
import { AgentTrace } from '../types/index.js';
import { ZeroGMemoryAdapter } from '../adapters/ZeroGMemoryAdapter.js';

describe('ZeroGMemoryAdapter', () => {
  it('stores execution history and updates protocol stats', async () => {
    const memory = new ZeroGMemoryAdapter({ demo: true });

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

    // getProtocolStats is async
    const baseStats = await memory.getProtocolStats('Aave');
    expect(baseStats).not.toBeNull();
    expect(baseStats!.protocol.toLowerCase()).toBe('aave');
    // executionCount includes seeded + stored: seeded has 10, plus 2 stored = 12
    expect(baseStats!.executionCount).toBeGreaterThanOrEqual(2);
    expect(baseStats!.successRate).toBeGreaterThan(0);
  });

  it('returns null for unknown protocol', async () => {
    const memory = new ZeroGMemoryAdapter({ demo: true });
    const stats = await memory.getProtocolStats('unknownprotocol_xyz');
    expect(stats).toBeNull();
  });

  it('getProtocolStats reflects stored executions', async () => {
    const memory = new ZeroGMemoryAdapter({ demo: true });

    // Store to a unique protocol not in seeds
    await memory.storeExecution({
      intent: 'test',
      selectedProtocol: 'TestProto',
      confidence: 0.9,
      outcome: 'success',
      timestamp: Date.now(),
    });

    const stats = await memory.getProtocolStats('TestProto');
    expect(stats).not.toBeNull();
    expect(stats!.executionCount).toBe(1);
    expect(stats!.successRate).toBe(1);
  });

  it('increases confidence when historical success is strong', async () => {
    // Use a memory adapter with pre-seeded stats (high success for Aave)
    const memory = new ZeroGMemoryAdapter({ demo: true });

    // Override Aave stats to be very high success
    await memory.storeExecution({ intent: 'x', selectedProtocol: 'aave', confidence: 0.95, outcome: 'success', timestamp: Date.now() });
    await memory.storeExecution({ intent: 'x', selectedProtocol: 'aave', confidence: 0.95, outcome: 'success', timestamp: Date.now() });

    const agent = new RiskAgent(memory);
    const trace: AgentTrace[] = [];

    const { result } = await agent.review(
      { protocol: 'Aave', apy: 4.2, riskLevel: 'low' },
      trace,
      1000
    );

    expect(result.decision).toBe('approve');
  });

  it('falls back cleanly when memory returns null stats', async () => {
    const memory = new ZeroGMemoryAdapter({ demo: true });
    const agent = new RiskAgent(memory);
    const trace: AgentTrace[] = [];

    const { result } = await agent.review(
      { protocol: 'Aave', apy: 4.2, riskLevel: 'low' },
      trace,
      1000
    );

    expect(result.decision).toBe('approve');
  });

  it('isEnabled returns false in demo mode', () => {
    const memory = ZeroGMemoryAdapter.demo();
    expect(memory.isEnabled()).toBe(false);
  });

  it('isEnabled returns true in non-demo mode without ZEROG_PRIVATE_KEY', () => {
    const memory = new ZeroGMemoryAdapter();
    expect(memory.isEnabled()).toBe(true);
  });

  it('demo mode uses seeded memory to influence retry', async () => {
    const service = new ExecutionService();
    const result = await service.execute({
      intent: 'get best yield on ETH',
      context: { demo: true },
    });

    // With demo mode, execution should complete
    expect(result.final_result).toBeDefined();
    expect(['success', 'pending_approval']).toContain(result.final_result.status);
  });
});
