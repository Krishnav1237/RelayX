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
  context?: {
    ens?: string;
    wallet?: string;
  };
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
    reputationScore: number;
    sources: string[];
    primarySource: string;
    impact: 'increased confidence' | 'decreased confidence';
  };
}

export interface ENSReputationContext {
  sources: string[];
  resolved: string[];
  reputationScore: number;
}

export interface AXLMessage {
  from: string;
  to: string;
  type: 'yield_request' | 'risk_request' | 'execution_signal';
  payload: Record<string, unknown>;
  timestamp: number;
}
