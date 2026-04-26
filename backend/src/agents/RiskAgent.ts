import { BaseAgent } from './BaseAgent';
import { AgentTrace, YieldOption, RiskReviewResult } from '../types';

function normalizeConfidence(value: number): number {
  // Cap at 0.95 for risk agent - never return 1.0
  return Math.round(Math.max(0, Math.min(0.95, value)) * 100) / 100;
}

export class RiskAgent extends BaseAgent {
  constructor() {
    super('risk.relay.eth', 'risk.relay.eth');
  }

  review(plan: YieldOption, trace: AgentTrace[], timestamp: number): RiskReviewResult {
    let ts = timestamp;

    // Step: review start
    trace.push(this.log('review', `Reviewing risk profile for ${plan.protocol} (${plan.apy}% APY)`, {
      apy: plan.apy,
      riskLevel: plan.riskLevel,
    }, ts));
    ts += 10;

    const flags: string[] = [];
    let riskScore = 0;

    // Risk decision logic with meaningful trade-offs
    // Reject if: riskLevel is "high" OR (riskLevel is "medium" AND APY > 4.5)
    // Approve if: riskLevel is "low" OR (riskLevel is "medium" AND APY <= 4.5)

    if (plan.riskLevel === 'high') {
      flags.push('Protocol has high risk profile');
      riskScore += 60;
    } else if (plan.riskLevel === 'medium' && plan.apy > 4.5) {
      flags.push(`Medium risk with high APY (${plan.apy}%) exceeds acceptable risk-reward threshold`);
      riskScore += 40;
    } else if (plan.riskLevel === 'medium') {
      riskScore += 20;
    }

    // Calculate confidence: lower risk score = higher confidence, capped at 0.95
    // Use range 0.85-0.95 for strong approvals, lower for rejections
    let confidence: number;
    if (flags.length > 0) {
      confidence = normalizeConfidence(0.5 - (riskScore / 200));
    } else {
      confidence = normalizeConfidence(0.95 - (riskScore / 200));
    }

    // Determine decision
    const decision: 'approve' | 'reject' = flags.length > 0 ? 'reject' : 'approve';
    const reasoning = decision === 'approve'
      ? `Approved ${plan.protocol}: acceptable risk profile (${plan.riskLevel ?? 'unknown'} risk, ${plan.apy}% APY)`
      : `Rejected ${plan.protocol}: ${flags.join('; ')}`;

    // Step: final decision
    trace.push(this.log('review', reasoning, {
      apy: plan.apy,
      riskScore,
      flags: flags.length > 0 ? flags : undefined,
      decision,
      confidence,
    }, ts));

    return {
      decision,
      reasoning,
      riskScore,
      flags: flags.length > 0 ? flags : undefined,
    };
  }
}
