import { AgentTrace } from '../types';

export abstract class BaseAgent {
  readonly id: string;
  readonly name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  log(step: string, message: string, metadata: Record<string, unknown> | undefined, timestamp: number): AgentTrace {
    return {
      agent: this.name,
      step,
      message,
      metadata,
      timestamp,
    };
  }
}
