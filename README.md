# RelayX

RelayX is an intent-centric DeFi execution engine. You tell it what you want — "get best yield on ETH" — and three AI agents collaborate to find the optimal protocol, assess risk using on-chain ENS reputation and AXL peer consensus, and execute the deposit. Every decision is traceable and explainable.

## How It Works

1. **YieldAgent** fetches live APY data from DefiLlama, merges AXL peer suggestions, and selects the highest-yielding protocol.
2. **RiskAgent** evaluates the selection using real ENS on-chain reputation data, AXL network peer consensus, and 0G-backed historical protocol memory. If risk is too high, it rejects.
3. On rejection, the system **retries** with the next-best protocol, preferring historically stronger protocols when memory is available.
4. **ExecutorAgent** gets a real swap quote from Uniswap or CoinGecko, prepares the approved deposit result, and broadcasts the result to the AXL network.

Every step produces a structured trace entry, so the entire decision process is auditable.

## Key Integrations

| Integration | What It Does | Data Source |
|---|---|---|
| **DefiLlama** | Live DeFi yield data | `https://yields.llama.fi/pools` |
| **ENS** | On-chain reputation scoring | Ethereum mainnet via viem |
| **Uniswap** | Authenticated swap route quotes | `https://api.uniswap.org/v1/quote` |
| **CoinGecko** | Spot-price quote fallback | `https://api.coingecko.com/api/v3/simple/price` |
| **AXL** | Peer-to-peer agent consensus | Multi-node HTTP network |
| **0G Storage** | Persistent execution memory | KV stats + append-only execution log |
| **OpenAI** (optional) | LLM-enhanced reasoning | `OPENAI_API_KEY` |

RelayX no longer ships synthetic yield or quote datapoints. If an upstream source is down, the backend uses cached upstream data when available; if no real or cached yield data exists, it returns a structured failed execution instead of inventing a protocol.

## Quick Start

```bash
# 1. Set environment (ENS requires Alchemy RPC)
export ALCHEMY_MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/<key>"
export UNISWAP_API_KEY="<key>"          # optional; CoinGecko quote fallback works without it
export COINGECKO_API_KEY="<key>"        # optional; improves CoinGecko rate limits
export ZEROG_MEMORY_KV_URL="<0g-kv-rpc>"      # optional; enables protocol stats
export ZEROG_MEMORY_LOG_URL="<0g-log-rpc>"    # optional; enables execution history

# 2. Backend
cd backend && npm install && npm run dev    # port 3001

# 3. Frontend
cd frontend && npm install && npm run dev   # port 3000

# 4. Tests (129 tests)
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

# With ENS context
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH","context":{"ens":"vitalik.eth"}}'

# Demo mode (seeded 0G memory: Morpho low, Aave high)
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
│   │   ├── adapters/        # ENS, AXL, DefiLlama, 0G memory, LLM adapters
│   │   ├── controllers/     # Express route handlers
│   │   ├── types/           # TypeScript interfaces (zero any)
│   │   └── __tests__/       # 129 tests (vitest)
│   └── scripts/             # AXL development relay
├── frontend/          # Next.js UI
└── docs/              # Documentation
```

## Documentation

See [`docs/`](docs/README.md) for architecture, API reference, backend deep dive, and development runbook.
