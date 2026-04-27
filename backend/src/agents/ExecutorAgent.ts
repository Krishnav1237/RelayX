import { BaseAgent } from './BaseAgent';
import { AgentTrace, ExecutionResult, YieldOption } from '../types';

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export class ExecutorAgent extends BaseAgent {
  constructor() {
    super('executor.relay.eth', 'executor.relay.eth');
  }

  execute(
    plan: YieldOption,
    trace: AgentTrace[],
    attempt: number,
    timestamp: number,
    externalMetadata?: Record<string, unknown>
  ): ExecutionResult {
    const confidence = normalizeConfidence(0.9);
    let ts = timestamp;

    // Step: execute
    trace.push(this.log('execute', `Executing deposit on ${plan.protocol} (${plan.apy}% APY)`, {
      protocol: plan.protocol,
      apy: plan.apy,
      action: 'deposit',
      attempt,
      confidence,
    }, ts, externalMetadata));
    ts += 10;

    const result: ExecutionResult = {
      protocol: plan.protocol,
      apy: `${plan.apy}%`,
      action: 'deposit',
      status: 'success',
      attempt,
    };

    // Step: execution complete
    trace.push(this.log('execute', `Deposit successful. Funds now generating yield at ${plan.apy}% APY.`, {
      protocol: result.protocol,
      apy: result.apy,
      action: result.action,
      attempt,
      confidence,
    }, ts, externalMetadata));

    return result;
  }
}
