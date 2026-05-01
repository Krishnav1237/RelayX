import { BaseAgent } from './BaseAgent';
import { AXLInfluence, AXLMessage, AgentTrace, ENSInfluence, ENSReputationContext, ENSTier, RiskReviewResult, YieldOption } from '../types';
import { AXLAdapter } from '../adapters/AXLAdapter';
import { ReasoningAdapter } from '../adapters/ReasoningAdapter';
import { ProtocolStats, ZeroGMemoryAdapter } from '../adapters/ZeroGMemoryAdapter';

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(0.95, value)) * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getENSTier(score: number, hasContext: boolean): ENSTier {
  if (!hasContext) return 'neutral';
  if (score >= 0.9) return 'strong';
  if (score < 0.7) return 'weak';
  return 'neutral';
}

export class RiskAgent extends BaseAgent {
  private axlAdapter = new AXLAdapter();
  private reasoningAdapter = new ReasoningAdapter();

  constructor(private readonly memoryAdapter = new ZeroGMemoryAdapter()) {
    super('risk.relay.eth', 'risk.relay.eth');
  }

  async review(
    plan: YieldOption,
    trace: AgentTrace[],
    timestamp: number,
    externalMetadata?: Record<string, unknown>,
    ensContext?: ENSReputationContext
  ): Promise<{ result: RiskReviewResult; confidence: number; axlInfluence: AXLInfluence; ensInfluence: ENSInfluence }> {
    let ts = timestamp;
    const reputationScore = this.normalizeScore(ensContext?.reputationScore ?? 0.5);
    const ensTier = getENSTier(reputationScore, ensContext !== undefined);

    const mediumRiskApyThreshold = ensTier === 'strong' ? 4.55
      : ensTier === 'weak' ? 4.4
      : 4.5;

    const ensInfluence: ENSInfluence = {
      tier: ensTier,
      reputationScore,
      effect: ensTier === 'strong' ? 'increased tolerance'
        : ensTier === 'weak' ? 'decreased tolerance'
        : 'none',
    };

    // Step: review start with ENS context
    trace.push(this.log('review',
      `Reviewing ${plan.protocol} (${plan.apy}% APY, ${plan.riskLevel ?? 'unknown'} risk) — ENS tier: ${ensTier} (${reputationScore.toFixed(2)})`,
      { apy: plan.apy, riskLevel: plan.riskLevel, ensInfluence },
      ts, externalMetadata));
    ts += 10;

    const flags: string[] = [];
    let riskScore = 0;
    let confidenceAdjustment = 0;

    // Base risk scoring
    if (plan.riskLevel === 'high') {
      flags.push('Protocol has high risk profile');
      riskScore += 60;
    } else if (plan.riskLevel === 'medium' && plan.apy >= mediumRiskApyThreshold) {
      flags.push(`Medium risk with APY (${plan.apy}%) exceeds ENS-adjusted threshold (${mediumRiskApyThreshold}%)`);
      riskScore += 40;
    } else if (plan.riskLevel === 'medium') {
      riskScore += 20;
      // Task 2: If medium risk and APY is very close to threshold, add extra scrutiny
      if (plan.apy >= mediumRiskApyThreshold - 0.2) {
        flags.push(`Medium risk APY (${plan.apy}%) approaching threshold (${mediumRiskApyThreshold}%)`);
        riskScore += 15;
      }
    }

    // ENS influence on confidence — clear +/- 0.1
    if (ensTier === 'strong') {
      riskScore = Math.max(0, riskScore - 5);
      confidenceAdjustment += 0.1;
    } else if (ensTier === 'weak') {
      flags.push(`Weak ENS reputation (${reputationScore.toFixed(2)})`);
      riskScore += 15;
      confidenceAdjustment -= 0.1;
    }

    // AXL consensus
    const axlMessage: AXLMessage = {
      from: this.name,
      to: 'axl.network',
      type: 'risk_request',
      payload: { protocol: plan.protocol, apy: plan.apy, riskLevel: plan.riskLevel ?? 'unknown' },
      timestamp: Date.now(),
    };

    let remoteResponses: unknown[] = [];
    try {
      remoteResponses = await this.axlAdapter.broadcast(axlMessage);
    } catch {
      remoteResponses = [];
    }

    const consensus = this.extractConsensus(remoteResponses);
    const approvalRatio = consensus.total > 0 ? consensus.approve / consensus.total : 0.5;

    // AXL influence — clear thresholds
    let axlDecisionImpact: AXLInfluence['decisionImpact'] = 'none';
    if (consensus.total > 0) {
      if (approvalRatio >= 0.7) {
        confidenceAdjustment += 0.1;
        axlDecisionImpact = 'boost';
      } else if (approvalRatio < 0.3) {
        confidenceAdjustment -= 0.1;
        axlDecisionImpact = 'penalty';
      }
    }

    const axlInfluence: AXLInfluence = {
      approvalRatio: Math.round(approvalRatio * 100) / 100,
      decisionImpact: axlDecisionImpact,
      isSimulated: false,
    };

    // Task 3: AXL trace — clear about empty vs live
    const hasAXLPeers = consensus.total > 0;
    const axlImpactLabel = axlDecisionImpact === 'boost' ? '→ boosting confidence'
      : axlDecisionImpact === 'penalty' ? '→ reducing confidence'
      : '';
    const axlTraceMsg = hasAXLPeers
      ? `AXL live peers: ${consensus.approve}/${consensus.total} approved ${axlImpactLabel}`.trim()
      : 'AXL: no peers available — proceeding with local decision';
    trace.push(this.log('review', axlTraceMsg, { axlInfluence }, ts, externalMetadata));
    ts += 10;

    const memoryResult = await this.applyMemoryInfluence(plan, trace, ts, externalMetadata);
    riskScore += memoryResult.riskScoreDelta;
    confidenceAdjustment += memoryResult.confidenceDelta;
    if (memoryResult.flag) flags.push(memoryResult.flag);
    ts = memoryResult.timestamp;

    // Decision
    const decision: 'approve' | 'reject' = riskScore >= 35 ? 'reject' : 'approve';
    const confidenceBase = decision === 'approve' ? 0.85 : 0.5;
    let confidence = normalizeConfidence(confidenceBase - (riskScore / 250) + confidenceAdjustment);

    // Phase 6: Optional LLM confidence blending
    // Phase 6: Optional LLM confidence blending
    if (this.reasoningAdapter.isEnabled()) {
      const llmResult = await this.reasoningAdapter.evaluateRisk(plan, reputationScore);
      if (llmResult !== null) {
        confidence = normalizeConfidence(confidence * 0.7 + llmResult.confidence * 0.3);
        trace.push(this.log('review',
          `LLM reasoning applied (confidence adjusted to ${confidence})`,
          { llmConfidence: llmResult.confidence, llmReasoning: llmResult.reasoning, blendedConfidence: confidence },
          ts, externalMetadata));
        ts += 10;
      }
    }

    // Build reasoning with explicit ENS + AXL mentions
    const reasoning = this.buildReasoning(plan, decision, ensTier, reputationScore, flags);

    trace.push(this.log('review', reasoning, {
      riskScore, decision, confidence, ensInfluence, axlInfluence,
      flags: flags.length > 0 ? flags : undefined,
    }, ts, externalMetadata));

    return {
      result: { decision, reasoning, riskScore, flags: flags.length > 0 ? flags : undefined, ensInfluence, axlInfluence },
      confidence,
      axlInfluence,
      ensInfluence,
    };
  }

  private extractConsensus(responses: unknown[]): { approve: number; reject: number; total: number } {
    let approve = 0;
    let reject = 0;
    for (const response of responses) {
      if (!isRecord(response)) continue;
      const d = typeof response.decision === 'string' ? response.decision
        : isRecord(response.payload) && typeof response.payload.decision === 'string' ? response.payload.decision
        : undefined;
      if (d === 'approve') approve++;
      else if (d === 'reject') reject++;
    }
    return { approve, reject, total: approve + reject };
  }

  private normalizeScore(value: number): number {
    if (!Number.isFinite(value)) return 0.5;
    return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
  }

  private async applyMemoryInfluence(
    plan: YieldOption,
    trace: AgentTrace[],
    timestamp: number,
    externalMetadata?: Record<string, unknown>
  ): Promise<{ confidenceDelta: number; riskScoreDelta: number; timestamp: number; flag?: string }> {
    let ts = timestamp;
    const stats = await this.memoryAdapter.getProtocolStats(plan.protocol);

    if (!stats) {
      if (this.memoryAdapter.getLastUnavailableReason()) {
        trace.push(this.log('review',
          'Memory unavailable — proceeding without historical context',
          { memoryAvailable: false },
          ts, externalMetadata));
        ts += 10;
      }
      return { confidenceDelta: 0, riskScoreDelta: 0, timestamp: ts };
    }

    const influence = this.computeMemoryInfluence(stats);
    if (!influence) return { confidenceDelta: 0, riskScoreDelta: 0, timestamp: ts };

    const successPercent = Math.round(stats.successRate * 100);
    const message = influence.influence === 'positive'
      ? `Memory: ${stats.protocol} has ${successPercent}% success rate across ${stats.executionCount} executions → increasing confidence`
      : `Memory: ${stats.protocol} has ${successPercent}% success rate across ${stats.executionCount} executions → decreasing confidence and adding risk`;

    trace.push(this.log('review', message, {
      successRate: stats.successRate,
      executionCount: stats.executionCount,
      avgConfidence: stats.avgConfidence,
      influence: influence.influence,
    }, ts, externalMetadata));
    ts += 10;

    return {
      confidenceDelta: influence.confidenceDelta,
      riskScoreDelta: influence.riskScoreDelta,
      timestamp: ts,
      flag: influence.influence === 'negative'
        ? `Memory reports low historical success (${successPercent}%) for ${stats.protocol}`
        : undefined,
    };
  }

  private computeMemoryInfluence(stats: ProtocolStats): { influence: 'positive' | 'negative'; confidenceDelta: number; riskScoreDelta: number } | null {
    if (stats.executionCount <= 0) return null;
    if (stats.successRate > 0.9) {
      return { influence: 'positive', confidenceDelta: 0.05, riskScoreDelta: 0 };
    }
    if (stats.successRate < 0.6) {
      return { influence: 'negative', confidenceDelta: -0.05, riskScoreDelta: 10 };
    }
    return null;
  }

  private buildReasoning(
    plan: YieldOption,
    decision: 'approve' | 'reject',
    ensTier: ENSTier,
    reputationScore: number,
    flags: string[]
  ): string {
    const risk = plan.riskLevel ?? 'unknown';
    const ensLabel = ensTier === 'strong' ? `strong ENS backing (${reputationScore.toFixed(2)})`
      : ensTier === 'weak' ? `weak ENS reputation (${reputationScore.toFixed(2)})`
      : `neutral ENS (${reputationScore.toFixed(2)})`;

    if (decision === 'reject') {
      return `Rejected ${plan.protocol} due to ${risk} risk and ${ensLabel}. Flags: ${flags.join('; ')}`;
    }
    return `Approved ${plan.protocol} due to ${risk} risk and ${ensLabel}`;
  }
}
