import { describe, it, expect } from 'vitest';
import { BaseAgent } from '../agents/BaseAgent';
import { AgentTrace } from '../types';

class TestAgent extends BaseAgent {
  constructor() {
    super('test.relay.eth', 'test.relay.eth');
  }
}

describe('BaseAgent', () => {
  it('should set id and name correctly', () => {
    const agent = new TestAgent();
    expect(agent.id).toBe('test.relay.eth');
    expect(agent.name).toBe('test.relay.eth');
  });

  it('should produce a valid AgentTrace from log()', () => {
    const agent = new TestAgent();
    const trace: AgentTrace = agent.log('analyze', 'test message', { key: 'value' }, 1000);

    expect(trace.agent).toBe('test.relay.eth');
    expect(trace.step).toBe('analyze');
    expect(trace.message).toBe('test message');
    expect(trace.metadata).toEqual({ key: 'value' });
    expect(trace.timestamp).toBe(1000);
  });

  it('should handle undefined metadata', () => {
    const agent = new TestAgent();
    const trace = agent.log('step', 'msg', undefined, 500);
    expect(trace.metadata).toBeUndefined();
  });

  it('should merge external metadata without overwriting', () => {
    const agent = new TestAgent();
    const trace = agent.log('step', 'msg', { a: 1 }, 500, { b: 2 });
    expect(trace.metadata).toEqual({ a: 1, b: 2 });
  });

  it('should not overwrite existing keys with external metadata', () => {
    const agent = new TestAgent();
    const trace = agent.log('step', 'msg', { key: 'original' }, 500, { key: 'external' });
    expect(trace.metadata?.key).toBe('original');
  });
});
