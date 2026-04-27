import { AgentTrace, ExecutionRequest, ExecutionResponse, ExecutionResult, ExecutionSummary, RiskENSSignals, YieldOption } from '../types';
import { YieldAgent } from '../agents/YieldAgent';
import { RiskAgent } from '../agents/RiskAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { ENSAdapter } from '../adapters/ENSAdapter';

const SYSTEM_AGENT = 'system.relay.eth';
const ENS_AGENT_NAMES = ['yield.relay.eth', 'risk.relay.eth', 'executor.relay.eth'] as const;

interface AgentENSData {
  address: string | null;
  records: Record<string, string>;
}

interface ENSMetadata {
  address: string | null;
  success_rate?: number;
  reputation?: string;
  role?: string;
  description?: string;
  version?: string;
}

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export class ExecutionService {
  private yieldAgent = new YieldAgent();
  private riskAgent = new RiskAgent();
  private executorAgent = new ExecutorAgent();
  private ensAdapter = new ENSAdapter();

  private async resolveAgentENS(agentNames: readonly string[]): Promise<Record<string, AgentENSData>> {
    const results = await Promise.all(
      agentNames.map(async (agentName) => {
        try {
          const address = await this.ensAdapter.resolveName(agentName);
          const records = await this.ensAdapter.getTextRecords(agentName);

          return [agentName, { address, records }] as const;
        } catch {
          return [agentName, { address: null, records: {} }] as const;
        }
      })
    );

    return Object.fromEntries(results);
  }

  private toENSMetadata(agentENS: AgentENSData | undefined): ENSMetadata {
    const records = agentENS?.records ?? {};
    const metadata: ENSMetadata = {
      address: agentENS?.address ?? null,
    };

    const successRate = this.parseSuccessRate(records.success_rate);
    if (successRate !== undefined) {
      metadata.success_rate = successRate;
    }
    if (records.reputation) {
      metadata.reputation = records.reputation;
    }
    if (records.role) {
      metadata.role = records.role;
    }
    if (records.description) {
      metadata.description = records.description;
    }
    if (records.version) {
      metadata.version = records.version;
    }

    return metadata;
  }

  private parseSuccessRate(value: string | undefined): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsedValue = Number.parseFloat(value);
    if (!Number.isFinite(parsedValue)) {
      return undefined;
    }

    const normalized = parsedValue > 1 ? parsedValue / 100 : parsedValue;
    return Math.round(Math.max(0, Math.min(1, normalized)) * 100) / 100;
  }

  private toRiskENSSignals(agentENS: AgentENSData | undefined, sourceAgent: string): RiskENSSignals {
    const records = agentENS?.records ?? {};
    const successRate = this.parseSuccessRate(records.success_rate);
    const reputation = records.reputation;
    const role = records.role;

    const hasSignals = successRate !== undefined || reputation !== undefined || role !== undefined;

    return {
      ...(successRate !== undefined ? { successRate } : {}),
      ...(reputation ? { reputation } : {}),
      ...(role ? { role } : {}),
      ...(hasSignals ? { sourceAgent } : {}),
    };
  }

  private extractRiskENSSignals(agentENSMap: Record<string, AgentENSData>): RiskENSSignals {
    const yieldSignals = this.toRiskENSSignals(agentENSMap[this.yieldAgent.name], this.yieldAgent.name);
    const riskSignals = this.toRiskENSSignals(agentENSMap[this.riskAgent.name], this.riskAgent.name);

    const successRate = yieldSignals.successRate ?? riskSignals.successRate;
    const reputation = yieldSignals.reputation ?? riskSignals.reputation;
    const role = yieldSignals.role ?? riskSignals.role;

    const sourceAgent = yieldSignals.successRate !== undefined || yieldSignals.reputation || yieldSignals.role
      ? yieldSignals.sourceAgent
      : riskSignals.sourceAgent;

    return {
      ...(successRate !== undefined ? { successRate } : {}),
      ...(reputation ? { reputation } : {}),
      ...(role ? { role } : {}),
      ...(sourceAgent ? { sourceAgent } : {}),
    };
  }

  private withENSMetadata(
    metadata: Record<string, unknown> | undefined,
    agentENS: AgentENSData | undefined
  ): Record<string, unknown> {
    return {
      ...(metadata ?? {}),
      ens: this.toENSMetadata(agentENS),
    };
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const trace: AgentTrace[] = [];
    const maxAttempts = 2;
    const baseTime = Date.now();
    let ts = baseTime;

    const agentENS = await this.resolveAgentENS(ENS_AGENT_NAMES);
    const yieldAgentMetadata = this.withENSMetadata(undefined, agentENS[this.yieldAgent.name]);
    const riskAgentMetadata = this.withENSMetadata(undefined, agentENS[this.riskAgent.name]);
    const executorAgentMetadata = this.withENSMetadata(undefined, agentENS[this.executorAgent.name]);
    const riskENSSignals = this.extractRiskENSSignals(agentENS);

    // System: execution start
    trace.push({
      agent: SYSTEM_AGENT,
      step: 'start',
      message: `Processing user intent: "${request.intent}"`,
      metadata: this.withENSMetadata(undefined, undefined),
      timestamp: ts,
    });
    ts += 10;

    // Step 1: YieldAgent thinks (attempt 1)
    let attempt = 1;
    let yieldResult = this.yieldAgent.think(request.intent, attempt, trace, ts, yieldAgentMetadata);
    ts = trace[trace.length - 1]!.timestamp + 10;
    
    let selectedOption: YieldOption = yieldResult.selectedOption;
    let finalPlan: YieldOption = selectedOption;

    const initialProtocol = selectedOption.protocol;
    let reasonForRetry: string | undefined;

    // Track confidence values
    let yieldConfidence = 0.85;
    let riskConfidence = 0.8;
    const executorConfidence = 0.9;

    // Step 2: RiskAgent reviews
    let riskResult = this.riskAgent.review(selectedOption, trace, ts, riskAgentMetadata, riskENSSignals);
    ts = trace[trace.length - 1]!.timestamp + 10;

    // Extract confidence from trace metadata
    const lastRiskTrace = trace[trace.length - 1];
    if (lastRiskTrace?.metadata?.confidence !== undefined) {
      riskConfidence = lastRiskTrace.metadata.confidence as number;
    }

    // Step 3: If rejected, retry once
    if (riskResult.decision === 'reject' && attempt < maxAttempts) {
      attempt++;
      reasonForRetry = riskResult.reasoning;

      // System: retry decision
      trace.push({
        agent: SYSTEM_AGENT,
        step: 'retry',
        message: `Retrying with alternative protocol due to risk rejection`,
        metadata: this.withENSMetadata({
          previousSelection: {
            protocol: selectedOption.protocol,
            apy: selectedOption.apy,
            riskLevel: selectedOption.riskLevel,
          },
          rejectionReason: riskResult.reasoning,
        }, undefined),
        timestamp: ts,
      });
      ts += 10;

      // Retry with attempt 2
      yieldResult = this.yieldAgent.think(request.intent, attempt, trace, ts, yieldAgentMetadata);
      ts = trace[trace.length - 1]!.timestamp + 10;
      
      selectedOption = yieldResult.selectedOption;
      finalPlan = selectedOption;

      // Extract confidence from retry yield trace
      const lastYieldTrace = trace[trace.length - 1];
      if (lastYieldTrace?.metadata?.confidence !== undefined) {
        yieldConfidence = lastYieldTrace.metadata.confidence as number;
      }

      // Review again
      riskResult = this.riskAgent.review(selectedOption, trace, ts, riskAgentMetadata, riskENSSignals);
      ts = trace[trace.length - 1]!.timestamp + 10;

      // Extract confidence from retry risk trace
      const retryRiskTrace = trace[trace.length - 1];
      if (retryRiskTrace?.metadata?.confidence !== undefined) {
        riskConfidence = retryRiskTrace.metadata.confidence as number;
      }
    }

    // System: final plan selection
    trace.push({
      agent: SYSTEM_AGENT,
      step: 'evaluate',
      message: `Final plan selected: ${finalPlan.protocol} at ${finalPlan.apy}% APY`,
      metadata: this.withENSMetadata({
        protocol: finalPlan.protocol,
        apy: finalPlan.apy,
        riskLevel: finalPlan.riskLevel,
      }, undefined),
      timestamp: ts,
    });
    ts += 10;

    // Step 4: ExecutorAgent executes
    const finalResult: ExecutionResult = this.executorAgent.execute(finalPlan, trace, attempt, ts, executorAgentMetadata);
    ts = trace[trace.length - 1]!.timestamp + 10;

    // System: execution complete
    trace.push({
      agent: SYSTEM_AGENT,
      step: 'execute',
      message: `Execution completed: deposited to ${finalResult.protocol}`,
      metadata: this.withENSMetadata({
        status: finalResult.status,
        protocol: finalResult.protocol,
      }, undefined),
      timestamp: ts,
    });

    // Compute average confidence
    const avgConfidence = normalizeConfidence((yieldConfidence + riskConfidence + executorConfidence) / 3);

    // Generate explanation
    const explanation = attempt > 1
      ? `Initially selected ${initialProtocol} for higher yield, but switched to ${finalPlan.protocol} due to risk constraints. Successfully executed deposit.`
      : `Selected ${finalPlan.protocol} with ${finalPlan.apy}% APY. Successfully executed deposit.`;

    // Build summary
    const summary: ExecutionSummary = {
      selectedProtocol: finalPlan.protocol,
      initialProtocol,
      finalProtocol: finalPlan.protocol,
      wasRetried: attempt > 1,
      reasonForRetry,
      totalSteps: trace.length,
      confidence: avgConfidence,
      explanation,
    };

    return {
      intent: request.intent,
      trace,
      final_result: finalResult,
      summary,
      debug: {
        attempts: attempt,
        initialSelection: { protocol: initialProtocol },
        finalApprovedPlan: finalPlan,
        riskDecision: riskResult.decision,
        confidenceBreakdown: {
          yield: yieldConfidence,
          risk: riskConfidence,
          execution: executorConfidence,
        },
      },
    };
  }
}
