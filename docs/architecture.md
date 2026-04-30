# RelayX Architecture

## System Overview

RelayX is an intent-centric DeFi execution engine built on a multi-agent orchestration pattern. A user submits a natural language intent, and three specialized agents collaborate — with real external data from DefiLlama, ENS, and AXL — to find the best yield, assess risk, and execute a deposit.

## Runtime Topology

```
User Browser → Next.js Frontend (:3000)
                  ↓ POST /api/execute (rewritten to backend)
              Express Backend (:3001)
                  ↓
              ExecutionService
                  ├── DefiLlama API (live yield data)
                  ├── ENS Resolution (Ethereum mainnet via viem)
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
 6. [risk.relay.eth]      Review selection — ENS tier + AXL consensus
 7. [risk.relay.eth]      AXL consensus: X/Y approved → confidence adjustment
 8. [risk.relay.eth]      Decision: approve or reject
 9. [system.relay.eth]    (If rejected) Retry with next-best protocol
10. [yield.relay.eth]     (Retry) Select alternative protocol
11. [risk.relay.eth]      (Retry) Review alternative — approve
12. [system.relay.eth]    Final plan selected
13. [executor.relay.eth]  Execute deposit, broadcast to AXL
14. [system.relay.eth]    Execution completed
```

## Decision Model

### Data Sources

| Source | What It Provides | Fallback |
|---|---|---|
| DefiLlama | Live APY data for DeFi protocols | Cached data, then Aave+Compound fallback |
| ENS | On-chain reputation (address, text records) | Neutral score (0.7) |
| AXL | Peer consensus (approve/reject ratios) | Empty responses (no influence) |
| OpenAI | LLM reasoning + confidence adjustment | Ignored entirely |

### YieldAgent Selection
- Fetches live data from DefiLlama, filtered by asset, Ethereum chain, $1M+ TVL
- Merges AXL peer suggestions (local data takes priority for duplicates)
- Attempt 1: highest APY. Attempt 2: next-best.
- Demo mode ensures Morpho (medium) + Aave (low) + Compound (low) are available

### RiskAgent Evaluation

Three inputs determine the decision:

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

**4. Optional LLM blending:**
- `finalConfidence = deterministic * 0.7 + llmConfidence * 0.3`
- LLM never overrides decisions or triggers retries

Final decision: `riskScore >= 35` → reject.

### Retry Logic
- Triggered by: risk rejection OR AXL penalty
- Maximum 1 retry (2 attempts total)
- Retry always selects a different protocol (attempt-based index)
- Demo mode guarantees: Morpho rejected → Aave approved

## Trace-Centric Design

Every stage appends an `AgentTrace` entry with:
- `agent`: ENS-style identity (e.g., `yield.relay.eth`)
- `step`: stage label (`analyze`, `evaluate`, `review`, `retry`, `execute`)
- `message`: human-readable explanation
- `metadata`: structured diagnostic payload (ENS influence, AXL influence, confidence)
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
| `AXLInfluence` | Approval ratio, decision impact, simulated flag |
| `DecisionImpact` | One-line ENS + AXL impact descriptions |
| `YieldOption` | Protocol, APY, risk level |
