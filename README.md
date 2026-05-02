# RelayX

> Autonomous DeFi agent system for intelligent yield farming with deterministic decision-making, on-chain reputation signals, and cross-node collaboration.

## Overview

RelayX is a production-ready agent orchestration framework built with:

- **YieldAgent**: Analyzes user intent and fetches live yield data from DefiLlama
- **RiskAgent**: Evaluates protocols against deterministic risk thresholds
- **ExecutorAgent**: Prepares and executes deposits with swap quoting
- **ENS Reputation Layer**: Uses real on-chain ENS data (vitalik.eth, ens.eth, nick.eth) as reputation signals
- **AXL Integration**: Enables cross-node agent collaboration via a local infrastructure node
- **Deterministic Logic**: Core decisions are rule-based (no LLM required); optional LLM for explanations
- **Full Trace & Memory**: Complete execution history with confidence metrics and protocol success tracking
- **Type-Safe API**: TypeScript backend (Express) + Next.js/React frontend

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

Backend API runs on `http://localhost:3001`:
- `POST /analyze` — Analyze intent, receive pending approval with trace
- `POST /execute/confirm` — Execute approved plan
- `POST /execute` — Convenience: analyze + execute in one call
- `GET /health` — Server health
- `GET /axl-health` — AXL infrastructure status
- `GET /yield-health` — DefiLlama data availability
- `GET /ens-health` — ENS resolution capability

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000` and proxies `/api/*` to backend.

### Optional: Local AXL Infrastructure Node

```bash
cd backend
npm run axl:node
```

Starts AXL mock/relay node on `http://localhost:3005` (configurable via `AXL_BASE_URL`).

## Execution Lifecycle

### Analyze → Approve → Execute Flow

1. **User sends intent** → `POST /analyze`
2. **YieldAgent** evaluates intent → fetches live yield options
3. **RiskAgent** assesses risk vs. APY → approves or rejects
4. **Retry (if needed)** → YieldAgent selects second option, RiskAgent reviews
5. **Pre-execution quote** → ExecutorAgent fetches Uniswap swap quote
6. **Pending approval** → Response includes `approval.id` (5 min TTL)
7. **User reviews** → `POST /execute/confirm` with approval ID
8. **ExecutorAgent** executes → returns final result with full trace

**Convenience**: `/execute` skips approval and runs all steps in one call.

## Key Features

| Feature | Details |
|---------|---------|
| **ENS Signals** | Resolves vitalik.eth, ens.eth, nick.eth to derive reputation score (0.0–1.0) → affects RiskAgent confidence |
| **Memory Layer** | Tracks protocol success rates; influences retry selection and confidence adjustments |
| **AXL Broadcast** | YieldAgent broadcasts yield requests; RiskAgent requests consensus; ExecutorAgent signals results |
| **Deterministic** | All decisions use rule-based logic; no randomness; same input → same output |
| **Timeout Protection** | ENS calls, yield data, swaps all have timeout guards; failures degrade gracefully |
| **Caching** | ENS (5 min TTL), yield data, swap quotes all cached to reduce redundant calls |

## Configuration

### Backend Environment

```bash
# RPC for ENS resolution (Alchemy recommended)
ALCHEMY_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# AXL infrastructure node URL
AXL_BASE_URL=http://localhost:3005

# Optional: LLM for explanations (OpenRouter or Groq)
OPENROUTER_API_KEY=sk-...
GROQ_API_KEY=gsk-...

# Optional: Uniswap API for swap quotes
UNISWAP_API_KEY=your_uniswap_api_key

# Optional: 0G Memory storage
ZEROG_MEMORY_KV_URL=...
ZEROG_MEMORY_LOG_URL=...
```

## Documentation

- [Architecture & Data Flow](./docs/architecture.md)
- [Backend Design](./docs/backend.md) — Agents, adapters, orchestration
- [Frontend Implementation](./docs/frontend.md) — UI flow, API integration
- [API Reference](./docs/api-reference.md) — Request/response contracts
- [Development Runbook](./docs/development-runbook.md) — Local setup, debugging
- [Current Limitations](./docs/current-limitations.md) — Known constraints
- [Repository Map](./docs/repository-map.md) — File structure
- [LLM Setup](./docs/llm-setup.md) — Optional reasoning adapter config

## Testing

```bash
cd backend
npm run test        # Run full test suite (Vitest)
npm run test:watch  # Watch mode
```

Test suite covers:
- Agent decision logic (YieldAgent, RiskAgent, ExecutorAgent)
- Adapter behavior (ENS, AXL, Uniswap, memory)
- End-to-end execution scenarios
- Edge cases and confidence bounds

## Architecture Diagram

```
Frontend (Next.js/React)
    ↓ /api/analyze, /api/execute
Backend (Express/TypeScript)
    ↓
ExecutionService (Orchestrator)
    ├── YieldAgent (fetch + merge)
    ├── RiskAgent (approve/reject)
    ├── ExecutorAgent (quote + execute)
    └── Adapters
        ├── ENSAdapter (viem + cache)
        ├── YieldDataAdapter (DefiLlama + cache)
        ├── UniswapAdapter (quote fallback to CoinGecko)
        ├── AXLAdapter (broadcast to peers)
        ├── ZeroGMemoryAdapter (optional)
        └── ReasoningAdapter (optional LLM)
    ↓
AXL Infrastructure Node (optional, localhost:3005)
```

## Examples

### Simple Yield Request

```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "find best yield on ETH",
    "context": { "debug": true }
  }'
```

### With User ENS

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "find best USDC yield",
    "context": {
      "ens": "vitalik.eth",
      "debug": true
    }
  }'
```

### Two-Step Approval Flow

```bash
# Step 1: Analyze
APPROVAL=$(curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent":"find best yield on ETH"}' | jq -r '.approval.id')

# Step 2: Confirm
curl -X POST http://localhost:3001/execute/confirm \
  -H "Content-Type: application/json" \
  -d "{\"approvalId\":\"$APPROVAL\"}"
```

## Deployment

The system is designed for:
- **Local development**: All services run locally
- **Production**: Backend API + AXL nodes deployed independently
- **Cloud**: Containerized via Docker (add `Dockerfile` in backend/frontend as needed)

See [development-runbook.md](./docs/development-runbook.md) for deployment steps.

## Contributing

- Follow TypeScript strict mode conventions
- Add tests for new adapters and agent logic
- Update relevant docs when changing behavior
- Ensure all commands in docs remain accurate
