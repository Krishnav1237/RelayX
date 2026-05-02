# Architecture & Data Flow

RelayX follows a **multi-agent orchestration pattern** with deterministic decision logic.

## High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                         │
│  Dashboard → /api/analyze → User Review → /api/execute/confirm  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend API (Express, Port 3001)                   │
├─────────────────────────────────────────────────────────────────┤
│  POST /analyze      – analyze intent + get approval            │
│  POST /execute      – analyze + execute in one call            │
│  POST /execute/confirm – execute after user approval           │
│  GET /health        – basic health check                       │
│  GET /axl-health    – AXL network status                       │
│  GET /yield-health  – DefiLlama availability                   │
│  GET /ens-health    – ENS resolution capability                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │ExecutionSvc│ │Memory Store│ │AXL Network │
    │(Orchestrator)        │            │
    └────────────┘ └────────────┘ └────────────┘
           │
     ┌─────┴─────┬─────────────┬──────────────┐
     ▼           ▼             ▼              ▼
 ┌────────┐ ┌────────┐ ┌────────────┐ ┌──────────┐
 │ Yield  │ │ Risk   │ │  Executor  │ │  System  │
 │ Agent  │ │ Agent  │ │   Agent    │ │  Agent   │
 └────────┘ └────────┘ └────────────┘ └──────────┘
     │           │             │
     └───────────┼─────────────┘
                 ▼
          ┌─────────────────────────┐
          │      Adapters           │
          ├─────────────────────────┤
          │ ├─ ENSAdapter (Viem)   │
          │ ├─ YieldDataAdapter    │
          │ ├─ UniswapAdapter      │
          │ ├─ AXLAdapter          │
          │ ├─ ZeroGMemoryAdapter  │
          │ └─ ReasoningAdapter    │
          └─────────────────────────┘
                 │
      ┌──────────┼──────────┬──────────┐
      ▼          ▼          ▼          ▼
  DefiLlama   Ethereum   Uniswap    AXL Nodes
   (Yield)      (ENS)   (Quotes)  (Consensus)
```

## Execution Lifecycle

### Request → Analysis → Approval → Execution

```
User Request: "find best yield on ETH"
      │
      ▼
   /analyze endpoint
      │
      ├─ Step 1: Build ENS context
      │  └─ Resolve vitalik.eth, ens.eth, nick.eth
      │  └─ Compute reputation score (0.0–1.0)
      │
      ├─ Step 2: YieldAgent.think()
      │  └─ Fetch live yield data (DefiLlama)
      │  └─ Broadcast yield request via AXL
      │  └─ Merge local + remote options
      │  └─ Select highest APY by default (attempt 1)
      │
      ├─ Step 3: RiskAgent.review()
      │  └─ Check risk profile
      │  └─ Apply ENS reputation signals
      │  └─ Broadcast risk_request via AXL
      │  └─ Decision: approve/reject
      │
      ├─ Step 4 (if rejected): Retry
      │  └─ YieldAgent selects next option
      │  └─ Memory-aware retry selection (prefer high success rate)
      │  └─ RiskAgent reviews second option
      │
      ├─ Step 5: ExecutorAgent.quote()
      │  └─ Fetch swap quote (Uniswap or CoinGecko)
      │
      └─ Response: {approval_id, trace[], status: "pending_approval"}
                   (User must confirm with approval_id)

/execute/confirm endpoint
      │
      ├─ Step 6: Retrieve approved plan
      │  └─ Look up pending execution by approval_id
      │
      ├─ Step 7: ExecutorAgent.execute()
      │  └─ Execute deposit on selected protocol
      │  └─ Broadcast execution_signal via AXL
      │
      ├─ Step 8: Persist memory
      │  └─ Store execution outcome for protocol
      │  └─ Update success rates
      │
      └─ Response: {final_result, trace[], status: "success"}
```

## Component Responsibilities

### Agents

| Agent | Role | Output |
|-------|------|--------|
| **YieldAgent** | Analyze intent, fetch yield data, select by APY | {options[], selectedOption, reasoning, confidence} |
| **RiskAgent** | Assess risk vs APY, apply ENS/AXL/memory signals | {decision: approve\|reject, riskScore, reasoning} |
| **ExecutorAgent** | Quote swap, execute deposit | {result, swap quote, confidence} |
| **System Agent** | Log orchestration steps, manage approvals | Trace entries |

### Adapters

| Adapter | Responsibility | Failure Mode |
|---------|-----------------|--------------|
| **ENSAdapter** | Resolve ENS names, fetch text records | Return null, use neutral 0.5 score |
| **YieldDataAdapter** | Fetch DefiLlama data, cache | Use cached data, fallback to empty |
| **UniswapAdapter** | Quote swaps, fallback to CoinGecko | Fall back to CoinGecko, then null |
| **AXLAdapter** | Broadcast to peers, validate responses | Silently return empty array |
| **ZeroGMemoryAdapter** | Store/retrieve execution history | Optional, continue without history |
| **ReasoningAdapter** | Generate LLM explanations | Optional, fallback to templates |

## Data Structures

### ExecutionRequest

```typescript
{
  intent: string;
  context?: {
    ens?: string;              // e.g., "vitalik.eth"
    wallet?: string;           // e.g., "0x..."
    demo?: boolean;            // Use demo memory
    debug?: boolean;           // Log debug info
  };
}
```

### ExecutionResponse

```typescript
{
  intent: string;
  trace: AgentTrace[];         // Full execution trace
  final_result: {
    protocol: string;
    apy: string;              // e.g., "4.2%"
    action: "deposit";
    status: "pending_approval" | "success" | "failed";
    attempt: number;
    swap?: UniswapQuoteResult;
  };
  summary: {
    selectedProtocol: string;
    initialProtocol: string;
    finalProtocol: string;
    wasRetried: boolean;
    totalSteps: number;
    confidence: number;       // 0.0–0.95
    explanation: string;
    decisionImpact: {
      ens: string;            // ENS impact description
      axl: string;            // AXL impact description
      memory?: string;        // Memory impact description
    };
  };
  approval?: {
    id: string;
    expiresAt: number;        // Unix ms, TTL 5 min
  };
  debug?: {...};              // Only if context.debug=true
}
```

### AgentTrace

```typescript
{
  agent: string;              // e.g., "yield.relay.eth"
  step: string;               // e.g., "analyze", "evaluate", "approve"
  message: string;
  metadata?: {
    [key: string]: unknown;
  };
  timestamp: number;          // Unix ms
}
```

## Decision Logic

### RiskAgent Thresholds

```
APY  │  Risk Level  │  Approval Logic
─────┼──────────────┼────────────────────────────────
≤4.0 │  low         │  Always approve
4.0-4.5 │ low      │  Always approve
4.5+ │  low         │  Always approve
─────┼──────────────┼────────────────────────────────
≤4.0 │  medium      │  Approve
4.0-4.5 │ medium   │  Approve
4.5+ │  medium      │  REJECT (unless strong ENS)
─────┼──────────────┼────────────────────────────────
*    │  high        │  REJECT
```

### ENS Influence

- **Reputation Score ≥ 0.9**: "strong" tier → allow medium risk up to 4.6% APY
- **0.7 ≤ Score < 0.9**: "neutral" tier → standard thresholds
- **Score < 0.7**: "weak" tier → stricter APY limits

### AXL Consensus Impact

- **Approval Ratio ≥ 0.7**: Boost confidence
- **Approval Ratio < 0.3**: Penalty, trigger retry
- **Otherwise**: No direct impact (neutral)

### Memory Influence

- **Success Rate ≥ 0.7**: Boosted confidence
- **Success Rate < 0.5**: Penalized, preferred in retry
- **No history**: Neutral (default)

## Retry Strategy

On rejection (or AXL penalty), the system retries:

1. **YieldAgent** selects next option (by attempt number, not just APY)
2. **Memory-aware selection**: If memory available, prefer highest success rate
3. **RiskAgent** reviews second option
4. **Max attempts**: 2

If retry also fails → return rejection reason in summary.

## Timeout & Fallback Strategy

| Component | Timeout | Fallback |
|-----------|---------|----------|
| ENS resolution | 4000 ms | null address, neutral score 0.5 |
| ENS text records | 4000 ms | empty object {} |
| Yield data fetch | — | cache or empty [] |
| AXL broadcast | ~1500ms per node | empty array [] |
| Uniswap quote | — | CoinGecko or null |
| LLM explanation | 5000 ms | template string |

## Caching Strategy

| Component | TTL | Key |
|-----------|-----|-----|
| ENS names + records | 5 min | {name} |
| Yield options | varies | {asset} |
| Swap quotes | varies | {tokenIn}→{tokenOut} |
| Protocol stats | in-memory | {protocol} |

## Security & Determinism

- **No randomness**: Same input always yields same decision path
- **Overflow protection**: Confidence values clamped to [0, 0.95]
- **No magic numbers**: All thresholds configurable via code
- **Trace for audit**: Every decision logged with reasoning + metadata
