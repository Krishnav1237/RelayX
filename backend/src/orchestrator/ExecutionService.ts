import { randomUUID } from 'crypto';
import { AgentTrace, AXLInfluence, DecisionImpact, ENSInfluence, ENSReputationContext, ExecutionApproval, ExecutionRequest, ExecutionResponse, ExecutionResult, ExecutionSummary, UniswapQuoteResult, YieldOption, YieldThinkResult } from '../types';
import { YieldAgent } from '../agents/YieldAgent';
import { RiskAgent } from '../agents/RiskAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { ENSAdapter } from '../adapters/ENSAdapter';
import { ZeroGMemoryAdapter } from '../adapters/ZeroGMemoryAdapter';
import { createPublicClient, http, type Address } from 'viem';
import { mainnet } from 'viem/chains';

const SYSTEM_AGENT = 'system.relay.eth';
const DEFAULT_ENS_SOURCES = ['ens.eth', 'nick.eth'] as const;
const MAX_ENS_SOURCES = 3;
const DEFAULT_MAINNET_RPC_URL = 'https://rpc.ankr.com/eth';
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
  decisionImpact: DecisionImpact;
  clampedYield: number;
  clampedRisk: number;
  preparedSwapQuote: UniswapQuoteResult | null;
  approval: ExecutionApproval;
}

const ENS_TIMEOUT_MS = 4000;
const APPROVAL_TTL_MS = 5 * 60 * 1000;

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

export class ExecutionService {
  private yieldAgent: YieldAgent;
  private riskAgent: RiskAgent;
  private executorAgent: ExecutorAgent;
  private ensAdapter: ENSAdapter;
  private memoryAdapter: ZeroGMemoryAdapter;
  private pendingExecutions = new Map<string, PendingExecution>();
  private reverseLookupClient = createPublicClient({
    chain: mainnet,
    transport: http(process.env.ALCHEMY_MAINNET_RPC_URL ?? DEFAULT_MAINNET_RPC_URL),
  });

  constructor(memoryAdapter = new ZeroGMemoryAdapter()) {
    this.memoryAdapter = memoryAdapter;
    this.yieldAgent = new YieldAgent();
    this.riskAgent = new RiskAgent(memoryAdapter);
    this.executorAgent = new ExecutorAgent();
    this.ensAdapter = new ENSAdapter();
  }

  // --- ENS helpers ---

  private async resolveENSSources(sourceNames: readonly string[]): Promise<ENSSourceSignal[]> {
    const results = await Promise.all(
      sourceNames.map(async (sourceName) => {
        let address: string | null = null;
        let records: Record<string, string> = {};
        try {
          address = await withTimeout(this.ensAdapter.resolveName(sourceName), ENS_TIMEOUT_MS, `resolveName ${sourceName}`);
        } catch (e) { console.error(`[ENS ERROR] ${sourceName} ${e instanceof Error ? e.message : e}`); }
        try {
          records = await withTimeout(this.ensAdapter.getTextRecords(sourceName), ENS_TIMEOUT_MS, `getTextRecords ${sourceName}`);
        } catch (e) { console.error(`[ENS ERROR] ${sourceName} ${e instanceof Error ? e.message : e}`); records = {}; }
        if (address === null && Object.keys(records).length === 0) return undefined;
        return { name: sourceName, address, records, score: this.computeSourceScore(sourceName, address, records) } satisfies ENSSourceSignal;
      })
    );
    return results.filter((r): r is ENSSourceSignal => r !== undefined);
  }

  private computeSourceScore(sourceName: string, address: string | null, records: Record<string, string>): number {
    const trusted = TRUSTED_ENS_SCORES[sourceName.toLowerCase()];
    if (trusted !== undefined) return normalizeConfidence(trusted);
    let score = 0.5;
    if (address) score += 0.2;
    if (Object.keys(records).length > 0) score += 0.1;
    if (records['com.github']) score += 0.05;
    if (records['com.twitter']) score += 0.05;
    return normalizeConfidence(score);
  }

  private buildENSContext(signals: ENSSourceSignal[], names: readonly string[]): ENSReputationContext {
    if (signals.length === 0) return { sources: [...names], resolved: [], reputationScore: 0.5 };
    const total = signals.reduce((s, x) => s + x.score, 0);
    return {
      sources: signals.map(s => s.name),
      resolved: signals.filter(s => s.address !== null).map(s => s.name),
      reputationScore: normalizeConfidence(total / signals.length),
    };
  }

  private isEnsName(value: unknown): value is string {
    return typeof value === 'string' && value.trim().toLowerCase().includes('.eth');
  }

  private normalizeEnsName(name: string): string { return name.trim().toLowerCase(); }

  private isWalletAddress(value: unknown): value is string {
    return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
  }

  private uniqEnsSources(sources: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of sources) {
      if (!this.isEnsName(s)) continue;
      const n = this.normalizeEnsName(s);
      if (!seen.has(n)) { seen.add(n); out.push(n); }
    }
    return out;
  }

  private async reverseLookupWalletENS(wallet: string): Promise<string | null> {
    try {
      const name = await withTimeout(this.reverseLookupClient.getEnsName({ address: wallet as Address }), ENS_TIMEOUT_MS, `reverseLookup ${wallet}`);
      if (this.isEnsName(name)) return this.normalizeEnsName(name);
    } catch (e) { console.error(`[ENS ERROR] reverse lookup ${wallet}: ${e instanceof Error ? e.message : e}`); }
    return null;
  }

  // --- Main execution ---

  async analyze(request: ExecutionRequest): Promise<ExecutionResponse> {
    const memoryAdapter = request.context?.demo === true ? ZeroGMemoryAdapter.demo() : this.memoryAdapter;
    const riskAgent = request.context?.demo === true ? new RiskAgent(memoryAdapter) : this.riskAgent;
    const traceMetadata = request.context?.demo === true ? { demo: true } : undefined;

    const defaultSources = [...DEFAULT_ENS_SOURCES];
    const userENS = this.isEnsName(request.context?.ens) ? this.normalizeEnsName(request.context.ens) : null;
    let walletENS: string | null = null;
    if (this.isWalletAddress(request.context?.wallet)) {
      walletENS = await this.reverseLookupWalletENS(request.context.wallet);
    }

    const dynamicSources: string[] = [];
    if (userENS) dynamicSources.push(userENS);
    if (walletENS) dynamicSources.push(walletENS);
    if (!userENS && !walletENS) dynamicSources.push('vitalik.eth');

    const finalENSSources = this.uniqEnsSources([...dynamicSources, ...defaultSources]).slice(0, MAX_ENS_SOURCES);

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
    trace.push({ agent: SYSTEM_AGENT, step: 'start',
      message: `Processing intent: "${request.intent}" — ENS reputation: ${ensContext.reputationScore.toFixed(2)}`,
      metadata: { ensSourcesUsed: finalENSSources, reputationScore: ensContext.reputationScore },
      timestamp: ts });
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

    // Step 2: RiskAgent
    let riskOutput = await riskAgent.review(selectedOption, trace, ts, traceMetadata, ensContext);
    ts = trace[trace.length - 1]!.timestamp + 10;
    let riskResult = riskOutput.result;
    riskConfidence = riskOutput.confidence;
    lastEnsInfluence = riskOutput.ensInfluence;
    lastAxlInfluence = riskOutput.axlInfluence;

    // Step 3: Retry if rejected OR if AXL forced retry
    const shouldRetry = (riskResult.decision === 'reject' || riskOutput.axlInfluence.decisionImpact === 'penalty')
      && attempt < maxAttempts;

    if (shouldRetry) {
      attempt++;
      reasonForRetry = riskResult.decision === 'reject'
        ? riskResult.reasoning
        : `AXL peer consensus triggered retry (approval ratio: ${riskOutput.axlInfluence.approvalRatio})`;

      trace.push({ agent: SYSTEM_AGENT, step: 'retry',
        message: `Retrying: ${reasonForRetry}`,
        metadata: {
          previousProtocol: selectedOption.protocol,
          previousApy: selectedOption.apy,
          ensInfluence: lastEnsInfluence,
          axlInfluence: lastAxlInfluence,
        },
        timestamp: ts });
      ts += 10;

      try {
        yieldResult = await this.yieldAgent.think(request.intent, attempt, trace, ts, traceMetadata);
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
    }

    // System: final plan
    trace.push({ agent: SYSTEM_AGENT, step: 'evaluate',
      message: `Final plan: ${finalPlan.protocol} at ${finalPlan.apy}% APY`,
      metadata: { protocol: finalPlan.protocol, apy: finalPlan.apy, riskLevel: finalPlan.riskLevel },
      timestamp: ts });
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

    trace.push({ agent: SYSTEM_AGENT, step: 'approval_required',
      message: `Approval required before executing ${finalPlan.protocol}`,
      metadata: { status: finalResult.status, protocol: finalResult.protocol, approvalRequired: true },
      timestamp: ts });
    ts += 10;

    // Confidence — clamp to [0, 0.95]
    const clampedYield = normalizeConfidence(Math.min(0.95, Math.max(0, yieldConfidence)));
    const clampedRisk = normalizeConfidence(Math.min(0.95, Math.max(0, riskConfidence)));
    const clampedExec = normalizeConfidence(0.9);
    const avgConfidence = normalizeConfidence((clampedYield + clampedRisk + clampedExec) / 3);

    // Decision impact — explicit ENS + AXL descriptions
    const ensImpactDesc = lastEnsInfluence
      ? lastEnsInfluence.tier === 'strong' ? `increased risk tolerance due to strong ENS (${lastEnsInfluence.reputationScore})`
        : lastEnsInfluence.tier === 'weak' ? `decreased risk tolerance due to weak ENS (${lastEnsInfluence.reputationScore})`
        : 'no ENS influence (neutral tier)'
      : 'no ENS context available';

    const axlImpactDesc = lastAxlInfluence
      ? lastAxlInfluence.decisionImpact === 'boost' ? `boosted confidence via peer agreement (${lastAxlInfluence.approvalRatio} approval)`
        : lastAxlInfluence.decisionImpact === 'penalty' ? `reduced confidence via peer disagreement (${lastAxlInfluence.approvalRatio} approval)`
        : lastAxlInfluence.decisionImpact === 'retry' ? `triggered retry due to peer disagreement`
        : 'no AXL influence on decision'
      : 'no AXL responses';

    const decisionImpact: DecisionImpact = { ens: ensImpactDesc, axl: axlImpactDesc };

    // Explanation
    const explanation = attempt > 1
      ? `Initially selected ${initialProtocol} for higher yield, but switched to ${finalPlan.protocol} due to risk constraints. Review and approve before execution.`
      : `Selected ${finalPlan.protocol} with ${finalPlan.apy}% APY. Review and approve before execution.`;

    // --- Section 3: Trace assertions ---
    const agentsSeen = new Set(trace.map(t => t.agent));
    const requiredAgents = ['system.relay.eth', 'yield.relay.eth', 'risk.relay.eth', 'executor.relay.eth'];
    for (const agent of requiredAgents) {
      if (!agentsSeen.has(agent)) {
        trace.push({ agent: SYSTEM_AGENT, step: 'normalize', message: `Trace normalized: missing entries from ${agent}`, timestamp: ts });
        ts += 10;
      }
    }

    // --- Section 4: Output contract validation ---
    const isValidResult = finalResult.protocol.length > 0
      && finalResult.apy.endsWith('%')
      && (finalResult.status === 'pending_approval' || finalResult.status === 'success' || finalResult.status === 'failed')
      && explanation.length > 10
      && ensImpactDesc.length > 0
      && axlImpactDesc.length > 0;

    if (!isValidResult) {
      trace.push({ agent: SYSTEM_AGENT, step: 'normalize', message: 'Execution completed with degraded validation safeguards', timestamp: ts });
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
      expiresAt: Date.now() + APPROVAL_TTL_MS,
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
        confidenceBreakdown: { yield: clampedYield, risk: clampedRisk, execution: clampedExec },
      },
    };
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const analysis = await this.analyze(request);
    if (!analysis.approval) {
      throw new Error('Execution approval was not created');
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
      agent: SYSTEM_AGENT,
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
      agent: SYSTEM_AGENT,
      step: 'execute',
      message: `Execution completed: deposited to ${finalResult.protocol}`,
      metadata: { status: finalResult.status, protocol: finalResult.protocol },
      timestamp: ts,
    });
    ts += 10;

    const clampedExec = normalizeConfidence(Math.min(0.95, Math.max(0, executorOutput.confidence)));
    const avgConfidence = normalizeConfidence((pending.clampedYield + pending.clampedRisk + clampedExec) / 3);

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

    const explanation = pending.attempt > 1
      ? `Initially selected ${pending.initialProtocol} for higher yield, but switched to ${pending.finalPlan.protocol} due to risk constraints. Successfully executed deposit.`
      : `Selected ${pending.finalPlan.protocol} with ${pending.finalPlan.apy}% APY. Successfully executed deposit.`;

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
        confidenceBreakdown: { yield: pending.clampedYield, risk: pending.clampedRisk, execution: clampedExec },
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

    const scoredOptions: Array<{ option: YieldOption; successRate: number; avgConfidence: number; executionCount: number }> = [];

    for (const option of options) {
      if (option.protocol.trim().toLowerCase() === rejectedProtocol.trim().toLowerCase()) continue;
      const stats = await memoryAdapter.getProtocolStats(option.protocol);
      if (!stats || stats.executionCount <= 0) continue;
      scoredOptions.push({
        option,
        successRate: stats.successRate,
        avgConfidence: stats.avgConfidence,
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
      agent: SYSTEM_AGENT,
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
        agent: SYSTEM_AGENT,
        step: 'memory',
        message: 'Memory unavailable — execution history not persisted',
        metadata: { memoryAvailable: false, reason: unavailable },
        timestamp,
      });
      return timestamp + 10;
    }

    trace.push({
      agent: SYSTEM_AGENT,
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
      agent: SYSTEM_AGENT,
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

    const explanation = 'Could not select a protocol because no live or cached yield data was available.';

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
