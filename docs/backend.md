# Backend Deep Dive

## Stack

- **Runtime**: Node.js + TypeScript (strict mode, zero `any`)
- **Framework**: Express 5
- **Testing**: Vitest (92 tests across 11 files)
- **ENS**: viem + Alchemy RPC (real Ethereum mainnet)
- **Yield Data**: DefiLlama API (live, cached, with fallback)
- **AXL**: Multi-node HTTP adapter (3 nodes, parallel broadcast)
- **LLM**: Optional OpenAI integration (safe mode, never overrides)

## Entry Point (`src/index.ts`)

- Express server on port 3001
- Boot logging: ENS RPC status, AXL base URL, LLM enabled/disabled
- Routes:
  - `GET /health` — uptime check
  - `GET /axl-health` — pings all 3 AXL nodes, returns `{ status, nodesReachable }`
  - `GET /yield-health` — tests DefiLlama fetch, returns `{ status, source, protocols }`
  - `GET /ens-health` — resolves vitalik.eth, returns `{ status, addressResolved }`
  - `POST /execute` — main orchestration endpoint

## Controller (`src/controllers/execute.controller.ts`)

- Validates `intent` is a non-empty string
- Passes optional `context` (ens, wallet, demo, debug) through
- Returns 400 for invalid input, 500 for internal errors (no stack traces)
- When `context.debug = true`: runs execution twice and logs determinism check

## ExecutionService (`src/orchestrator/ExecutionService.ts`)

The core orchestration brain. Full pipeline:

### Phase 1: ENS Resolution
1. Builds ENS source list: user ENS → wallet reverse lookup → fallback to vitalik.eth + defaults
2. Resolves up to 3 sources in parallel
3. Computes reputation score (boosted by github/twitter presence)
4. If all ENS fails: neutral score (0.7), no penalties

### Phase 2: Agent Orchestration
1. **YieldAgent.think()** — fetches live yield data, broadcasts to AXL, selects best option
2. **RiskAgent.review()** — evaluates with ENS tiers + AXL consensus
3. **Retry** — if rejected or AXL penalty, retries with next-best protocol
4. **ExecutorAgent.execute()** — deposits and broadcasts execution signal

### Phase 3: Validation
- Trace assertions: all 4 agents must appear, timestamps increasing
- Output contract: protocol non-empty, APY ends with %, status valid, explanation > 10 chars
- Confidence clamped to [0, 0.95]
- If validation fails: corrective trace entry added

### Phase 4: Response Assembly
- Computes average confidence from all three agents (direct return values)
- Builds `decisionImpact` with explicit ENS and AXL descriptions
- Returns `ExecutionResponse` with trace, result, summary, debug

## Agents

### BaseAgent (`src/agents/BaseAgent.ts`)
- Properties: `id`, `name` (ENS-style: `yield.relay.eth`, etc.)
- `log()` method produces `AgentTrace` entries with timestamp and metadata merging

### YieldAgent (`src/agents/YieldAgent.ts`)
- Fetches live yield data from `YieldDataAdapter` (DefiLlama)
- Validates: APY 0-50, minimum 2 options, no empty protocols
- Demo mode: ensures Morpho + Aave + Compound available
- Broadcasts `yield_request` to AXL, merges remote options (local priority)
- Selects by attempt index for deterministic retry
- Optional LLM reasoning enhancement
- Returns confidence (boosted +0.03 for live data, +0.05 for retry)

### RiskAgent (`src/agents/RiskAgent.ts`)
- ENS tiers: strong (≥0.9), neutral (0.7-0.9), weak (<0.7)
- Strong ENS: +0.1 confidence, threshold 4.55
- Weak ENS: -0.1 confidence, threshold 4.4, adds flag
- Medium risk near threshold: extra scrutiny (+15 riskScore)
- AXL consensus: ≥70% = +0.1 boost, <30% = -0.1 penalty
- Optional LLM confidence blending (70/30 deterministic/LLM)
- Decision: `riskScore >= 35` → reject
- Returns `RiskReviewResult` + `confidence` + `ensInfluence` + `axlInfluence`

### ExecutorAgent (`src/agents/ExecutorAgent.ts`)
- Simulated deposit execution (no on-chain calls yet)
- Broadcasts `execution_signal` to AXL
- Fixed confidence: 0.9
- User-facing narrative: "Deposit successful. Funds now generating yield at X% APY."

## Adapters

### YieldDataAdapter (`src/adapters/YieldDataAdapter.ts`)
- **Source**: DefiLlama `https://yields.llama.fi/pools`
- Filters: asset match, Ethereum chain, $1M+ TVL, APY 0-50%
- Protocol risk mapping: Aave/Compound/Spark → low, Morpho/Yearn/Curve → medium
- In-memory cache: 60-second TTL, keyed by asset
- Fallback: last cached result → Aave + Compound minimal set
- Timeout: 5 seconds

### ENSAdapter (`src/adapters/ENSAdapter.ts`)
- Real Ethereum mainnet ENS resolution via viem
- Resolves addresses + text records (description, url, twitter, github)
- In-memory cache: 5-minute TTL
- RPC fallback: Alchemy → Ankr
- Per-call timeout: 1s per RPC attempt

### AXLAdapter (`src/adapters/AXLAdapter.ts`)
- Multi-node: broadcasts to 3 nodes in parallel (`Promise.allSettled`)
- Nodes: `AXL_BASE_URL`, `:3006`, `:3007`
- No simulated responses — returns empty array when no nodes respond
- Strict response validation: type guards for protocol, APY (0-50), decision values
- Timeout: 1.5s per node

### ReasoningAdapter (`src/adapters/ReasoningAdapter.ts`)
- Optional OpenAI integration (requires `OPENAI_API_KEY`)
- `explainYield()`: generates human-readable yield explanation
- `evaluateRisk()`: returns `{ reasoning, confidence }` for blending
- Strict validation: confidence must be finite number, reasoning non-empty
- Timeout: 2 seconds. On failure: ignored completely.
- LLM never overrides decisions, never triggers retries

### Placeholder Adapters
- `ExecutionAdapter.ts` — KeeperHub (future)
- `MemoryAdapter.ts` — 0G storage (future)
- `SwapAdapter.ts` — Uniswap (future)

## Type System (`src/types/index.ts`)

All types strict, zero `any`:

| Type | Key Fields |
|---|---|
| `AgentTrace` | agent, step, message, metadata?, timestamp |
| `ExecutionResult` | protocol, apy, action, status, attempt? |
| `ExecutionSummary` | selectedProtocol, initialProtocol, finalProtocol, wasRetried, confidence, explanation, decisionImpact |
| `ExecutionRequest` | intent, context? (ens, wallet, demo, debug) |
| `ExecutionResponse` | intent, trace, final_result, summary, debug? |
| `ENSInfluence` | tier (strong/neutral/weak), reputationScore, effect |
| `AXLInfluence` | approvalRatio, decisionImpact (boost/penalty/retry/none), isSimulated |
| `DecisionImpact` | ens (string), axl (string) |
| `YieldOption` | protocol, apy, riskLevel? |

## Testing

92 tests across 11 files using Vitest:

```bash
cd backend && npm test
```

| Test File | Count | Coverage |
|---|---|---|
| BaseAgent.test.ts | 5 | Identity, logging, metadata merging |
| YieldAgent.test.ts | 8 | Live data, selection, retry, asset extraction |
| RiskAgent.test.ts | 12 | ENS tiers, AXL influence, approve/reject |
| ExecutorAgent.test.ts | 6 | Result fields, confidence, narrative |
| ExecutionService.test.ts | 11 | Full flow, retry, determinism, decisionImpact |
| AXLAdapter.test.ts | 6 | Empty responses, graceful degradation |
| YieldDataAdapter.test.ts | 4 | Live fetch, caching, fallback |
| EdgeCases.test.ts | 13 | Boundaries, ENS tiers, confidence bounds |
| integration.test.ts | 1 | Full end-to-end flow |
| hardening.test.ts | 19 | Stability, demo mode, low data, validation |
| verification.test.ts | 7 | All demo scenarios, output contract |

## Graceful Degradation

| Failure | Behavior |
|---|---|
| DefiLlama down | Returns cached data, then Aave+Compound fallback |
| All AXL nodes down | Empty responses, no confidence change, clean trace |
| ENS RPC down | Neutral reputation (0.7), no penalties |
| LLM timeout/error | Ignored completely, deterministic logic only |
| Malformed AXL data | Rejected by type guards, never trusted |
