import { BaseAgent } from './BaseAgent';
import { AgentTrace, ENSReputationContext, RiskReviewResult, YieldOption } from '../types';

function normalizeConfidence(value: number): number {
  // Cap at 0.95 for risk agent - never return 1.0
  return Math.round(Math.max(0, Math.min(0.95, value)) * 100) / 100;
}

export class RiskAgent extends BaseAgent {
  constructor() {
    super('risk.relay.eth', 'risk.relay.eth');
  }

  review(
    plan: YieldOption,
    trace: AgentTrace[],
    timestamp: number,
    externalMetadata?: Record<string, unknown>,
    ensContext?: ENSReputationContext
  ): RiskReviewResult {
    let ts = timestamp;
    const reputationScore = this.normalizeReputationScore(ensContext?.reputationScore ?? 0.5);
    const sources = ensContext?.sources ?? [];
    const primarySource = sources[0] ?? 'unknown';
    const hasStrongENS = reputationScore > 0.85;
    const hasWeakENS = reputationScore < 0.7;
    const ensInfluence = this.getENSInfluence(reputationScore, sources, primarySource, hasStrongENS, hasWeakENS);
    const mediumRiskApyThreshold = hasStrongENS
      ? 4.6
      : hasWeakENS
        ? 4.2
        : 4.5;

    // Step: review start
    trace.push(this.log('review', `Reviewing risk profile for ${plan.protocol} (${plan.apy}% APY)`, {
      apy: plan.apy,
      riskLevel: plan.riskLevel,
      ...(ensInfluence ? { ensInfluence } : {}),
    }, ts, externalMetadata));
    ts += 10;

    const flags: string[] = [];
    let riskScore = 0;
    let confidenceAdjustment = 0;

    // Base risk from APY + risk level.
    if (plan.riskLevel === 'high') {
      flags.push('Protocol has high risk profile');
      riskScore += 60;
    } else if (plan.riskLevel === 'medium' && plan.apy > mediumRiskApyThreshold) {
      flags.push(
        `Medium risk with APY (${plan.apy}%) exceeds ENS-adjusted threshold (${mediumRiskApyThreshold}%)`
      );
      riskScore += 40;
    } else if (plan.riskLevel === 'medium') {
      riskScore += 20;
    }

    // ENS reputation influence.
    if (hasWeakENS) {
      flags.push(`Weak ENS reputation signals (${reputationScore.toFixed(2)})`);
      riskScore += 15;
      confidenceAdjustment -= 0.12;
    } else if (hasStrongENS) {
      riskScore = Math.max(0, riskScore - 5);
      confidenceAdjustment += 0.04;
    }

    const decision: 'approve' | 'reject' = riskScore >= 40 ? 'reject' : 'approve';
    const confidenceBase = decision === 'approve' ? 0.9 : 0.55;
    const confidence = normalizeConfidence(confidenceBase - (riskScore / 250) + confidenceAdjustment);
    const reasoning = this.buildReasoning({
      plan,
      decision,
      reputationScore,
      primarySource,
      flags,
    });

    // Step: final decision
    trace.push(this.log('review', reasoning, {
      apy: plan.apy,
      riskScore,
      flags: flags.length > 0 ? flags : undefined,
      decision,
      confidence,
      ...(ensInfluence ? { ensInfluence } : {}),
    }, ts, externalMetadata));

    return {
      decision,
      reasoning,
      riskScore,
      flags: flags.length > 0 ? flags : undefined,
      ...(ensInfluence ? { ensInfluence } : {}),
    };
  }

  private normalizeReputationScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0.5;
    }

    return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
  }

  private getENSInfluence(
    reputationScore: number,
    sources: string[],
    primarySource: string,
    hasStrongENS: boolean,
    hasWeakENS: boolean
  ): RiskReviewResult['ensInfluence'] | undefined {
    if (!hasStrongENS && !hasWeakENS) {
      return undefined;
    }

    return {
      reputationScore,
      sources,
      primarySource,
      impact: hasStrongENS ? 'increased confidence' : 'decreased confidence',
    };
  }

  private buildReasoning(params: {
    plan: YieldOption;
    decision: 'approve' | 'reject';
    reputationScore: number;
    primarySource: string;
    flags: string[];
  }): string {
    const { plan, decision, reputationScore, primarySource, flags } = params;
    const riskLevel = plan.riskLevel ?? 'unknown';
    const sourceClause = `primarily influenced by ${primarySource}`;

    if (decision === 'reject' && reputationScore < 0.7) {
      return `Rejected ${plan.protocol} due to ${riskLevel} risk and weak ENS reputation signals (${reputationScore.toFixed(2)}) ${sourceClause}`;
    }

    if (decision === 'approve' && reputationScore > 0.85 && riskLevel === 'medium') {
      return `Approved ${plan.protocol} due to strong ENS reputation (${reputationScore.toFixed(2)}) allowing slightly higher risk tolerance ${sourceClause}`;
    }

    if (decision === 'approve' && reputationScore > 0.85) {
      return `Approved ${plan.protocol} due to ${riskLevel} risk and strong ENS reputation (${reputationScore.toFixed(2)}) ${sourceClause}`;
    }

    if (decision === 'approve') {
      return `Approved ${plan.protocol} due to ${riskLevel} risk and ENS reputation (${reputationScore.toFixed(2)}) ${sourceClause}`;
    }

    return `Rejected ${plan.protocol}: ${flags.join('; ')} ${sourceClause}`;
  }
}
