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
  status: 'pending_approval' | 'success' | 'failed';
  attempt?: number;
  swap?: UniswapQuoteResult;
  /** Indicates whether the swap was prepared (awaiting signature) or executed on-chain */
  executionMode?: 'prepared' | 'executed';
}

export interface UniswapQuoteResult {
  amountOut: string;
  priceImpact: number;
  gasEstimate: string;
  route: string;
  source: 'uniswap' | 'uniswap-v3-quoter' | 'coingecko' | 'cache';
  lastUpdatedAt?: number;
  rawAmountOut?: string;
  chainId?: number;
  fee?: number;
  rate?: number;
}

export type ENSTier = 'strong' | 'neutral' | 'weak';
export type AXLDecisionImpact = 'boost' | 'penalty' | 'retry' | 'none';

export interface ENSInfluence {
  tier: ENSTier;
  reputationScore: number;
  effect: 'increased tolerance' | 'decreased tolerance' | 'none';
}

export interface AXLInfluence {
  approvalRatio: number;
  decisionImpact: AXLDecisionImpact;
  isSimulated: boolean;
}

export interface DecisionImpact {
  ens: string;
  axl: string;
  memory?: string;
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
  decisionImpact: DecisionImpact;
}

export interface ExecutionRequest {
  intent: string;
  context?: {
    ens?: string;
    wallet?: string;
    demo?: boolean;
    debug?: boolean;
  };
}

export interface ExecutionResponse {
  intent: string;
  trace: AgentTrace[];
  final_result: ExecutionResult;
  summary: ExecutionSummary;
  approval?: ExecutionApproval;
  debug?: Record<string, unknown>;
}

export interface ExecutionApproval {
  id: string;
  expiresAt: number;
}

export interface ExecutionApprovalRequest {
  approvalId: string;
}

export interface YieldOption {
  protocol: string;
  apy: number;
  riskLevel?: 'low' | 'medium' | 'high';
  chain?: string;
  poolId?: string;
  source?: 'defillama' | 'cache';
  tvlUsd?: number;
}

export interface YieldThinkResult {
  options: YieldOption[];
  selectedOption: YieldOption;
  reasoning: string;
  attempt: number;
}

export interface MemoryInfluence {
  protocol: string;
  hasHistory: boolean;
  impact: 'boosted' | 'penalized' | 'neutral';
  successRate: number;
  executionCount: number;
}

export interface RiskReviewResult {
  decision: 'approve' | 'reject';
  reasoning: string;
  riskScore?: number;
  flags?: string[];
  ensInfluence?: ENSInfluence;
  axlInfluence?: AXLInfluence;
  memoryInfluence?: MemoryInfluence;
}

export interface ENSReputationContext {
  sources: string[];
  resolved: string[];
  reputationScore: number;
}

export interface AXLMessage {
  from?: string;
  to?: string;
  type: 'yield_request' | 'risk_request' | 'execution_signal';
  payload: Record<string, unknown>;
  timestamp?: number;
}

export interface ProtocolStats {
  protocol: string;
  successRate: number;
  executionCount: number;
  avgApy?: number;
  avgConfidence?: number;
  lastUsed?: number;
}
