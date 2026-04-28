import { AgentTrace, ENSReputationContext, ExecutionRequest, ExecutionResponse, ExecutionResult, ExecutionSummary, YieldOption } from '../types';
import { YieldAgent } from '../agents/YieldAgent';
import { RiskAgent } from '../agents/RiskAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { ENSAdapter } from '../adapters/ENSAdapter';
import { createPublicClient, http, type Address } from 'viem';
import { mainnet } from 'viem/chains';

const SYSTEM_AGENT = 'system.relay.eth';
const DEFAULT_ENS_SOURCES = ['ens.eth', 'nick.eth'] as const;
const AGENT_ENS = ['yield.relay.eth', 'risk.relay.eth'] as const;
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

  private async resolveENSSources(sourceNames: readonly string[]): Promise<ENSSourceSignal[]> {
    console.log('[EXEC] Starting ENS resolution');
    const results = await Promise.all(
      sourceNames.map(async (sourceName) => {
        const sourceStart = Date.now();
        console.log(`[ENS] Resolving ${sourceName}`);

        let address: string | null = null;
        let records: Record<string, string> = {};

        try {
          address = await withTimeout(
            this.ensAdapter.resolveName(sourceName),
            ENS_TIMEOUT_MS,
            `resolveName ${sourceName}`
          );
          console.log(`[ENS] Address: ${address ?? 'null'}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[ENS ERROR] ${sourceName} ${message}`);
        }

        try {
          records = await withTimeout(
            this.ensAdapter.getTextRecords(sourceName),
            ENS_TIMEOUT_MS,
            `getTextRecords ${sourceName}`
          );
          console.log('[ENS] Records fetched');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[ENS ERROR] ${sourceName} ${message}`);
          records = {};
        }

        const elapsed = Date.now() - sourceStart;
        console.log(`[ENS] Time: ${elapsed}ms`);

        if (address === null && Object.keys(records).length === 0) {
          return undefined;
        }

        const score = this.computeSourceScore(sourceName, address, records);
        return {
          name: sourceName,
          address,
          records,
          score,
        } satisfies ENSSourceSignal;
      })
    );

    const sourceSignals = results.filter((result): result is ENSSourceSignal => result !== undefined);

    console.log('[EXEC] ENS resolution complete');
    return sourceSignals;
  }

  private computeSourceScore(
    sourceName: string,
    address: string | null,
    records: Record<string, string>
  ): number {
    const trustedScore = TRUSTED_ENS_SCORES[sourceName.toLowerCase()];
    if (trustedScore !== undefined) {
      return normalizeConfidence(trustedScore);
    }

    let score = 0.5;
    if (address) {
      score += 0.2;
    }
    if (Object.keys(records).length > 0) {
      score += 0.1;
    }
    return normalizeConfidence(Math.max(0, Math.min(1, score)));
  }

  private buildENSContext(
    sourceSignals: ENSSourceSignal[],
    sourceNames: readonly string[]
  ): ENSReputationContext {
    if (sourceSignals.length === 0) {
      return {
        sources: [...sourceNames],
        resolved: [],
        reputationScore: 0.5,
      };
    }

    const total = sourceSignals.reduce((sum, source) => sum + source.score, 0);
    return {
      sources: sourceSignals.map((source) => source.name),
      resolved: sourceSignals.filter((source) => source.address !== null).map((source) => source.name),
      reputationScore: normalizeConfidence(total / sourceSignals.length),
    };
  }

  private withENSContextMetadata(
    metadata: Record<string, unknown> | undefined,
    ensContext: ENSReputationContext,
    sourceSignals: ENSSourceSignal[]
  ): Record<string, unknown> {
    return {
      ...(metadata ?? {}),
      ensContext: {
        ...ensContext,
        sourceProfiles: sourceSignals.map((source) => ({
          name: source.name,
          address: source.address,
          records: source.records,
          score: source.score,
        })),
      },
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
    const deduped: string[] = [];
    const seen = new Set<string>();

    for (const source of sources) {
      if (!this.isEnsName(source)) {
        continue;
      }

      const normalized = this.normalizeEnsName(source);
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      deduped.push(normalized);
    }

    return deduped;
  }

  private async reverseLookupWalletENS(wallet: string): Promise<string | null> {
    try {
      const ensName = await withTimeout(
        this.reverseLookupClient.getEnsName({ address: wallet as Address }),
        ENS_TIMEOUT_MS,
        `reverseLookup ${wallet}`
      );

      if (this.isEnsName(ensName)) {
        return this.normalizeEnsName(ensName);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ENS ERROR] wallet reverse lookup failed for ${wallet}: ${message}`);
    }

    return null;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    console.log('[EXEC] Execution start', { intent: request.intent });
    const defaultSources = [...DEFAULT_ENS_SOURCES];
    const dynamicSources: string[] = [];

    if (this.isEnsName(request.context?.ens)) {
      dynamicSources.push(this.normalizeEnsName(request.context.ens));
    }

    if (dynamicSources.length === 0) {
      dynamicSources.push('vitalik.eth');
    }

    let walletENS: string | null = null;
    if (this.isWalletAddress(request.context?.wallet)) {
      walletENS = await this.reverseLookupWalletENS(request.context.wallet);
    }

    const baseSources = this.uniqEnsSources([...dynamicSources, ...defaultSources]);
    const prioritizedSources = walletENS
      ? this.uniqEnsSources([walletENS, ...baseSources])
      : baseSources;

    const agentProfiles = await Promise.all(
      AGENT_ENS.map(async (name) => {
        const address = await this.ensAdapter.resolveName(name);
        return address ? name : null;
      })
    );
    const validAgentENS = this.uniqEnsSources(
      agentProfiles.flatMap((name) => (name ? [name] : []))
    );

    const finalENSSources = this.uniqEnsSources([
      ...prioritizedSources,
      ...validAgentENS,
    ]).slice(0, MAX_ENS_SOURCES);

    console.log('[EXEC] ENS sources', finalENSSources);

    const trace: AgentTrace[] = [];
    const maxAttempts = 2;
    const baseTime = Date.now();
    let ts = baseTime;

    const ensSourceSignals = await this.resolveENSSources(finalENSSources);
    const ensContext = this.buildENSContext(ensSourceSignals, finalENSSources);
    console.log(`[EXEC] Reputation score: ${ensContext.reputationScore}`);
    const systemENSMetadata = this.withENSContextMetadata({
      ensSourcesUsed: finalENSSources,
      userENS: this.isEnsName(request.context?.ens)
        ? this.normalizeEnsName(request.context.ens)
        : null,
      walletENS,
    }, ensContext, ensSourceSignals);

    // System: execution start
    trace.push({
      agent: SYSTEM_AGENT,
      step: 'start',
      message: `Processing user intent: "${request.intent}"`,
      metadata: systemENSMetadata,
      timestamp: ts,
    });
    ts += 10;

    // Step 1: YieldAgent thinks (attempt 1)
    console.log('[EXEC] Before YieldAgent');
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
    console.log('[EXEC] Before RiskAgent');
    let riskResult = this.riskAgent.review(selectedOption, trace, ts, undefined, ensContext);
    ts = trace[trace.length - 1]!.timestamp + 10;

    // Extract confidence from trace metadata
    const lastRiskTrace = trace[trace.length - 1];
    if (lastRiskTrace?.metadata?.confidence !== undefined) {
      riskConfidence = lastRiskTrace.metadata.confidence as number;
    }

    // Step 3: If rejected, retry once
    if (riskResult.decision === 'reject' && attempt < maxAttempts) {
      console.log('[EXEC] Before retry');
      attempt++;
      reasonForRetry = riskResult.reasoning;

      // System: retry decision
      trace.push({
        agent: SYSTEM_AGENT,
        step: 'retry',
        message: `Retrying with alternative protocol due to risk rejection`,
        metadata: this.withENSContextMetadata({
          previousSelection: {
            protocol: selectedOption.protocol,
            apy: selectedOption.apy,
            riskLevel: selectedOption.riskLevel,
          },
          rejectionReason: riskResult.reasoning,
        }, ensContext, ensSourceSignals),
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
      riskResult = this.riskAgent.review(selectedOption, trace, ts, undefined, ensContext);
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
      metadata: this.withENSContextMetadata({
        protocol: finalPlan.protocol,
        apy: finalPlan.apy,
        riskLevel: finalPlan.riskLevel,
      }, ensContext, ensSourceSignals),
      timestamp: ts,
    });
    ts += 10;

    // Step 4: ExecutorAgent executes
    console.log('[EXEC] Before ExecutorAgent');
    const finalResult: ExecutionResult = this.executorAgent.execute(finalPlan, trace, attempt, ts);
    ts = trace[trace.length - 1]!.timestamp + 10;

    // System: execution complete
    trace.push({
      agent: SYSTEM_AGENT,
      step: 'execute',
      message: `Execution completed: deposited to ${finalResult.protocol}`,
      metadata: this.withENSContextMetadata({
        status: finalResult.status,
        protocol: finalResult.protocol,
      }, ensContext, ensSourceSignals),
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

    const response: ExecutionResponse = {
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

    console.log('[EXEC] Before returning response');
    console.log('[EXEC] Execution complete');
    return response;
  }
}
