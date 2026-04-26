import { AgentContext, AgentResult } from '../types';

export abstract class BaseAgent {
  abstract execute(context: AgentContext): Promise<AgentResult>;
}
