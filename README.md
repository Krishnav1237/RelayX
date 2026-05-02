# RelayX

RelayX is an intent-centric DeFi execution engine. You tell it what you want — "get best yield on ETH" — and three AI agents collaborate to find the optimal protocol, assess risk using on-chain ENS reputation and AXL peer consensus, and execute the deposit. Every decision is traceable and explainable.

## How It Works

1. **YieldAgent**: Fetches live APY data from DefiLlama, merges AXL peer suggestions, and selects the highest-yielding protocol.
2. **RiskAgent**: Evaluates the selection using real ENS on-chain reputation data, AXL network peer consensus, and **0G-backed historical protocol memory**. If risk is too high, it rejects.
3. **Multi-Factor Decision Logic**: On rejection, the system **retries** with the next-best protocol, preferring historically stronger protocols when memory is available.
4. **ExecutorAgent**: Gets a real swap quote from Uniswap or CoinGecko, prepares the approved deposit result, and computes a dynamic execution confidence score.
5. **Explainable AI**: An LLM-enhanced reasoning layer (Groq/Llama) provides a natural language explanation for every decision, including the trade-offs made between yield, risk, and memory.

## Key Features

- **Confidence Breakdown**: Every execution displays a 3-part confidence score (Yield, Risk, Execution).
- **Historical Memory**: Protocols are boosted or penalized based on past success rates stored in the 0G memory layer.
- **ENS Reputation**: Real-time on-chain scoring of the user's ENS name affects the system's risk tolerance.
- **AXL Consensus**: Decisions are verified against a P2P network of agent nodes.

## Key Integrations

| Integration           | What It Does                    | Data Source                                     |
| --------------------- | ------------------------------- | ----------------------------------------------- |
| **DefiLlama**         | Live DeFi yield data            | `https://yields.llama.fi/pools`                 |
| **ENS**               | On-chain reputation scoring     | Ethereum mainnet via viem                       |
| **Uniswap**           | Authenticated swap route quotes | `https://api.uniswap.org/v1/quote`              |
| **CoinGecko**         | Spot-price quote fallback       | `https://api.coingecko.com/api/v3/simple/price` |
| **AXL**               | Peer-to-peer agent consensus    | Multi-node HTTP network                         |
| **0G Storage**        | Persistent execution memory     | KV stats + append-only execution log            |
| **Groq / OpenRouter** | LLM-enhanced reasoning          | `GROQ_API_KEY` or `OPENROUTER_API_KEY`          |

## Quick Start

### 1. Configure Environment

Copy `backend/.env.example` to `backend/.env` and fill in your keys:

- `GROQ_API_KEY`: Required for natural language reasoning.
- `ALCHEMY_MAINNET_RPC_URL`: Highly recommended for ENS resolution (avoids public RPC timeouts).
- `UNISWAP_API_KEY`: Optional; falls back to CoinGecko if missing.

### 2. Run Services

Run each of these in a separate terminal:

```bash
# 1. Start AXL Peer Node (handles consensus)
cd backend && npm run axl:node

# 2. Start Backend Server
cd backend && npm run dev

# 3. Start Frontend Dashboard
cd frontend && npm run dev
```

### 3. Verification

Visit `http://localhost:3000` to open the dashboard. You can also run the full test suite:

```bash
cd backend && npm test
```

## API Reference

```bash
# Execute intent
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH","context":{"ens":"vitalik.eth"}}'

# Demo mode (uses seeded 0G memory for Aave/Morpho)
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH","context":{"demo":true}}'
```

## Repository Layout

```
RelayX/
├── backend/           # Express + TypeScript API
│   ├── src/
│   │   ├── orchestrator/    # ExecutionService (Core logic)
│   │   ├── agents/          # Yield, Risk, and Executor Agents
│   │   ├── adapters/        # ENS, AXL, DefiLlama, 0G, LLM
│   │   └── controllers/     # API routes
│   └── scripts/             # AXL simulation node
├── frontend/          # Next.js Dashboard UI
└── docs/              # Detailed architecture & integration guides
```

## Documentation

See [`docs/`](docs/README.md) for architecture diagrams, API reference, and development runbooks.
