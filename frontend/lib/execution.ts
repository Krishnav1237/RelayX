export type CanonicalAgentName =
  | 'system.relay.eth'
  | 'yield.relay.eth'
  | 'risk.relay.eth'
  | 'executor.relay.eth';

export type ENSTier = 'strong' | 'neutral' | 'weak';
export type ENSInfluenceEffect = 'increased tolerance' | 'decreased tolerance' | 'none';
export type AXLDecisionImpact = 'boost' | 'penalty' | 'retry' | 'none';
export type MemoryImpact = 'boosted' | 'penalized' | 'neutral';

export interface AgentTrace {
  agent: string;
  step: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface SwapCalldata {
  to: string;
  data: string;
  value: string;
  gasEstimate: string;
  tokenIn: string;
  tokenOut: string;
  amountOut: string;
  router: string;
  deadline: number;
}

export interface UniswapQuoteResult {
  amountOut: string;
  priceImpact: number;
  gasEstimate: string;
  route: string;
  source: 'uniswap' | 'uniswap-v3-quoter' | 'coingecko' | 'cache' | 'live';
  calldata?: SwapCalldata;
}

export interface ENSInfluence {
  tier: ENSTier;
  reputationScore: number;
  effect: ENSInfluenceEffect;
}

export interface AXLInfluence {
  approvalRatio: number;
  decisionImpact: AXLDecisionImpact;
  isSimulated: boolean;
}

export interface DecisionImpact {
  ens: string;
  axl: string;
  memory: string;
}

export interface MemoryInfluence {
  protocol: string;
  hasHistory: boolean;
  impact: MemoryImpact;
  successRate: number;
  executionCount: number;
}

export interface ExecutionResult {
  protocol: string;
  apy: string;
  action: string;
  status: 'pending_approval' | 'success' | 'failed';
  attempt?: number;
  swap?: UniswapQuoteResult;
  executionMode?: 'prepared' | 'executed';
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

export interface ExecutionRequestContext {
  ens?: string;
  wallet?: string;
  demo?: boolean;
  debug?: boolean;
}

export interface ExecutionRequest {
  intent: string;
  context?: ExecutionRequestContext;
}

export interface YieldPlanDebug {
  protocol?: string;
  apy?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

export interface ExecutionDebug {
  attempts?: number;
  initialSelection?: YieldPlanDebug;
  finalApprovedPlan?: YieldPlanDebug;
  riskDecision?: string;
  ensReputationScore?: number;
  ensInfluence?: ENSInfluence;
  axlInfluence?: AXLInfluence;
  memoryInfluence?: MemoryInfluence;
  confidenceBreakdown?: Record<string, number>;
  [key: string]: unknown;
}

export interface ExecutionResponse {
  intent: string;
  trace: AgentTrace[];
  final_result: ExecutionResult;
  summary: ExecutionSummary;
  approval?: ExecutionApproval;
  debug?: ExecutionDebug;
}

export interface ExecutionApproval {
  id: string;
  expiresAt: number;
}

export interface MetadataSummaryItem {
  label: string;
  value: string;
  tone?: 'default' | 'info' | 'success' | 'warning';
}

export interface TerminalStatusEvent {
  agent: string;
  message: string;
  timestamp: number;
}

export interface StoredExecutionLog {
  response: ExecutionResponse;
  savedAt: number;
}

export interface ExecutionSessionSnapshot {
  intent: string;
  demoMode: boolean;
  debugMode: boolean;
  requestContext: ExecutionRequestContext;
  response: ExecutionResponse | null;
  visibleTraces: AgentTrace[];
  streamQueue: AgentTrace[];
  isStreaming: boolean;
  showSummary: boolean;
  approvalCancelled: boolean;
  resultPanelCollapsed: boolean;
  resultPanelDismissed: boolean;
}

export interface StoredExecutionSession extends ExecutionSessionSnapshot {
  savedAt: number;
}

const EXECUTION_LOG_STORAGE_KEY = 'relayx:last-execution-log';
const EXECUTION_SESSION_STORAGE_KEY = 'relayx:execution-session';

const LEGACY_AGENT_NAME_MAP: Record<string, CanonicalAgentName> = {
  'yield.agent': 'yield.relay.eth',
  'risk.agent': 'risk.relay.eth',
  'executor.agent': 'executor.relay.eth',
};

const ENSTIERS: readonly ENSTier[] = ['strong', 'neutral', 'weak'];
const ENS_EFFECTS: readonly ENSInfluenceEffect[] = [
  'increased tolerance',
  'decreased tolerance',
  'none',
];
const AXL_IMPACTS: readonly AXLDecisionImpact[] = ['boost', 'penalty', 'retry', 'none'];
const MEMORY_IMPACTS: readonly MemoryImpact[] = ['boosted', 'penalized', 'neutral'];

export function normalizeAgentName(agent: string): string {
  return LEGACY_AGENT_NAME_MAP[agent] ?? agent;
}

export function normalizeExecutionResponse(payload: unknown): ExecutionResponse {
  if (!isRecord(payload)) {
    throw new Error('Invalid execution response');
  }

  return {
    intent: toStringValue(payload.intent),
    trace: Array.isArray(payload.trace) ? payload.trace.map(normalizeAgentTrace) : [],
    final_result: normalizeExecutionResult(payload.final_result ?? payload.finalResult),
    summary: normalizeExecutionSummary(payload.summary),
    approval: normalizeExecutionApproval(payload.approval),
    debug: normalizeExecutionDebug(payload.debug),
  };
}

export function saveExecutionLog(response: ExecutionResponse): void {
  if (typeof window === 'undefined') return;

  const payload: StoredExecutionLog = {
    response,
    savedAt: Date.now(),
  };

  window.localStorage.setItem(EXECUTION_LOG_STORAGE_KEY, JSON.stringify(payload));
}

export function loadExecutionLog(): StoredExecutionLog | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(EXECUTION_LOG_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    return {
      response: normalizeExecutionResponse(parsed.response),
      savedAt: toNumber(parsed.savedAt) ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveExecutionSession(session: ExecutionSessionSnapshot): void {
  if (typeof window === 'undefined') return;

  const payload: StoredExecutionSession = {
    ...session,
    savedAt: Date.now(),
  };

  window.localStorage.setItem(EXECUTION_SESSION_STORAGE_KEY, JSON.stringify(payload));

  if (session.response) {
    saveExecutionLog(session.response);
  }
}

export function loadExecutionSession(): StoredExecutionSession | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(EXECUTION_SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const response =
      parsed.response === null || parsed.response === undefined
        ? null
        : normalizeExecutionResponse(parsed.response);

    return {
      intent: toStringValue(parsed.intent),
      demoMode: parsed.demoMode === true,
      debugMode: parsed.debugMode === true,
      requestContext: normalizeExecutionRequestContext(parsed.requestContext),
      response,
      visibleTraces: Array.isArray(parsed.visibleTraces)
        ? parsed.visibleTraces.map(normalizeAgentTrace)
        : [],
      streamQueue: Array.isArray(parsed.streamQueue)
        ? parsed.streamQueue.map(normalizeAgentTrace)
        : [],
      isStreaming: parsed.isStreaming === true,
      showSummary: parsed.showSummary === true,
      approvalCancelled: parsed.approvalCancelled === true,
      resultPanelCollapsed: parsed.resultPanelCollapsed === true,
      resultPanelDismissed: parsed.resultPanelDismissed === true,
      savedAt: toNumber(parsed.savedAt) ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function summarizeMetadata(metadata?: Record<string, unknown>): MetadataSummaryItem[] {
  if (!metadata) return [];

  const items: MetadataSummaryItem[] = [];
  const ensInfluence = normalizeENSInfluence(metadata.ensInfluence);
  const axlInfluence = normalizeAXLInfluence(metadata.axlInfluence);
  const memoryInfluence = normalizeMemoryInfluence(metadata.memoryInfluence);
  const swap = normalizeUniswapQuoteResult(metadata.swap);

  if (ensInfluence) {
    items.push({
      label: 'ENS',
      value: `${ensInfluence.tier} tier, ${ensInfluence.effect} (${formatScore(ensInfluence.reputationScore)})`,
      tone:
        ensInfluence.tier === 'weak'
          ? 'warning'
          : ensInfluence.tier === 'strong'
            ? 'success'
            : 'info',
    });
  } else {
    const reputationScore = toNumber(metadata.reputationScore);
    if (reputationScore !== undefined) {
      items.push({
        label: 'ENS score',
        value: formatScore(reputationScore),
        tone: 'info',
      });
    }
  }

  if (Array.isArray(metadata.ensSourcesUsed)) {
    const sources = metadata.ensSourcesUsed.filter(
      (source): source is string => typeof source === 'string'
    );
    if (sources.length > 0) {
      items.push({
        label: 'ENS sources',
        value: sources.join(', '),
        tone: 'info',
      });
    }
  }

  if (axlInfluence) {
    items.push({
      label: 'AXL',
      value: `${axlInfluence.decisionImpact}; ${formatRatio(axlInfluence.approvalRatio)} approval${axlInfluence.isSimulated ? ', simulated' : ''}`,
      tone:
        axlInfluence.decisionImpact === 'penalty' || axlInfluence.decisionImpact === 'retry'
          ? 'warning'
          : 'info',
    });
  }

  if (memoryInfluence) {
    items.push({
      label: 'Memory',
      value: `${memoryInfluence.impact} history for ${memoryInfluence.protocol} (${formatRatio(memoryInfluence.successRate)} success)`,
      tone:
        memoryInfluence.impact === 'penalized'
          ? 'warning'
          : memoryInfluence.impact === 'boosted'
            ? 'success'
            : 'info',
    });
  }

  if (swap) {
    const swapIsOnChain = swap.source === 'uniswap-v3-quoter' || swap.source === 'uniswap' || swap.source === 'live';
    items.push({
      label: 'Swap',
      value: `${swap.amountOut} via ${swap.route}`,
      tone: swapIsOnChain ? 'success' : 'info',
    });
  }

  const amountOut = toOptionalString(metadata.amountOut);
  const route = toOptionalString(metadata.route);
  if (amountOut && route) {
    const srcIsOnChain = metadata.source === 'live' || metadata.source === 'uniswap-v3-quoter' || metadata.source === 'uniswap';
    items.push({
      label: 'Swap',
      value: `${amountOut} via ${route}`,
      tone: srcIsOnChain ? 'success' : 'info',
    });
  }

  const priceImpact = toNumber(metadata.priceImpact);
  if (priceImpact !== undefined) {
    items.push({
      label: 'Price impact',
      value: `${priceImpact}%`,
      tone: priceImpact > 1 ? 'warning' : 'info',
    });
  }

  const tokenIn = toOptionalString(metadata.tokenIn);
  const tokenOut = toOptionalString(metadata.tokenOut);
  if (tokenIn && tokenOut) {
    items.push({ label: 'Pair', value: `${tokenIn} -> ${tokenOut}`, tone: 'info' });
  }

  if (typeof metadata.isLiveData === 'boolean') {
    items.push({
      label: 'Yield data',
      value: metadata.isLiveData ? 'live' : 'cached',
      tone: metadata.isLiveData ? 'success' : 'info',
    });
  }

  if (metadata.demo === true) {
    items.push({ label: 'Mode', value: 'demo', tone: 'info' });
  }

  const riskScore = toNumber(metadata.riskScore);
  if (riskScore !== undefined) {
    items.push({
      label: 'Risk score',
      value: String(riskScore),
      tone: riskScore >= 35 ? 'warning' : 'info',
    });
  }

  const decision = toOptionalString(metadata.decision);
  if (decision) {
    items.push({
      label: 'Decision',
      value: decision,
      tone: decision === 'reject' ? 'warning' : 'success',
    });
  }

  const confidence = toNumber(metadata.confidence);
  if (confidence !== undefined) {
    items.push({ label: 'Confidence', value: formatRatio(confidence), tone: 'info' });
  }

  const peersContacted = toNumber(metadata.peersContacted);
  if (peersContacted !== undefined) {
    items.push({
      label: 'AXL peers',
      value: String(peersContacted),
      tone: peersContacted > 0 ? 'success' : 'info',
    });
  }

  const selectedOption = normalizeYieldPlanDebug(metadata.selectedOption);
  if (selectedOption?.protocol) {
    items.push({
      label: 'Selected',
      value: `${selectedOption.protocol}${selectedOption.apy !== undefined ? ` (${selectedOption.apy}% APY)` : ''}`,
      tone: 'success',
    });
  }

  if (items.length === 0) {
    items.push({ label: 'Metadata', value: compactJson(metadata), tone: 'default' });
  }

  return items;
}

export function buildTerminalStatusEvents(traces: AgentTrace[]): TerminalStatusEvent[] {
  const events: TerminalStatusEvent[] = [];

  for (const trace of traces) {
    if (!trace || typeof trace !== 'object') continue;
    const event = traceToTerminalStatus(trace);
    const previous = events[events.length - 1];

    if (previous?.agent === event.agent && previous.message === event.message) {
      continue;
    }

    events.push(event);
  }

  return events;
}

export function formatApy(apy: string): string {
  const value = apy.trim();
  if (!value) return 'n/a';
  return value.endsWith('%') ? value : `${value}%`;
}

function traceToTerminalStatus(trace: AgentTrace): TerminalStatusEvent {
  const agent = normalizeAgentName(trace.agent);

  return {
    agent,
    message: getTerminalMessage(agent, trace.step, trace.metadata),
    timestamp: trace.timestamp,
  };
}

function getTerminalMessage(
  agent: string,
  step: string,
  metadata?: Record<string, unknown>
): string {
  if (agent === 'yield.relay.eth') {
    return 'Analyzing yield opportunities...';
  }

  if (agent === 'risk.relay.eth') {
    if (isRecord(metadata) && metadata.decision === 'approve') {
      return 'Risk checks passed.';
    }

    if (isRecord(metadata) && metadata.decision === 'reject') {
      return 'Risk threshold hit. Finding a safer option...';
    }

    if (step === 'memory') {
      return 'Checking historical performance memory...';
    }

    return 'Evaluating risk...';
  }

  if (agent === 'executor.relay.eth') {
    if (step === 'quote') return 'Preparing swap route...';
    return 'Executing strategy...';
  }

  if (agent === 'system.relay.eth') {
    if (step === 'start') return 'Preparing execution...';
    if (step === 'retry') return 'Adjusting strategy...';
    if (step === 'evaluate') return 'Selecting final strategy...';
    if (step === 'approval_required') return 'Waiting for your approval...';
    if (step === 'approval') return 'Approval received. Executing strategy...';
    if (step === 'execute') return 'Execution complete.';
    if (step === 'explain') return 'Generating decision rationale...';
    return 'Coordinating agents...';
  }

  return 'Processing...';
}

export function formatRatio(value: number): string {
  const percentage = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percentage.toFixed(0)}%`;
}

function normalizeAgentTrace(value: unknown): AgentTrace {
  const record = isRecord(value) ? value : {};
  return {
    agent: normalizeAgentName(toStringValue(record.agent, 'system.relay.eth')),
    step: toStringValue(record.step),
    message: toStringValue(record.message),
    metadata: normalizeMetadata(record.metadata),
    timestamp: toNumber(record.timestamp) ?? Date.now(),
  };
}

function normalizeExecutionResult(value: unknown): ExecutionResult {
  const record = isRecord(value) ? value : {};
  const status =
    record.status === 'pending_approval' || record.status === 'failed' ? record.status : 'success';

  return {
    protocol: toStringValue(record.protocol),
    apy: toStringValue(record.apy),
    action: toStringValue(record.action),
    status,
    attempt: toNumber(record.attempt),
    swap: normalizeUniswapQuoteResult(record.swap),
  };
}

function normalizeExecutionApproval(value: unknown): ExecutionApproval | undefined {
  if (!isRecord(value)) return undefined;
  const id = toOptionalString(value.id);
  const expiresAt = toNumber(value.expiresAt);
  if (!id || expiresAt === undefined) return undefined;
  return { id, expiresAt };
}

function normalizeExecutionRequestContext(value: unknown): ExecutionRequestContext {
  if (!isRecord(value)) return {};

  const context: ExecutionRequestContext = {};
  const ens = toOptionalString(value.ens);
  const wallet = toOptionalString(value.wallet);

  if (ens) context.ens = ens;
  if (wallet) context.wallet = wallet;
  if (value.demo === true) context.demo = true;
  if (value.debug === true) context.debug = true;

  return context;
}

function normalizeExecutionSummary(value: unknown): ExecutionSummary {
  const record = isRecord(value) ? value : {};

  return {
    selectedProtocol: toStringValue(record.selectedProtocol),
    initialProtocol: toStringValue(record.initialProtocol),
    finalProtocol: toStringValue(record.finalProtocol),
    wasRetried: record.wasRetried === true,
    reasonForRetry: toOptionalString(record.reasonForRetry),
    totalSteps: toNumber(record.totalSteps) ?? 0,
    confidence: clamp(toNumber(record.confidence) ?? 0, 0, 1),
    explanation: toStringValue(record.explanation),
    decisionImpact: normalizeDecisionImpact(record.decisionImpact),
  };
}

function normalizeExecutionDebug(value: unknown): ExecutionDebug | undefined {
  if (!isRecord(value)) return undefined;

  return {
    ...value,
    attempts: toNumber(value.attempts),
    initialSelection: normalizeYieldPlanDebug(value.initialSelection),
    finalApprovedPlan: normalizeYieldPlanDebug(value.finalApprovedPlan),
    riskDecision: toOptionalString(value.riskDecision),
    ensReputationScore: toNumber(value.ensReputationScore),
    ensInfluence: normalizeENSInfluence(value.ensInfluence),
    axlInfluence: normalizeAXLInfluence(value.axlInfluence),
    memoryInfluence: normalizeMemoryInfluence(value.memoryInfluence),
    confidenceBreakdown: normalizeConfidenceBreakdown(value.confidenceBreakdown),
  };
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;

  const metadata: Record<string, unknown> = { ...value };
  const ensInfluence = normalizeENSInfluence(value.ensInfluence);
  const axlInfluence = normalizeAXLInfluence(value.axlInfluence);
  const swap = normalizeUniswapQuoteResult(value.swap);

  if (ensInfluence) metadata.ensInfluence = ensInfluence;
  if (axlInfluence) metadata.axlInfluence = axlInfluence;
  if (swap) metadata.swap = swap;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function normalizeUniswapQuoteResult(value: unknown): UniswapQuoteResult | undefined {
  if (!isRecord(value)) return undefined;

  const amountOut = toOptionalString(value.amountOut);
  const route = toOptionalString(value.route);
  const gasEstimate = toOptionalString(value.gasEstimate);

  // Accept all backend source values; map unknown to 'cache'
  const validSources = ['uniswap', 'uniswap-v3-quoter', 'coingecko', 'cache', 'live'] as const;
  type ValidSource = (typeof validSources)[number];
  const source: ValidSource = validSources.includes(value.source as ValidSource)
    ? (value.source as ValidSource)
    : 'cache';

  if (!amountOut && !route && !gasEstimate) return undefined;

  // Preserve calldata so MetaMask can use it
  const calldata = normalizeSwapCalldata(value.calldata);

  return {
    amountOut: amountOut ?? '',
    priceImpact: toNumber(value.priceImpact) ?? 0,
    gasEstimate: gasEstimate ?? '',
    route: route ?? '',
    source,
    ...(calldata ? { calldata } : {}),
  };
}

function normalizeSwapCalldata(value: unknown): SwapCalldata | undefined {
  if (!isRecord(value)) return undefined;
  const to = toOptionalString(value.to);
  const data = toOptionalString(value.data);
  if (!to || !data) return undefined;
  return {
    to,
    data,
    value: toOptionalString(value.value) ?? '0',
    gasEstimate: toOptionalString(value.gasEstimate) ?? '200000',
    tokenIn: toOptionalString(value.tokenIn) ?? '',
    tokenOut: toOptionalString(value.tokenOut) ?? '',
    amountOut: toOptionalString(value.amountOut) ?? '',
    router: toOptionalString(value.router) ?? '',
    deadline: toNumber(value.deadline) ?? 0,
  };
}

function normalizeENSInfluence(value: unknown): ENSInfluence | undefined {
  if (!isRecord(value)) return undefined;

  const tier = isOneOf(value.tier, ENSTIERS) ? value.tier : 'neutral';
  const effect = isOneOf(value.effect, ENS_EFFECTS) ? value.effect : 'none';
  const reputationScore = toNumber(value.reputationScore) ?? 0;

  if (
    value.tier === undefined &&
    value.effect === undefined &&
    value.reputationScore === undefined
  ) {
    return undefined;
  }

  return { tier, reputationScore, effect };
}

function normalizeAXLInfluence(value: unknown): AXLInfluence | undefined {
  if (!isRecord(value)) return undefined;

  const decisionImpact = isOneOf(value.decisionImpact, AXL_IMPACTS) ? value.decisionImpact : 'none';
  const approvalRatio = toNumber(value.approvalRatio) ?? 0;
  const isSimulated = value.isSimulated === true;

  if (
    value.decisionImpact === undefined &&
    value.approvalRatio === undefined &&
    value.isSimulated === undefined
  ) {
    return undefined;
  }

  return { approvalRatio, decisionImpact, isSimulated };
}

function normalizeDecisionImpact(value: unknown): DecisionImpact {
  const record = isRecord(value) ? value : {};
  return {
    ens: toStringValue(record.ens),
    axl: toStringValue(record.axl),
    memory: toStringValue(record.memory),
  };
}

function normalizeMemoryInfluence(value: unknown): MemoryInfluence | undefined {
  if (!isRecord(value)) return undefined;

  const impact = isOneOf(value.impact, MEMORY_IMPACTS) ? value.impact : 'neutral';
  const protocol = toStringValue(value.protocol);
  const hasHistory = value.hasHistory === true;
  const successRate = toNumber(value.successRate) ?? 0;
  const executionCount = toNumber(value.executionCount) ?? 0;

  if (
    value.impact === undefined &&
    value.protocol === undefined &&
    value.hasHistory === undefined
  ) {
    return undefined;
  }

  return { protocol, hasHistory, impact, successRate, executionCount };
}

function normalizeYieldPlanDebug(value: unknown): YieldPlanDebug | undefined {
  if (!isRecord(value)) return undefined;

  const riskLevel =
    value.riskLevel === 'low' || value.riskLevel === 'medium' || value.riskLevel === 'high'
      ? value.riskLevel
      : undefined;

  return {
    ...value,
    protocol: toOptionalString(value.protocol),
    apy: toNumber(value.apy),
    riskLevel,
  };
}

function normalizeConfidenceBreakdown(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;

  const breakdown: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const numberValue = toNumber(raw);
    if (numberValue !== undefined) breakdown[key] = numberValue;
  }

  return Object.keys(breakdown).length > 0 ? breakdown : undefined;
}

function formatScore(score: number): string {
  return score >= 0 && score <= 1 ? score.toFixed(2) : String(score);
}

function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return 'unavailable';
  }
}

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function toOptionalString(value: unknown): string | undefined {
  const stringValue = toStringValue(value).trim();
  return stringValue.length > 0 ? stringValue : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace('%', ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
