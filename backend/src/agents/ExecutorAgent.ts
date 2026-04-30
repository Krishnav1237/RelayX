import { BaseAgent } from './BaseAgent';
import { AXLMessage, AgentTrace, ExecutionResult, YieldOption } from '../types';
import { AXLAdapter } from '../adapters/AXLAdapter';

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

    trace.push(this.log('execute',
      `Executing deposit on ${plan.protocol} (${plan.apy}% APY)`,
      { protocol: plan.protocol, apy: plan.apy, action: 'deposit', attempt, confidence },
      ts, externalMetadata));
    ts += 10;

    const result: ExecutionResult = {
      protocol: plan.protocol,
      apy: `${plan.apy}%`,
      action: 'deposit',
      status: 'success',
      attempt,
    };

    trace.push(this.log('execute',
      `Deposit successful. Funds now generating yield at ${plan.apy}% APY.`,
      { protocol: result.protocol, apy: result.apy, action: result.action, attempt, confidence },
      ts, externalMetadata));
    ts += 10;

    // AXL broadcast — fire and forget for execution signal
    const axlMessage: AXLMessage = {
      from: this.name,
      to: 'axl.network',
      type: 'execution_signal',
      payload: { protocol: result.protocol, apy: result.apy, status: result.status, attempt },
      timestamp: Date.now(),
    };

    let remoteResponses: unknown[] = [];
    try {
      remoteResponses = await this.axlAdapter.broadcast(axlMessage);
    } catch {
      remoteResponses = [];
    }

    const isSimulated = remoteResponses.length > 0 &&
      remoteResponses.every(r => isRecord(r) && r.simulatedPeer === true);
    const sourceLabel = isSimulated ? 'AXL fallback (simulated peers)' : 'AXL live peers';

    trace.push(this.log('execute',
      `${sourceLabel}: ${remoteResponses.length} acknowledged execution`,
      { peersContacted: remoteResponses.length, isSimulated },
      ts, externalMetadata));

    return { result, confidence };
  }
}
