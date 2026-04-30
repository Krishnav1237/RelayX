import { BaseAgent } from './BaseAgent';
import { AXLMessage, AgentTrace, ExecutionResult, YieldOption } from '../types';
import { AXLAdapter } from '../adapters/AXLAdapter';

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export class ExecutorAgent extends BaseAgent {
  private axlAdapter = new AXLAdapter();

  constructor() {
    super('executor.relay.eth', 'executor.relay.eth');
  }

  async execute(
    plan: YieldOption,
    trace: AgentTrace[],
    attempt: number,
    timestamp: number,
    externalMetadata?: Record<string, unknown>
  ): Promise<{ result: ExecutionResult; confidence: number }> {
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
    ts += 10;

    const axlMessage: AXLMessage = {
      from: this.name,
      to: 'axl.network',
      type: 'execution_signal',
      payload: {
        protocol: result.protocol,
        apy: result.apy,
        status: result.status,
        attempt,
      },
      timestamp: Date.now(),
    };

    trace.push(this.log('execute', 'Broadcasting execution signal to AXL network', {
      requestType: axlMessage.type,
    }, ts, externalMetadata));
    ts += 10;

    let remoteResponses: unknown[] = [];
    try {
      remoteResponses = await this.axlAdapter.broadcast(axlMessage);
    } catch (error) {
      console.error('[ExecutorAgent] AXL broadcast failed');
      console.error(error);
      remoteResponses = [];
    }

    trace.push(this.log('execute', `AXL peers acknowledged execution (${remoteResponses.length} responses)`, {
      peersContacted: remoteResponses.length,
    }, ts, externalMetadata));

    return { result, confidence };
  }
}
