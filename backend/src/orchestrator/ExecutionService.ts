import { randomUUID } from 'crypto';
import {
  AgentTrace,
  AXLInfluence,
  DecisionImpact,
  ENSInfluence,
  ENSReputationContext,
  ExecutionApproval,
  ExecutionRequest,
  ExecutionResponse,
  ExecutionResult,
  ExecutionSummary,
  UniswapQuoteResult,
  YieldOption,
  YieldThinkResult,
} from '../types';
import { YieldAgent } from '../agents/YieldAgent';
import { RiskAgent } from '../agents/RiskAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { ENSAdapter } from '../adapters/ENSAdapter';
import { ZeroGMemoryAdapter } from '../adapters/ZeroGMemoryAdapter';
import { ReasoningAdapter } from '../adapters/ReasoningAdapter';
import { createPublicClient, http, type Address } from 'viem';
import { getAgentEnsName, getRequiredAgentNames } from '../config/agents';
import { getRelayXChain, getRelayXRpcUrls } from '../config/chain';
import { getApprovalTtlMs } from '../config/security';

const DEFAULT_ENS_SOURCES = ['ens.eth', 'nick.eth'] as const;
const MAX_ENS_SOURCES = 3;
const TRUSTED_ENS_SCORES: Record<string, number> = {
  'vitalik.eth': 0.95,
  'ens.eth': 0.93,
};

interface ENSSourceSignal {
  name: string;
  address: string | null;
  records: Record<string, string>;
  score: number;
}

interface PendingExecution {
  request: ExecutionRequest;
  trace: AgentTrace[];
  finalPlan: YieldOption;
  attempt: number;
  initialProtocol: string;
  reasonForRetry?: string;
  riskDecision: 'approve' | 'reject';
  ensReputationScore: number;
  ensInfluence?: ENSInfluence;
  axlInfluence?: AXLInfluence;
  memoryInfluence?: import('../types').MemoryInfluence;
  decisionImpact: DecisionImpact;
  clampedYield: number;
  clampedRisk: number;
  preparedSwapQuote: UniswapQuoteResult | null;
  approval: ExecutionApproval;
}

const ENS_TIMEOUT_MS = 4000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function getConfiguredEnsSources(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.RELAYX_DEFAULT_ENS_SOURCES?.split(',')
    .map((source) => source.trim().toLowerCase())
    .filter((source) => source.length > 0);
  return configured && configured.length > 0 ? [...new Set(configured)] : [...DEFAULT_ENS_SOURCES];
}

export class ExecutionService {
  private readonly systemAgent: string;
  private readonly requiredAgentNames: string[];
  private readonly approvalTtlMs: number;
  private readonly reverseLookupClient: ReturnType<typeof createPublicClient>;
  private yieldAgent: YieldAgent;
  private riskAgent: RiskAgent;
  private executorAgent: ExecutorAgent;
  private ensAdapter: ENSAdapter;
  private memoryAdapter: ZeroGMemoryAdapter;
  private reasoningAdapter: ReasoningAdapter;
  private pendingExecutions = new Map<string, PendingExecution>();

  constructor(memoryAdapter = new ZeroGMemoryAdapter()) {
    const chainConfig = getRelayXChain();
    const rpcUrls = getRelayXRpcUrls();
    const rpcUrl = rpcUrls[0];
    if (rpcUrl === undefined) {
      throw new Error('No RPC URL configured for ENS reverse lookup');
    }

    this.systemAgent = getAgentEnsName('system');
    this.requiredAgentNames = getRequiredAgentNames();
    this.approvalTtlMs = getApprovalTtlMs();
    this.reverseLookupClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(rpcUrl),
    });
    this.memoryAdapter = memoryAdapter;
    this.yieldAgent = new YieldAgent();
    this.riskAgent = new RiskAgent(memoryAdapter);
    this.executorAgent = new ExecutorAgent();
    this.ensAdapter = new ENSAdapter();
    this.reasoningAdapter = new ReasoningAdapter();
  }

  // --- ENS helpers ---

  private async resolveENSSources(sourceNames: readonly string[]): Promise<ENSSourceSignal[]> {
    const results = await Promise.all(
      sourceNames.map(async (sourceName) => {
        let address: string | null = null;
        let records: Record<string, string> = {};
        try {
          address = await withTimeout(
            this.ensAdapter.resolveName(sourceName),
            ENS_TIMEOUT_MS,
            `resolveName ${sourceName}`
          );
        } catch (e) {
          console.error(`[ENS ERROR] ${sourceName} ${e instanceof Error ? e.message : e}`);
        }
        try {
          records = await withTimeout(
            this.ensAdapter.getTextRecords(sourceName),
            ENS_TIMEOUT_MS,
            `getTextRecords ${sourceName}`
          );
        } catch (e) {
          console.error(`[ENS ERROR] ${sourceName} ${e instanceof Error ? e.message : e}`);
          records = {};
        }
        if (address === null && Object.keys(records).length === 0) return undefined;
        return {
          name: sourceName,
          address,
          records,
          score: this.computeSourceScore(sourceName, address, records),
        } satisfies ENSSourceSignal;
      })
    );
    return results.filter((r): r is ENSSourceSignal => r !== undefined);
  }

  private computeSourceScore(
    sourceName: string,
    address: string | null,
    records: Record<string, string>
  ): number {
    const trusted = TRUSTED_ENS_SCORES[sourceName.toLowerCase()];
    if (trusted !== undefined) return normalizeConfidence(trusted);
    let score = 0.5;
    if (address) score += 0.2;
    if (Object.keys(records).length > 0) score += 0.1;
    if (records['com.github']) score += 0.05;
    if (records['com.twitter']) score += 0.05;
    return normalizeConfidence(score);
  }

  private buildENSContext(
    signals: ENSSourceSignal[],
    names: readonly string[]
  ): ENSReputationContext {
    if (signals.length === 0) return { sources: [...names], resolved: [], reputationScore: 0.5 };
    const total = signals.reduce((s, x) => s + x.score, 0);
    return {
      sources: signals.map((s) => s.name),
      resolved: signals.filter((s) => s.address !== null).map((s) => s.name),
      reputationScore: normalizeConfidence(total / signals.length),
    };
  }

  private isEnsName(value: unknown): value is string {
    return typeof value === 'string' && value.trim().toLowerCase().includes('.eth');
  }

  private normalizeEnsName(name: string): string {
    return name.trim().toLowerCase();
  }

  private isWalletAddress(value: unknown): value is string {
    return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
  }

  private uniqEnsSources(sources: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of sources) {
      if (!this.isEnsName(s)) continue;
      const n = this.normalizeEnsName(s);
      if (!seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
    return out;
  }

  private async reverseLookupWalletENS(wallet: string): Promise<string | null> {
    try {
      const name = await withTimeout(
        this.reverseLookupClient.getEnsName({ address: wallet as Address }),
        ENS_TIMEOUT_MS,
        `reverseLookup ${wallet}`
      );
      if (this.isEnsName(name)) return this.normalizeEnsName(name);
    } catch (e) {
      console.error(`[ENS ERROR] reverse lookup ${wallet}: ${e instanceof Error ? e.message : e}`);
    }
    return null;
  }

  // --- Main execution ---

  async analyze(request: ExecutionRequest): Promise<ExecutionResponse> {
    const memoryAdapter =
      request.context?.demo === true ? ZeroGMemoryAdapter.demo() : this.memoryAdapter;
    const riskAgent =
      request.context?.demo === true ? new RiskAgent(memoryAdapter) : this.riskAgent;
    const traceMetadata = request.context?.demo === true ? { demo: true } : undefined;

    const defaultSources = getConfiguredEnsSources();
    const userENS = this.isEnsName(request.context?.ens)
      ? this.normalizeEnsName(request.context.ens)
      : null;
    let walletENS: string | null = null;
    if (this.isWalletAddress(request.context?.wallet)) {
      walletENS = await this.reverseLookupWalletENS(request.context.wallet);
    }

    const dynamicSources: string[] = [];
    if (userENS) dynamicSources.push(userENS);
    if (walletENS) dynamicSources.push(walletENS);
    if (!userENS && !walletENS) dynamicSources.push(this.systemAgent);

    const finalENSSources = this.uniqEnsSources([...dynamicSources, ...defaultSources]).slice(
      0,
      MAX_ENS_SOURCES
    );

    const trace: AgentTrace[] = [];
    const maxAttempts = 2;
    const baseTime = Date.now();
    let ts = baseTime;

    const ensSourceSignals = await this.resolveENSSources(finalENSSources);
    let ensContext = this.buildENSContext(ensSourceSignals, finalENSSources);

    // Task 5: If ENS completely failed, use safe neutral defaults
    if (ensSourceSignals.length === 0) {
      ensContext = { sources: [...finalENSSources], resolved: [], reputationScore: 0.7 };
    }

    // System: start
    trace.push({
      agent: this.systemAgent,
      step: 'start',
      message: `Processing intent: "${request.intent}" — ENS reputation: ${ensContext.reputationScore.toFixed(2)}`,
      metadata: {
        ensSourcesUsed: finalENSSources,
        reputationScore: ensContext.reputationScore,
        chain: getRelayXChain().name,
      },
      timestamp: ts,
    });
    ts += 10;

    // Step 1: YieldAgent
    let attempt = 1;
    let yieldResult: YieldThinkResult & { confidence: number };
    try {
      yieldResult = await this.yieldAgent.think(request.intent, attempt, trace, ts, traceMetadata);
    } catch (error) {
      return this.buildYieldUnavailableResponse(request, trace, ts, ensContext, error);
    }
    ts = trace[trace.length - 1]!.timestamp + 10;

    let selectedOption: YieldOption = yieldResult.selectedOption;
    let finalPlan: YieldOption = selectedOption;
    const initialProtocol = selectedOption.protocol;
    let reasonForRetry: string | undefined;
    let yieldConfidence = yieldResult.confidence;
    let riskConfidence = 0.8;
    let lastEnsInfluence: ENSInfluence | undefined;
    let lastAxlInfluence: AXLInfluence | undefined;
    let lastMemoryInfluence: import('../types').MemoryInfluence | undefined;

    // Step 2: RiskAgent
    let riskOutput = await riskAgent.review(selectedOption, trace, ts, traceMetadata, ensContext);
    ts = trace[trace.length - 1]!.timestamp + 10;
    let riskResult = riskOutput.result;
    riskConfidence = riskOutput.confidence;
    lastEnsInfluence = riskOutput.ensInfluence;
    lastAxlInfluence = riskOutput.axlInfluence;
    lastMemoryInfluence = riskOutput.memoryInfluence;
    if (lastMemoryInfluence) {
      trace.push({
        agent: riskAgent.name,
        step: 'memory',
        message: lastMemoryInfluence.hasHistory
          ? `Memory: ${lastMemoryInfluence.protocol} → ${lastMemoryInfluence.impact === 'boosted' ? 'strong' : lastMemoryInfluence.impact === 'penalized' ? 'weak' : 'neutral'} history (${lastMemoryInfluence.impact})`
          : `Memory: ${lastMemoryInfluence.protocol} → no history (neutral)`,
        metadata: {
          protocol: lastMemoryInfluence.protocol,
          hasHistory: lastMemoryInfluence.hasHistory,
          impact: lastMemoryInfluence.impact,
        },
        timestamp: ts,
      });
      ts += 10;
    }

    // Step 3: Retry if rejected OR if AXL forced retry
    const shouldRetry =
      (riskResult.decision === 'reject' || riskOutput.axlInfluence.decisionImpact === 'penalty') &&
      attempt < maxAttempts;

    if (shouldRetry) {
      attempt++;
      reasonForRetry =
        riskResult.decision === 'reject'
          ? riskResult.reasoning
          : `AXL peer consensus triggered retry (approval ratio: ${riskOutput.axlInfluence.approvalRatio})`;

      trace.push({
        agent: this.systemAgent,
        step: 'retry',
        message: `Retrying: ${reasonForRetry}`,
        metadata: {
          previousProtocol: selectedOption.protocol,
          previousApy: selectedOption.apy,
          ensInfluence: lastEnsInfluence,
          axlInfluence: lastAxlInfluence,
        },
        timestamp: ts,
      });
      ts += 10;

      try {
        yieldResult = await this.yieldAgent.think(
          request.intent,
          attempt,
          trace,
          ts,
          traceMetadata
        );
      } catch (error) {
        return this.buildYieldUnavailableResponse(request, trace, ts, ensContext, error);
      }
      ts = trace[trace.length - 1]!.timestamp + 10;
      const memorySelection = await this.selectRetryOptionByMemory(
        yieldResult.options,
        initialProtocol,
        yieldResult.selectedOption,
        memoryAdapter,
        trace,
        ts,
        traceMetadata
      );
      selectedOption = memorySelection.option;
      ts = memorySelection.timestamp;
      finalPlan = selectedOption;
      yieldConfidence = yieldResult.confidence;

      riskOutput = await riskAgent.review(selectedOption, trace, ts, traceMetadata, ensContext);
      ts = trace[trace.length - 1]!.timestamp + 10;
      riskResult = riskOutput.result;
      riskConfidence = riskOutput.confidence;
      lastEnsInfluence = riskOutput.ensInfluence;
      lastAxlInfluence = riskOutput.axlInfluence;
      lastMemoryInfluence = riskOutput.memoryInfluence;
      if (lastMemoryInfluence) {
        trace.push({
          agent: riskAgent.name,
          step: 'memory',
          message: lastMemoryInfluence.hasHistory
            ? `Memory: ${lastMemoryInfluence.protocol} → ${lastMemoryInfluence.impact === 'boosted' ? 'strong' : lastMemoryInfluence.impact === 'penalized' ? 'weak' : 'neutral'} history (${lastMemoryInfluence.impact})`
            : `Memory: ${lastMemoryInfluence.protocol} → no history (neutral)`,
          metadata: {
            protocol: lastMemoryInfluence.protocol,
            hasHistory: lastMemoryInfluence.hasHistory,
            impact: lastMemoryInfluence.impact,
          },
          timestamp: ts,
        });
        ts += 10;
      }
    }

    // System: final plan
    trace.push({
      agent: this.systemAgent,
      step: 'evaluate',
      message: `Final plan: ${finalPlan.protocol} at ${finalPlan.apy}% APY`,
      metadata: {
        protocol: finalPlan.protocol,
        apy: finalPlan.apy,
        riskLevel: finalPlan.riskLevel,
      },
      timestamp: ts,
    });
    ts += 10;

    // Step 4: Prepare swap quote only. Final execution requires explicit user approval.
    const quoteOutput = await this.executorAgent.quote(finalPlan, trace, ts);
    ts = quoteOutput.nextTimestamp;
    const preparedSwapQuote = quoteOutput.swapQuote;

    const finalResult: ExecutionResult = {
      protocol: finalPlan.protocol,
      apy: `${finalPlan.apy}%`,
      action: 'deposit',
      status: 'pending_approval',
      attempt,
      swap: preparedSwapQuote ?? undefined,
    };

    trace.push({
      agent: this.systemAgent,
      step: 'approval_required',
      message: `Approval required before executing ${finalPlan.protocol}`,
      metadata: {
        status: finalResult.status,
        protocol: finalResult.protocol,
        approvalRequired: true,
      },
      timestamp: ts,
    });
    ts += 10;

    // Confidence — clamp to [0, 0.95]
    const clampedYield = normalizeConfidence(Math.min(0.95, Math.max(0, yieldConfidence)));
    const clampedRisk = normalizeConfidence(Math.min(0.95, Math.max(0, riskConfidence)));
    // Calculate dynamic execution confidence
    let baseExecConfidence = 0.85;
    if (attempt > 1) baseExecConfidence -= 0.1; // Penalize for retries
    if (finalPlan.riskLevel === 'low') baseExecConfidence += 0.05; // Bonus for stable risk profile
    if (preparedSwapQuote) baseExecConfidence += 0.05; // Bonus for successful pre-execution quote
    const clampedExec = normalizeConfidence(Math.min(0.95, Math.max(0, baseExecConfidence)));
    const avgConfidence = normalizeConfidence((clampedYield + clampedRisk + clampedExec) / 3);

    // Decision impact — explicit ENS + AXL descriptions
    const ensImpactDesc = lastEnsInfluence
      ? lastEnsInfluence.tier === 'strong'
        ? `increased risk tolerance due to strong ENS (${lastEnsInfluence.reputationScore})`
        : lastEnsInfluence.tier === 'weak'
          ? `decreased risk tolerance due to weak ENS (${lastEnsInfluence.reputationScore})`
          : 'no ENS influence (neutral tier)'
      : 'no ENS context available';

    const axlImpactDesc = lastAxlInfluence
      ? lastAxlInfluence.decisionImpact === 'boost'
        ? `boosted confidence via peer agreement (${lastAxlInfluence.approvalRatio} approval)`
        : lastAxlInfluence.decisionImpact === 'penalty'
          ? `reduced confidence via peer disagreement (${lastAxlInfluence.approvalRatio} approval)`
          : lastAxlInfluence.decisionImpact === 'retry'
            ? `triggered retry due to peer disagreement`
            : 'no AXL influence on decision'
      : 'no AXL responses';

    const memoryImpactDesc =
      lastMemoryInfluence && lastMemoryInfluence.hasHistory
        ? lastMemoryInfluence.impact === 'boosted'
          ? `increased confidence due to high historical success (${Math.round(lastMemoryInfluence.successRate * 100)}%)`
          : lastMemoryInfluence.impact === 'penalized'
            ? `decreased confidence due to low historical success (${Math.round(lastMemoryInfluence.successRate * 100)}%)`
            : 'neutral memory influence'
        : 'no historical memory context';

    const decisionImpact: DecisionImpact = {
      ens: ensImpactDesc,
      axl: axlImpactDesc,
      memory: memoryImpactDesc,
    };

    // Generate final LLM explanation AFTER protocol is finalized
    let llmExplanation: string | null = null;
    if (this.reasoningAdapter.isEnabled()) {
      // Build context for final explanation
      const finalContext = {
        selectedProtocol: finalPlan.protocol,
        apy: finalPlan.apy,
        riskLevel: finalPlan.riskLevel ?? 'unknown',
        wasRetried: attempt > 1,
        initialProtocol: attempt > 1 ? initialProtocol : undefined,
        reasonForRetry: reasonForRetry,
        ensInfluence: lastEnsInfluence,
        memoryInfluence: lastMemoryInfluence,
      };

      llmExplanation = await this.reasoningAdapter.explainFinalDecision(
        finalContext,
        request.intent
      );

      if (llmExplanation) {
        trace.push({
          agent: this.systemAgent,
          step: 'explain',
          message: `Final LLM explanation: ${llmExplanation}`,
          metadata: { llmGenerated: true, isFinalExplanation: true },
          timestamp: ts,
        });
        ts += 10;
      }
    }

    const memoryPart =
      lastMemoryInfluence && lastMemoryInfluence.impact !== 'neutral'
        ? ` and ${lastMemoryInfluence.impact} historical performance`
        : '';

    // Use final LLM explanation if available, otherwise fall back to template
    const explanation = llmExplanation
      ? `${llmExplanation} Review and approve before execution.`
      : attempt > 1
        ? `Initially selected ${initialProtocol} for higher yield, but switched to ${finalPlan.protocol} due to risk constraints${memoryPart}. Review and approve before execution.`
        : `Selected ${finalPlan.protocol} with ${finalPlan.apy}% APY based on current yield${memoryPart}. Review and approve before execution.`;

    // --- Section 3: Trace assertions ---
    const agentsSeen = new Set(trace.map((t) => t.agent));
    for (const agent of this.requiredAgentNames) {
      if (!agentsSeen.has(agent)) {
        trace.push({
          agent: this.systemAgent,
          step: 'normalize',
          message: `Trace normalized: missing entries from ${agent}`,
          timestamp: ts,
        });
        ts += 10;
      }
    }

    // --- Section 4: Output contract validation ---
    const isValidResult =
      finalResult.protocol.length > 0 &&
      finalResult.apy.endsWith('%') &&
      (finalResult.status === 'pending_approval' ||
        finalResult.status === 'success' ||
        finalResult.status === 'failed') &&
      explanation.length > 10 &&
      ensImpactDesc.length > 0 &&
      axlImpactDesc.length > 0;

    if (!isValidResult) {
      trace.push({
        agent: this.systemAgent,
        step: 'normalize',
        message: 'Execution completed with degraded validation safeguards',
        timestamp: ts,
      });
      ts += 10;
    }

    const summary: ExecutionSummary = {
      selectedProtocol: finalPlan.protocol,
      initialProtocol,
      finalProtocol: finalPlan.protocol,
      wasRetried: attempt > 1,
      reasonForRetry,
      totalSteps: trace.length,
      confidence: avgConfidence,
      explanation,
      decisionImpact,
    };

    const approval: ExecutionApproval = {
      id: randomUUID(),
      expiresAt: Date.now() + this.approvalTtlMs,
    };

    this.cleanupPendingExecutions();
    this.pendingExecutions.set(approval.id, {
      request,
      trace,
      finalPlan,
      attempt,
      initialProtocol,
      reasonForRetry,
      riskDecision: riskResult.decision,
      ensReputationScore: ensContext.reputationScore,
      ensInfluence: lastEnsInfluence,
      axlInfluence: lastAxlInfluence,
      memoryInfluence: lastMemoryInfluence,
      decisionImpact,
      clampedYield,
      clampedRisk,
      preparedSwapQuote,
      approval,
    });

    return {
      intent: request.intent,
      trace,
      final_result: finalResult,
      summary,
      approval,
      debug: {
        attempts: attempt,
        initialSelection: { protocol: initialProtocol },
        finalApprovedPlan: finalPlan,
        riskDecision: riskResult.decision,
        ensReputationScore: ensContext.reputationScore,
        ensInfluence: lastEnsInfluence,
        axlInfluence: lastAxlInfluence,
        memoryInfluence: lastMemoryInfluence
          ? {
              protocol: lastMemoryInfluence.protocol,
              hasHistory: lastMemoryInfluence.hasHistory,
              impact: lastMemoryInfluence.impact,
            }
          : undefined,
        confidenceBreakdown: { yield: clampedYield, risk: clampedRisk, execution: clampedExec },
      },
    };
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const analysis = await this.analyze(request);
    // If analysis failed (e.g. yield unavailable), return the analysis directly instead of throwing
    if (!analysis.approval) {
      return analysis;
    }
    return this.confirmExecution(analysis.approval.id);
  }

  async confirmExecution(approvalId: string): Promise<ExecutionResponse> {
    this.cleanupPendingExecutions();

    const pending = this.pendingExecutions.get(approvalId);
    if (!pending) {
      throw new Error('Approval request expired or not found');
    }

    this.pendingExecutions.delete(approvalId);

    const trace = [...pending.trace];
    let ts = (trace[trace.length - 1]?.timestamp ?? Date.now()) + 10;

    trace.push({
      agent: this.systemAgent,
      step: 'approval',
      message: `User approved execution for ${pending.finalPlan.protocol}`,
      metadata: { approvalId, protocol: pending.finalPlan.protocol },
      timestamp: ts,
    });
    ts += 10;

    const isDemo = pending.request.context?.demo === true;
    const memoryAdapter = isDemo ? ZeroGMemoryAdapter.demo() : this.memoryAdapter;
    const traceMetadata = isDemo ? { demo: true } : undefined;

    const executorOutput = await this.executorAgent.execute(
      pending.finalPlan,
      trace,
      pending.attempt,
      ts,
      traceMetadata,
      pending.preparedSwapQuote
    );
    ts = trace[trace.length - 1]!.timestamp + 10;
    const finalResult = executorOutput.result;

    trace.push({
      agent: this.systemAgent,
      step: 'execute',
      message: `Execution completed: deposited to ${finalResult.protocol}`,
      metadata: { status: finalResult.status, protocol: finalResult.protocol },
      timestamp: ts,
    });
    ts += 10;

    const clampedExec = normalizeConfidence(Math.min(0.95, Math.max(0, executorOutput.confidence)));
    const avgConfidence = normalizeConfidence(
      (pending.clampedYield + pending.clampedRisk + clampedExec) / 3
    );

    if (finalResult.status === 'success') {
      ts = await this.persistExecutionMemory(
        memoryAdapter,
        pending.request.intent,
        pending.finalPlan,
        pending.attempt > 1 ? pending.initialProtocol : undefined,
        avgConfidence,
        trace,
        ts
      );
    }

    // Generate final LLM explanation AFTER execution is complete
    let llmExplanation: string | null = null;
    if (this.reasoningAdapter.isEnabled()) {
      const memoryInfluence = (pending as any).memoryInfluence as
        | import('../types').MemoryInfluence
        | undefined;

      // Build context for final explanation
      const finalContext = {
        selectedProtocol: pending.finalPlan.protocol,
        apy: pending.finalPlan.apy,
        riskLevel: pending.finalPlan.riskLevel ?? 'unknown',
        wasRetried: pending.attempt > 1,
        initialProtocol: pending.attempt > 1 ? pending.initialProtocol : undefined,
        reasonForRetry: pending.reasonForRetry,
        ensInfluence: pending.ensInfluence,
        memoryInfluence: memoryInfluence,
        executionStatus: finalResult.status,
      };

      llmExplanation = await this.reasoningAdapter.explainFinalDecision(
        finalContext,
        pending.request.intent
      );

      if (llmExplanation) {
        trace.push({
          agent: this.systemAgent,
          step: 'explain',
          message: `Final LLM explanation: ${llmExplanation}`,
          metadata: { llmGenerated: true, isFinalExplanation: true },
          timestamp: ts,
        });
        ts += 10;
      }
    }

    const memoryInfluence = (pending as any).memoryInfluence as
      | import('../types').MemoryInfluence
      | undefined;
    const memoryPart =
      memoryInfluence && memoryInfluence.impact !== 'neutral'
        ? ` and ${memoryInfluence.impact} historical performance`
        : '';

    // Use final LLM explanation if available, otherwise fall back to template
    const explanation = llmExplanation
      ? `${llmExplanation} Successfully executed deposit.`
      : pending.attempt > 1
        ? `Initially selected ${pending.initialProtocol} for higher yield, but switched to ${pending.finalPlan.protocol} due to risk constraints${memoryPart}. Successfully executed deposit.`
        : `Selected ${pending.finalPlan.protocol} with ${pending.finalPlan.apy}% APY${memoryPart}. Successfully executed deposit.`;

    const summary: ExecutionSummary = {
      selectedProtocol: pending.finalPlan.protocol,
      initialProtocol: pending.initialProtocol,
      finalProtocol: pending.finalPlan.protocol,
      wasRetried: pending.attempt > 1,
      reasonForRetry: pending.reasonForRetry,
      totalSteps: trace.length,
      confidence: avgConfidence,
      explanation,
      decisionImpact: pending.decisionImpact,
    };

    return {
      intent: pending.request.intent,
      trace,
      final_result: finalResult,
      summary,
      debug: {
        attempts: pending.attempt,
        initialSelection: { protocol: pending.initialProtocol },
        finalApprovedPlan: pending.finalPlan,
        riskDecision: pending.riskDecision,
        ensReputationScore: pending.ensReputationScore,
        ensInfluence: pending.ensInfluence,
        axlInfluence: pending.axlInfluence,
        memoryInfluence: pending.memoryInfluence
          ? {
              protocol: pending.memoryInfluence.protocol,
              hasHistory: pending.memoryInfluence.hasHistory,
              impact: pending.memoryInfluence.impact,
            }
          : undefined,
        confidenceBreakdown: {
          yield: pending.clampedYield,
          risk: pending.clampedRisk,
          execution: clampedExec,
        },
      },
    };
  }

  private cleanupPendingExecutions(): void {
    const now = Date.now();
    for (const [id, pending] of this.pendingExecutions.entries()) {
      if (pending.approval.expiresAt <= now) {
        this.pendingExecutions.delete(id);
      }
    }
  }

  private async selectRetryOptionByMemory(
    options: YieldOption[],
    rejectedProtocol: string,
    fallbackOption: YieldOption,
    memoryAdapter: ZeroGMemoryAdapter,
    trace: AgentTrace[],
    timestamp: number,
    externalMetadata?: Record<string, unknown>
  ): Promise<{ option: YieldOption; timestamp: number }> {
    if (!memoryAdapter.isEnabled()) return { option: fallbackOption, timestamp };

    const scoredOptions: Array<{
      option: YieldOption;
      successRate: number;
      avgConfidence: number;
      executionCount: number;
    }> = [];

    for (const option of options) {
      if (option.protocol.trim().toLowerCase() === rejectedProtocol.trim().toLowerCase()) continue;
      const stats = await memoryAdapter.getProtocolStats(option.protocol);
      if (!stats || stats.executionCount <= 0) continue;
      scoredOptions.push({
        option,
        successRate: stats.successRate,
        avgConfidence: stats.avgConfidence ?? 0,
        executionCount: stats.executionCount,
      });
    }

    if (scoredOptions.length === 0) return { option: fallbackOption, timestamp };

    scoredOptions.sort((a, b) => {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      if (b.avgConfidence !== a.avgConfidence) return b.avgConfidence - a.avgConfidence;
      if (b.option.apy !== a.option.apy) return b.option.apy - a.option.apy;
      return a.option.protocol.localeCompare(b.option.protocol);
    });

    const selected = scoredOptions[0]!;
    const metadata = {
      protocol: selected.option.protocol,
      successRate: selected.successRate,
      avgConfidence: selected.avgConfidence,
      executionCount: selected.executionCount,
      fallbackProtocol: fallbackOption.protocol,
      ...(externalMetadata ?? {}),
    };
    trace.push({
      agent: this.systemAgent,
      step: 'retry',
      message: `Memory retry preference: selected ${selected.option.protocol} using ${Math.round(selected.successRate * 100)}% success rate across ${selected.executionCount} executions`,
      metadata,
      timestamp,
    });

    return { option: selected.option, timestamp: timestamp + 10 };
  }

  private async persistExecutionMemory(
    memoryAdapter: ZeroGMemoryAdapter,
    intent: string,
    finalPlan: YieldOption,
    rejectedProtocol: string | undefined,
    confidence: number,
    trace: AgentTrace[],
    timestamp: number
  ): Promise<number> {
    await memoryAdapter.storeExecution({
      intent,
      selectedProtocol: finalPlan.protocol,
      rejectedProtocol,
      confidence,
      outcome: 'success',
      timestamp: Date.now(),
    });

    const unavailable = memoryAdapter.getLastUnavailableReason();
    if (unavailable) {
      trace.push({
        agent: this.systemAgent,
        step: 'memory',
        message: 'Memory unavailable — execution history not persisted',
        metadata: { memoryAvailable: false, reason: unavailable },
        timestamp,
      });
      return timestamp + 10;
    }

    trace.push({
      agent: this.systemAgent,
      step: 'memory',
      message: `Memory stored execution outcome for ${finalPlan.protocol}`,
      metadata: {
        selectedProtocol: finalPlan.protocol,
        rejectedProtocol,
        confidence,
        outcome: 'success',
      },
      timestamp,
    });
    return timestamp + 10;
  }

  private buildYieldUnavailableResponse(
    request: ExecutionRequest,
    trace: AgentTrace[],
    timestamp: number,
    ensContext: ENSReputationContext,
    error: unknown
  ): ExecutionResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);

    trace.push({
      agent: this.systemAgent,
      step: 'evaluate',
      message: `Yield data unavailable: ${errorMessage}`,
      metadata: { status: 'failed', reason: errorMessage },
      timestamp,
    });

    const finalResult: ExecutionResult = {
      protocol: 'unavailable',
      apy: '0%',
      action: 'deposit',
      status: 'failed',
      attempt: 0,
    };

    const explanation =
      'Could not select a protocol because no live or cached yield data was available.';

    return {
      intent: request.intent,
      trace,
      final_result: finalResult,
      summary: {
        selectedProtocol: finalResult.protocol,
        initialProtocol: finalResult.protocol,
        finalProtocol: finalResult.protocol,
        wasRetried: false,
        totalSteps: trace.length,
        confidence: 0,
        explanation,
        decisionImpact: {
          ens: `ENS reputation was computed (${ensContext.reputationScore}) but not applied to a yield decision`,
          axl: 'AXL consensus was not evaluated because yield data was unavailable',
        },
      },
      debug: {
        attempts: 0,
        ensReputationScore: ensContext.reputationScore,
        confidenceBreakdown: { yield: 0, risk: 0, execution: 0 },
        error: errorMessage,
      },
    };
  }
}
