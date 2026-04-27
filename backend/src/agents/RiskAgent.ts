import { BaseAgent } from './BaseAgent';
import { AgentTrace, RiskENSSignals, RiskReviewResult, YieldOption } from '../types';

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
    ensSignals?: RiskENSSignals
  ): RiskReviewResult {
    let ts = timestamp;
    const successRate = this.normalizeSuccessRate(ensSignals?.successRate);
    const reputation = ensSignals?.reputation?.trim();
    const role = ensSignals?.role?.trim();
    const ensInfluence = this.getENSInfluence(successRate);
    const mediumRiskApyThreshold = successRate !== undefined
      ? successRate > 0.9
        ? 5.0
        : successRate < 0.7
          ? 4.0
          : 4.5
      : 4.5;
    const normalizedReputation = reputation?.toLowerCase();
    const normalizedRole = role?.toLowerCase();

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

    // ENS success-rate influence.
    if (successRate !== undefined) {
      if (successRate < 0.7) {
        flags.push(`Low historical success rate (${successRate.toFixed(2)})`);
        riskScore += 15;
        confidenceAdjustment -= 0.12;
      } else if (successRate > 0.9) {
        riskScore = Math.max(0, riskScore - 10);
        confidenceAdjustment += 0.08;
      }
    }

    // ENS reputation influence.
    if (normalizedReputation) {
      if (/(low|poor|weak|untrusted|risky)/.test(normalizedReputation)) {
        flags.push(`ENS reputation indicates elevated risk (${reputation})`);
        riskScore += 10;
        confidenceAdjustment -= 0.05;
      } else if (/(high|strong|trusted|excellent)/.test(normalizedReputation)) {
        riskScore = Math.max(0, riskScore - 8);
        confidenceAdjustment += 0.05;
      }
    }

    // ENS role influence.
    if (normalizedRole) {
      if (normalizedRole.includes('guardian') || normalizedRole.includes('auditor')) {
        riskScore = Math.max(0, riskScore - 5);
        confidenceAdjustment += 0.03;
      } else if (normalizedRole.includes('experimental') || normalizedRole.includes('beta')) {
        flags.push(`ENS role indicates experimental behavior (${role})`);
        riskScore += 5;
        confidenceAdjustment -= 0.03;
      }
    }

    const decision: 'approve' | 'reject' = riskScore >= 40 ? 'reject' : 'approve';
    const confidenceBase = decision === 'approve' ? 0.9 : 0.55;
    const confidence = normalizeConfidence(confidenceBase - (riskScore / 250) + confidenceAdjustment);
    const reasoning = this.buildReasoning({
      plan,
      decision,
      successRate,
      reputation,
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
      ensInfluence,
    };
  }

  private normalizeSuccessRate(value: number | undefined): number | undefined {
    if (value === undefined || !Number.isFinite(value)) {
      return undefined;
    }

    const normalized = value > 1 ? value / 100 : value;
    return Math.round(Math.max(0, Math.min(1, normalized)) * 100) / 100;
  }

  private getENSInfluence(
    successRate: number | undefined
  ): RiskReviewResult['ensInfluence'] | undefined {
    if (successRate === undefined) {
      return undefined;
    }

    if (successRate >= 0.7 && successRate <= 0.9) {
      return undefined;
    }

    return {
      success_rate: successRate,
      impact: successRate > 0.9 ? 'increased confidence' : 'decreased confidence',
    };
  }

  private buildReasoning(params: {
    plan: YieldOption;
    decision: 'approve' | 'reject';
    successRate: number | undefined;
    reputation: string | undefined;
    flags: string[];
  }): string {
    const { plan, decision, successRate, reputation, flags } = params;
    const riskLevel = plan.riskLevel ?? 'unknown';
    const reputationSuffix = reputation ? ` and ENS reputation "${reputation}"` : '';

    if (decision === 'reject' && successRate !== undefined && successRate < 0.7) {
      return `Rejected ${plan.protocol} due to ${riskLevel} risk and low historical success rate (${successRate.toFixed(2)})${reputationSuffix}`;
    }

    if (decision === 'approve' && successRate !== undefined && successRate > 0.9) {
      return `Approved ${plan.protocol} due to ${riskLevel} risk and high success rate (${successRate.toFixed(2)})${reputationSuffix}`;
    }

    if (decision === 'approve') {
      return `Approved ${plan.protocol}: ${riskLevel} risk at ${plan.apy}% APY with ENS-adjusted review${reputationSuffix}`;
    }

    return `Rejected ${plan.protocol}: ${flags.join('; ')}`;
  }
}
