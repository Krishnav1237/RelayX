// Core types for RelayX

export interface AgentTrace {
  agent: string;
  step: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface ExecutionResult {
  protocol: string;
  apy: string;
  action: string;
  status: 'success' | 'failed';
  attempt?: number;
}

export interface ExecutionSummary {
  selectedProtocol: string;
  initialProtocol: string;
  finalProtocol: string;
  wasRetried: boolean;
  reasonForRetry?: string;
  totalSteps: number;
  confidence: number;
  explanation: string;
}

export interface ExecutionRequest {
  intent: string;
  context?: Record<string, unknown>;
}

export interface ExecutionResponse {
  intent: string;
  trace: AgentTrace[];
  final_result: ExecutionResult;
  summary: ExecutionSummary;
  debug?: Record<string, unknown>;
}

export interface YieldOption {
  protocol: string;
  apy: number;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface YieldThinkResult {
  options: YieldOption[];
  selectedOption: YieldOption;
  reasoning: string;
  attempt: number;
}

export interface RiskReviewResult {
  decision: 'approve' | 'reject';
  reasoning: string;
  riskScore?: number;
  flags?: string[];
  ensInfluence?: {
    success_rate: number;
    impact: 'increased confidence' | 'decreased confidence';
  };
}

export interface RiskENSSignals {
  successRate?: number;
  reputation?: string;
  role?: string;
  sourceAgent?: string;
}
