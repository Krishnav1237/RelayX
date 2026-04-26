import { BaseAgent } from './BaseAgent';
import { AgentContext, AgentResult } from '../types';

export class ExecutorAgent extends BaseAgent {
  async execute(_context: AgentContext): Promise<AgentResult> {
    // Execution logic
    return { success: true };
  }
}
