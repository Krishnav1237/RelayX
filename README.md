# RelayX

RelayX is an intent-centric DeFi execution engine. You tell it what you want — "get best yield on ETH" — and three AI agents collaborate to find the optimal protocol, assess risk using on-chain ENS reputation and AXL peer consensus, and execute the deposit. Every decision is traceable and explainable.

## How It Works

1. **YieldAgent** fetches live APY data from DefiLlama, merges AXL peer suggestions, and selects the highest-yielding protocol.
2. **RiskAgent** evaluates the selection using real ENS on-chain reputation data and AXL network peer consensus. If risk is too high, it rejects.
3. On rejection, the system **retries** with the next-best protocol automatically.
4. **ExecutorAgent** executes the approved deposit and broadcasts the result to the AXL network.

Every step produces a structured trace entry, so the entire decision process is auditable.

## Key Integrations

| Integration | What It Does | Data Source |
|---|---|---|
| **DefiLlama** | Live DeFi yield data | `https://yields.llama.fi/pools` |
| **ENS** | On-chain reputation scoring | Ethereum mainnet via viem |
| **AXL** | Peer-to-peer agent consensus | Multi-node HTTP network |
| **OpenAI** (optional) | LLM-enhanced reasoning | `OPENAI_API_KEY` |

All integrations degrade gracefully. If any external service is down, the system continues with fallback data.

## Quick Start

```bash
# 1. Set environment (ENS requires Alchemy RPC)
export ALCHEMY_MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/<key>"

# 2. Backend
cd backend && npm install && npm run dev    # port 3001

# 3. Frontend
cd frontend && npm install && npm run dev   # port 3000

# 4. Tests (92 tests)
cd backend && npm test
```

## API

```bash
# Health checks
curl http://localhost:3001/health
curl http://localhost:3001/axl-health
curl http://localhost:3001/yield-health
curl http://localhost:3001/ens-health

# Execute intent
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH"}'

# Demo mode (guaranteed retry path)
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH","context":{"demo":true}}'
```

## Repository Layout

```
RelayX/
├── backend/           # Express + TypeScript API
│   ├── src/
│   │   ├── orchestrator/    # ExecutionService
│   │   ├── agents/          # YieldAgent, RiskAgent, ExecutorAgent
│   │   ├── adapters/        # ENS, AXL, DefiLlama, LLM adapters
│   │   ├── controllers/     # Express route handlers
│   │   ├── types/           # TypeScript interfaces (zero any)
│   │   └── __tests__/       # 92 tests (vitest)
│   └── scripts/             # AXL mock node
├── frontend/          # Next.js UI
└── docs/              # Documentation
```

## Documentation

See [`docs/`](docs/README.md) for architecture, API reference, backend deep dive, and development runbook.
