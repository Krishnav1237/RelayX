import { BaseAgent } from './BaseAgent';
import { AgentContext, AgentResult } from '../types';

export class RiskAgent extends BaseAgent {
  async execute(_context: AgentContext): Promise<AgentResult> {
    // Risk assessment logic
    return { success: true };
  }
}
