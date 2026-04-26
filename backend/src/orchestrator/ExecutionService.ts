import { AgentTrace, ExecutionRequest, ExecutionResponse, ExecutionResult, ExecutionSummary, YieldOption } from '../types';
import { YieldAgent } from '../agents/YieldAgent';
import { RiskAgent } from '../agents/RiskAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';

const SYSTEM_AGENT = 'system.relay.eth';

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export class ExecutionService {
  private yieldAgent = new YieldAgent();
  private riskAgent = new RiskAgent();
  private executorAgent = new ExecutorAgent();

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const trace: AgentTrace[] = [];
    const maxAttempts = 2;
    const baseTime = Date.now();
    let ts = baseTime;

    // System: execution start
    trace.push({
      agent: SYSTEM_AGENT,
      step: 'start',
      message: `Processing user intent: "${request.intent}"`,
      timestamp: ts,
    });
    ts += 10;

    // Step 1: YieldAgent thinks (attempt 1)
    let attempt = 1;
    let yieldResult = this.yieldAgent.think(request.intent, attempt, trace, ts);
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
    let riskResult = this.riskAgent.review(selectedOption, trace, ts);
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
        metadata: {
          previousSelection: {
            protocol: selectedOption.protocol,
            apy: selectedOption.apy,
            riskLevel: selectedOption.riskLevel,
          },
          rejectionReason: riskResult.reasoning,
        },
        timestamp: ts,
      });
      ts += 10;

      // Retry with attempt 2
      yieldResult = this.yieldAgent.think(request.intent, attempt, trace, ts);
      ts = trace[trace.length - 1]!.timestamp + 10;
      
      selectedOption = yieldResult.selectedOption;
      finalPlan = selectedOption;

      // Extract confidence from retry yield trace
      const lastYieldTrace = trace[trace.length - 1];
      if (lastYieldTrace?.metadata?.confidence !== undefined) {
        yieldConfidence = lastYieldTrace.metadata.confidence as number;
      }

      // Review again
      riskResult = this.riskAgent.review(selectedOption, trace, ts);
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
      metadata: {
        protocol: finalPlan.protocol,
        apy: finalPlan.apy,
        riskLevel: finalPlan.riskLevel,
      },
      timestamp: ts,
    });
    ts += 10;

    // Step 4: ExecutorAgent executes
    const finalResult: ExecutionResult = this.executorAgent.execute(finalPlan, trace, attempt, ts);
    ts = trace[trace.length - 1]!.timestamp + 10;

    // System: execution complete
    trace.push({
      agent: SYSTEM_AGENT,
      step: 'execute',
      message: `Execution completed: deposited to ${finalResult.protocol}`,
      metadata: {
        status: finalResult.status,
        protocol: finalResult.protocol,
      },
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
