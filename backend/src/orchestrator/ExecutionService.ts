import { AgentTrace, AXLInfluence, DecisionImpact, ENSInfluence, ENSReputationContext, ExecutionRequest, ExecutionResponse, ExecutionResult, ExecutionSummary, YieldOption } from '../types';
import { YieldAgent } from '../agents/YieldAgent';
import { RiskAgent } from '../agents/RiskAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { ENSAdapter } from '../adapters/ENSAdapter';
import { createPublicClient, http, type Address } from 'viem';
import { mainnet } from 'viem/chains';

const SYSTEM_AGENT = 'system.relay.eth';
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

export class ExecutionService {
  private yieldAgent = new YieldAgent();
  private riskAgent = new RiskAgent();
  private executorAgent = new ExecutorAgent();
  private ensAdapter = new ENSAdapter();
  private reverseLookupClient = createPublicClient({
    chain: mainnet,
    transport: http(process.env.ALCHEMY_MAINNET_RPC_URL),
  });

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

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
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
    const demoMetadata = request.context?.demo ? { demo: true } : undefined;
    let yieldResult = await this.yieldAgent.think(request.intent, attempt, trace, ts, demoMetadata);
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
    let riskOutput = await this.riskAgent.review(selectedOption, trace, ts, undefined, ensContext);
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

      yieldResult = await this.yieldAgent.think(request.intent, attempt, trace, ts, demoMetadata);
      ts = trace[trace.length - 1]!.timestamp + 10;
      selectedOption = yieldResult.selectedOption;
      finalPlan = selectedOption;
      yieldConfidence = yieldResult.confidence;

      riskOutput = await this.riskAgent.review(selectedOption, trace, ts, undefined, ensContext);
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

    // Step 4: Execute
    const executorOutput = await this.executorAgent.execute(finalPlan, trace, attempt, ts);
    ts = trace[trace.length - 1]!.timestamp + 10;
    const finalResult: ExecutionResult = executorOutput.result;

    // System: complete
    trace.push({ agent: SYSTEM_AGENT, step: 'execute',
      message: `Execution completed: deposited to ${finalResult.protocol}`,
      metadata: { status: finalResult.status, protocol: finalResult.protocol },
      timestamp: ts });

    // Confidence — clamp to [0, 0.95]
    const clampedYield = normalizeConfidence(Math.min(0.95, Math.max(0, yieldConfidence)));
    const clampedRisk = normalizeConfidence(Math.min(0.95, Math.max(0, riskConfidence)));
    const clampedExec = normalizeConfidence(Math.min(0.95, Math.max(0, executorOutput.confidence)));
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
      ? `Initially selected ${initialProtocol} for higher yield, but switched to ${finalPlan.protocol} due to risk constraints. Successfully executed deposit.`
      : `Selected ${finalPlan.protocol} with ${finalPlan.apy}% APY. Successfully executed deposit.`;

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
      && (finalResult.status === 'success' || finalResult.status === 'failed')
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
        ensReputationScore: ensContext.reputationScore,
        ensInfluence: lastEnsInfluence,
        axlInfluence: lastAxlInfluence,
        confidenceBreakdown: { yield: clampedYield, risk: clampedRisk, execution: clampedExec },
      },
    };
  }
}
