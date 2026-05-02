# Backend Design

Complete guide to the ExecutionService orchestrator, agents, and adapters.

## Orchestrator: ExecutionService

**Location**: `backend/src/orchestrator/ExecutionService.ts`

Core responsibility: Orchestrate agents, manage state, handle retries.

### Key Methods

#### `analyze(request: ExecutionRequest): Promise<ExecutionResponse>`

1. Resolve ENS sources (user ENS, wallet ENS, defaults)
2. Run YieldAgent → get options + selection
3. Run RiskAgent → approve/reject
4. If rejected and attempt < 2 → retry
5. Pre-execute quote via ExecutorAgent
6. Return pending approval (5 min TTL)

#### `confirmExecution(approvalId: string): Promise<ExecutionResponse>`

1. Retrieve pending execution by ID
2. Execute via ExecutorAgent
3. Store execution in memory
4. Return final result

#### `execute(request): Promise<ExecutionResponse>`

Shortcut: calls `analyze()` then `confirmExecution()` automatically.

## Agents

### YieldAgent

**Location**: `backend/src/agents/YieldAgent.ts`

**Purpose**: Analyze intent, fetch yield data, select protocol.

**Methods**:

```typescript
async think(
  intent: string,
  attempt: number,
  trace: AgentTrace[],
  timestamp: number,
  externalMetadata?: Record<string, unknown>
): Promise<YieldThinkResult & { confidence: number }>
```

**Logic**:

1. Extract asset from intent (ETH, USDC, USDT, etc.)
2. Fetch live yield options from YieldDataAdapter
3. Broadcast yield_request via AXL
4. Merge local + remote options
5. Sort by APY (descending)
6. Select by attempt:
   - Attempt 1: Highest APY
   - Attempt 2: Second-highest APY (retry)
7. Calculate confidence based on:
   - APY gap between options
   - Live data vs. cache
   - Attempt number

**Confidence Range**: 0.0–0.95

**Key Thresholds**:
- Base: 0.7
- APY gap bonus: +APY_gap/10
- Live data bonus: +0.03
- Retry bonus: +0.05

### RiskAgent

**Location**: `backend/src/agents/RiskAgent.ts`

**Purpose**: Evaluate risk, apply reputation signals, approve/reject.

**Methods**:

```typescript
async review(
  plan: YieldOption,
  trace: AgentTrace[],
  timestamp: number,
  externalMetadata?: Record<string, unknown>,
  ensContext?: ENSReputationContext
): Promise<{
  result: { decision: 'approve' | 'reject', reasoning, riskScore, flags },
  confidence: number,
  ensInfluence?: ENSInfluence,
  axlInfluence?: AXLInfluence,
  memoryInfluence?: MemoryInfluence
}>
```

**Decision Matrix**:

```
Risk Level │ APY ≤4.0 │ 4.0<APY≤4.5 │ APY > 4.5
───────────┼──────────┼─────────────┼──────────────
low        │ approve  │ approve     │ approve
medium     │ approve  │ approve     │ reject (unless strong ENS)
high       │ reject   │ reject      │ reject
```

**ENS Influence** (applied post-decision):

- **Score ≥ 0.9** ("strong"): Allow medium-risk up to 4.6% APY, boost confidence
- **0.7 ≤ Score < 0.9** ("neutral"): Standard thresholds
- **Score < 0.7** ("weak"): Stricter limits, reduced confidence

**AXL Influence**:

- Broadcast risk_request to peers
- Approval ratio < 0.3 → decisionImpact = "penalty" (triggers retry)
- Approval ratio ≥ 0.7 → decisionImpact = "boost"
- Otherwise → "none"

**Memory Influence**:

- High success rate (≥ 0.7) → boost confidence
- Low success rate (< 0.5) → penalize, signal in retry
- No history → neutral

**Confidence Range**: 0.0–0.95

### ExecutorAgent

**Location**: `backend/src/agents/ExecutorAgent.ts`

**Purpose**: Quote swaps, execute deposits, broadcast results.

**Methods**:

```typescript
async quote(
  plan: YieldOption,
  trace: AgentTrace[],
  timestamp: number,
  externalMetadata?: Record<string, unknown>
): Promise<{ swapQuote: UniswapQuoteResult | null, nextTimestamp: number }>
```

Fetches swap quote from Uniswap or CoinGecko.

```typescript
async execute(
  plan: YieldOption,
  trace: AgentTrace[],
  attempt: number,
  timestamp: number,
  externalMetadata?: Record<string, unknown>,
  preparedSwapQuote?: UniswapQuoteResult | null
): Promise<{ result: ExecutionResult, confidence: number }>
```

Executes deposit and broadcasts execution_signal via AXL.

**Confidence**: Fixed 0.9 (high, execution assumed to succeed).

### BaseAgent

**Location**: `backend/src/agents/BaseAgent.ts`

**Responsibility**: Common logging interface.

```typescript
log(
  step: string,
  message: string,
  metadata: Record<string, unknown> | undefined,
  timestamp: number,
  externalMetadata?: Record<string, unknown>
): AgentTrace
```

Merges local metadata with external metadata (agent ID always in local metadata).

## Adapters

### ENSAdapter

**Location**: `backend/src/adapters/ENSAdapter.ts`

**Responsibility**: Resolve ENS names, fetch text records, cache.

**Methods**:

```typescript
async resolveName(name: string): Promise<string | null>
async getTextRecords(name: string): Promise<Record<string, string>>
```

**Features**:

- Viem client with RPC fallback (Alchemy → Ankr → public)
- 5-minute cache TTL
- 4000ms timeout per call
- Returns null/empty on timeout/error

**Text Records Fetched**: description, url, com.twitter, com.github

### YieldDataAdapter

**Location**: `backend/src/adapters/YieldDataAdapter.ts`

**Responsibility**: Fetch yield data from DefiLlama, cache, fallback.

**Methods**:

```typescript
async getYieldOptions(asset: string): Promise<YieldOption[]>
```

**Features**:

- DefiLlama `/pools` endpoint
- Filter by asset, chain (Ethereum)
- Mark source: "defillama" (live) or "cache"
- Return empty array if no data

### UniswapAdapter

**Location**: `backend/src/adapters/UniswapAdapter.ts`

**Responsibility**: Get swap quotes, fallback to CoinGecko.

**Methods**:

```typescript
async getQuote(params: {
  tokenIn: string,
  tokenOut: string,
  amount: string
}): Promise<UniswapQuoteResult | null>
```

**Features**:

- Try Uniswap API if enabled
- Fallback to CoinGecko pricing
- Return null if both fail
- Cache results

### AXLAdapter

**Location**: `backend/src/adapters/AXLAdapter.ts`

**Responsibility**: Broadcast messages to AXL network, collect responses.

**Methods**:

```typescript
async broadcast(message: AXLMessage): Promise<unknown[]>
async sendMessage(target: string, payload: any): Promise<any>
```

**Features**:

- Contact 3 AXL nodes in parallel (localhost:3005, :3006, :3007)
- ~1500ms timeout per node
- Validate response shape
- Return empty array if no valid responses

### ZeroGMemoryAdapter

**Location**: `backend/src/adapters/ZeroGMemoryAdapter.ts`

**Responsibility**: Store/retrieve execution history, compute protocol stats.

**Methods**:

```typescript
async storeExecution(data: ExecutionMemory): Promise<void>
async getProtocolStats(protocol: string): Promise<ProtocolStats | null>
async getRecentExecutions(limit: number): Promise<ExecutionMemory[]>
```

**Features**:

- In-memory store (default)
- Optional HTTP backend (0G KV)
- Demo mode with seeded data
- Success rate, avg confidence, execution count

### ReasoningAdapter

**Location**: `backend/src/adapters/ReasoningAdapter.ts`

**Responsibility**: Generate natural language explanations via LLM (optional).

**Methods**:

```typescript
async explainFinalDecision(context: any, intent: string): Promise<string | null>
isEnabled(): boolean
```

**Features**:

- OpenRouter (priority) > Groq
- 5000ms timeout
- Returns null if disabled/timeout
- Fallback to template strings

## Type System

**Location**: `backend/src/types/index.ts`

Core types:

- `ExecutionRequest`, `ExecutionResponse`
- `AgentTrace`, `ExecutionResult`
- `YieldOption`, `YieldThinkResult`
- `RiskReviewResult`
- `ENSReputationContext`, `ENSInfluence`
- `AXLMessage`, `AXLInfluence`
- `MemoryInfluence`, `ExecutionSummary`

## Error Handling

**Philosophy**: Fail gracefully, degrade to safe defaults.

| Failure | Behavior |
|---------|----------|
| ENS timeout | Use reputation 0.5, continue |
| Yield data unavailable | Return error response |
| AXL down | Proceed with local decisions |
| Memory unavailable | Proceed without history |
| LLM timeout | Use template explanation |
| Swap quote failed | Proceed without quote |

## Testing

**Location**: `backend/src/__tests__/`

Test files:

- `setup.ts` – Common fixtures
- `BaseAgent.test.ts` – Agent logging
- `YieldAgent.test.ts` – Yield selection logic
- `RiskAgent.test.ts` – Risk decisions + ENS/AXL influence
- `ExecutorAgent.test.ts` – Execution + swaps
- `EdgeCases.test.ts` – Bounds, edge inputs
- `ExecutionService.test.ts` – End-to-end flows
- `YieldDataAdapter.test.ts` – Data fetching
- `AXLAdapter.test.ts` – Peer communication
- `UniswapAdapter.test.ts` – Swap quotes
- `ZeroGMemoryAdapter.test.ts` – Memory + retry

**Run**:

```bash
npm run test          # Full suite
npm run test:watch   # Watch mode
```

## Confidence Calculation

Final confidence = average of:

1. **Yield Confidence** (0.0–0.95):
   - Base 0.7 + APY gap/10 + live bonus + retry bonus
   - Clamped to [0, 0.95]

2. **Risk Confidence** (0.0–0.95):
   - Base 0.8, adjusted by ENS/AXL/memory
   - Lower for rejections

3. **Execution Confidence** (0.0–0.95):
   - Base 0.85 – 0.1*(attempt-1) + low risk bonus + quote bonus
   - Fixed 0.9 if using prepared quote

Result: (yield + risk + execution) / 3, clamped [0, 0.95]
