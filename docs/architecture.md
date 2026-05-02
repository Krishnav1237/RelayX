# RelayX Architecture

## System Overview

RelayX is an intent-centric DeFi execution engine built on a multi-agent orchestration pattern. A user submits a natural language intent, and three specialized agents collaborate — with real external data from DefiLlama, ENS, AXL, and 0G-backed memory — to find the best yield, assess risk, and execute a deposit.

## Runtime Topology

```
User Browser → Next.js Frontend (:3000)
                  ↓ POST /api/execute (rewritten to backend)
              Express Backend (:3001)
                  ↓
              ExecutionService
                  ├── DefiLlama API (live yield data)
                  ├── ENS Resolution (Ethereum mainnet via viem)
                  ├── Uniswap API / CoinGecko API (quote data)
                  ├── 0G Storage KV + Log (execution memory)
                  ├── YieldAgent → AXL broadcast (yield_request)
                  ├── RiskAgent → AXL broadcast (risk_request)
                  ├── [Retry path if rejected]
                  ├── ExecutorAgent → AXL broadcast (execution_signal)
                  └── Optional LLM (OpenAI) for reasoning
                  ↓
              JSON Response (trace + result + summary + debug)
```

## Orchestration Sequence

```
 1. [system.relay.eth]    Resolve ENS sources → compute reputation score
 2. [system.relay.eth]    Start: "Processing intent — ENS reputation: 0.93"
 3. [yield.relay.eth]     Fetch live yield data from DefiLlama (N protocols)
 4. [yield.relay.eth]     Broadcast yield_request to AXL, merge peer options
 5. [yield.relay.eth]     Select highest APY protocol
 6. [risk.relay.eth]      Review selection — ENS tier + AXL consensus + memory
 7. [risk.relay.eth]      AXL consensus: X/Y approved → confidence adjustment
 8. [risk.relay.eth]      0G memory: protocol success rate → confidence/risk adjustment
 9. [risk.relay.eth]      Decision: approve or reject
10. [system.relay.eth]    (If rejected) Retry with next-best or memory-preferred protocol
11. [yield.relay.eth]     (Retry) Select alternative protocol
12. [risk.relay.eth]      (Retry) Review alternative — approve
13. [system.relay.eth]    Final plan selected
14. [executor.relay.eth]  Execute deposit, broadcast to AXL
15. [system.relay.eth]    Store execution memory in 0G KV + Log
16. [system.relay.eth]    Execution completed
```

## Decision Model

### Data Sources

| Source | What It Provides | Fallback |
|---|---|---|
| DefiLlama | Live APY data for DeFi protocols | Cached upstream data; otherwise failed execution |
| ENS | On-chain reputation (address, text records) | Neutral score (0.7) |
| Uniswap | Authenticated route quote | CoinGecko spot price quote |
| CoinGecko | Spot prices for quote fallback | No swap quote attached |
| AXL | Peer consensus (approve/reject ratios) | Empty responses (no influence) |
| 0G Storage | Protocol success stats + execution history | Null stats (no influence) |
| OpenAI | LLM reasoning + confidence adjustment | Ignored entirely |

### YieldAgent Selection
- Fetches live data from DefiLlama, filtered by asset, Ethereum chain, $1M+ TVL
- Merges AXL peer suggestions (local data takes priority for duplicates)
- Attempt 1: highest APY. Attempt 2: next-best.
- If no live or cached upstream data exists, the service returns a structured failed execution rather than synthetic options

### RiskAgent Evaluation

Four inputs determine the decision:

**1. Local risk scoring:**
- High risk → always reject (+60 riskScore)
- Medium risk + APY ≥ threshold → reject (+40)
- Medium risk near threshold → extra scrutiny (+15)
- Medium risk below threshold → approve (+20)
- Low risk → approve (0)

**2. ENS reputation tiers:**

| Tier | Score | Effect |
|---|---|---|
| Strong | ≥ 0.9 | +0.1 confidence, threshold raised to 4.55 |
| Neutral | 0.7–0.9 | No change, threshold 4.5 |
| Weak | < 0.7 | -0.1 confidence, threshold lowered to 4.4 |

**3. AXL peer consensus:**

| Approval Ratio | Effect |
|---|---|
| ≥ 70% | +0.1 confidence (boost) |
| < 30% | -0.1 confidence (penalty), can trigger retry |
| Mixed / None | No change |

**4. 0G protocol memory:**

| Historical Success Rate | Effect |
|---|---|
| > 90% | +0.05 confidence |
| < 60% | -0.05 confidence and +10 riskScore |
| Unavailable / no stats | No decision influence; trace shows fail-safe |

Memory also informs retry selection by preferring the available alternative with the highest success rate, then highest average confidence.

**5. Optional LLM blending:**
- `finalConfidence = deterministic * 0.7 + llmConfidence * 0.3`
- LLM never overrides decisions or triggers retries

Final decision: `riskScore >= 35` → reject.

### Retry Logic
- Triggered by: risk rejection OR AXL penalty
- Maximum 1 retry (2 attempts total)
- Retry always excludes the rejected protocol
- If 0G memory has stats for alternatives, retry prefers higher successRate and avgConfidence
- Demo mode injects memory where Morpho has low historical success and Aave/Aave V3 has high historical success

## Trace-Centric Design

Every stage appends an `AgentTrace` entry with:
- `agent`: ENS-style identity (e.g., `yield.relay.eth`)
- `step`: stage label (`analyze`, `evaluate`, `review`, `retry`, `execute`)
- `message`: human-readable explanation
- `metadata`: structured diagnostic payload (ENS influence, AXL influence, memory influence, confidence)
- `timestamp`: strictly increasing synthetic timeline

Before returning, the system validates:
- All 4 agents appear in trace
- Timestamps are strictly increasing
- Output contract is valid (protocol, APY, status, explanation, decisionImpact)

## Data Contracts

| Type | Purpose |
|---|---|
| `ExecutionRequest` | Intent + optional context (ens, wallet, demo, debug) |
| `ExecutionResponse` | Full response: trace, result, summary, debug |
| `AgentTrace` | Single trace entry |
| `ExecutionSummary` | Human-readable summary with decisionImpact |
| `ENSInfluence` | Tier, score, effect on risk tolerance |
| `AXLInfluence` | Approval ratio, decision impact, simulation flag from peer metadata |
| `DecisionImpact` | One-line ENS + AXL impact descriptions |
| `YieldOption` | Protocol, APY, risk level |
| `ExecutionMemory` | Append-only 0G log entry for an execution |
| `ProtocolStats` | 0G KV aggregate stats used by RiskAgent and retry selection |
