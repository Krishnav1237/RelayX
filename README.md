# RelayX

> Autonomous DeFi agent system with real on-chain execution — deterministic decision-making, ENS reputation signals, Uniswap V3 swap routing, and 0G Galileo testnet storage.

**Status**: Production-grade testnet execution. Tests: **140/140 passing**.

## Overview

RelayX is an agent orchestration framework that analyzes yield intent, assesses risk, generates real Uniswap V3 `SwapCalldata`, presents it to the user for MetaMask signing on Sepolia, then stores the execution record on the 0G Galileo testnet.

| Agent / Layer | Role |
|---|---|
| **YieldAgent** | Parses intent, fetches live yield data from DefiLlama, selects best protocol |
| **RiskAgent** | Evaluates APY vs risk thresholds using ENS reputation, AXL consensus, and memory signals |
| **ExecutorAgent** | Generates Uniswap V3 swap quote + ABI-encoded `SwapCalldata` bound to the user's wallet |
| **ENS Reputation** | Resolves user/wallet ENS on-chain; computes reputation score (0.0–1.0) |
| **AXL Integration** | Broadcasts to Gensyn AXL peers for cross-node consensus (falls back to sim node) |
| **Uniswap V3 QuoterV2** | On-chain price quotes via `quoteExactInputSingle`; CoinGecko fallback |
| **0G Galileo Storage** | Writes execution records to 0G Galileo testnet (chain 16602) post-execution |
| **MetaMask Execution** | Frontend triggers `eth_sendTransaction` on Sepolia before backend confirmation |

---

## Quick Start

### Prerequisites

- Node.js 18+
- MetaMask browser extension (for on-chain execution)
- Sepolia ETH ([sepoliafaucet.com](https://sepoliafaucet.com))

### 1. Install Dependencies

```bash
cd RelayX/backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cd RelayX/backend
cp .env.example .env
# Edit .env — minimum required: RELAYX_CHAIN=sepolia, ALCHEMY_SEPOLIA_RPC_URL
```

### 3. Start Everything

```bash
# Terminal 1 — backend + AXL sim node
cd backend && npm run dev:full

# Terminal 2 — frontend
cd ../frontend && npm run dev
```

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:3000`

---

## Execution Flow

```
User submits intent
       │
  POST /analyze
       │
  ┌─── YieldAgent ──────── fetches DefiLlama, selects protocol
  ├─── RiskAgent ────────── evaluates risk + ENS + AXL + memory
  ├─── Retry (if rejected) ─ selects next protocol
  └─── ExecutorAgent ─────── quotes Uniswap V3, generates SwapCalldata
       │
  Response: { approval, swap.calldata }
       │
  Frontend detects calldata
       │
  MetaMask: eth_sendTransaction → Sepolia
       │
  POST /execute/confirm (only on Tx success)
       │
  Execution stored on 0G Galileo (chain 16602)
       │
  Final result returned to UI
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/analyze` | Analyze intent → return pending approval + SwapCalldata |
| `POST` | `/execute/confirm` | Store confirmed execution to 0G Galileo |
| `POST` | `/execute` | Analyze + confirm in one call (skips MetaMask) |
| `GET` | `/health` | Overall server status |
| `GET` | `/integration-health` | All adapters: axl, uniswap, memory, ens |
| `GET` | `/axl-health` | AXL peer node status |
| `GET` | `/yield-health` | DefiLlama availability |
| `GET` | `/ens-health` | ENS resolution status |
| `GET` | `/quote-health` | Uniswap QuoterV2 status |
| `GET` | `/memory-health` | 0G storage status |

---

## Key Configuration (`backend/.env`)

```bash
# ── Chain & RPC ───────────────────────────────────────────
RELAYX_CHAIN=sepolia                        # mainnet | sepolia
ALCHEMY_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ALCHEMY_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# ── ENS ───────────────────────────────────────────────────
RELAYX_AGENT_ENS_ROOT=relayx.eth
ENS_CACHE_TTL_MS=300000

# ── AXL (Gensyn) ──────────────────────────────────────────
AXL_NODE_URL=http://127.0.0.1:9002          # real AXL binary
AXL_BASE_URL=http://localhost:3005          # sim node fallback
AXL_TIMEOUT_MS=1500

# ── Uniswap V3 (QuoterV2 — no API key needed) ────────────
# UNISWAP_QUOTER_V2_ADDRESS=0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3

# ── 0G Galileo (chain 16602) ──────────────────────────────
ZEROG_PRIVATE_KEY=0x...                     # backend wallet for storage writes
ZEROG_EVM_RPC=https://evmrpc-testnet.0g.ai
ZEROG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai

# ── Safety ────────────────────────────────────────────────
APPROVAL_TTL_MS=300000
MAX_INTENT_LENGTH=1000
RATE_LIMIT_MAX_REQUESTS=120

# ── Optional LLM ──────────────────────────────────────────
OPENROUTER_API_KEY=sk-or-...
# GROQ_API_KEY=gsk_...
```

---

## Testing

```bash
cd backend
npm test            # 140/140 tests (Vitest)
npm run test:watch  # watch mode
```

Test coverage:
- All 4 agents (YieldAgent, RiskAgent, ExecutorAgent, BaseAgent)
- All 6 adapters (ENS, AXL, Uniswap, 0G Memory, YieldData, Reasoning)
- End-to-end orchestration (15 test files)
- Edge cases and confidence bounds

---

## Documentation

| Doc | Contents |
|---|---|
| [Architecture](./docs/architecture.md) | System design, data flow, execution lifecycle |
| [Backend Design](./docs/backend.md) | Agents, adapters, orchestration, decision logic |
| [Frontend](./docs/frontend.md) | UI flow, MetaMask integration, API integration |
| [API Reference](./docs/api-reference.md) | Full request/response schemas |
| [Development Runbook](./docs/development-runbook.md) | Local setup, debugging, deployment |
| [Testing Guide](./docs/testing-guide.md) | Step-by-step test playbook (curl + UI) |
| [Current Limitations](./docs/current-limitations.md) | Known constraints and workarounds |
| [Bug Fixes](./docs/bug-fixes.md) | Fixed issues and resolution history |
| [Repository Map](./docs/repository-map.md) | File structure and ownership |
| [LLM Setup](./docs/llm-setup.md) | Optional reasoning adapter configuration |

---

## Examples

### Simple Yield Request

```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent": "find best yield on ETH", "context": {"debug": true}}'
```

### With ENS Reputation

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": "find safest USDC yield", "context": {"ens": "vitalik.eth"}}'
```

### With Wallet (Generates Real SwapCalldata)

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": "swap ETH for yield", "context": {"wallet": "0xYOUR_ADDRESS"}}'
```

The `final_result.swap.calldata` field in the response is ready to pass to MetaMask `eth_sendTransaction`.

### Two-Step Approval Flow

```bash
# Analyze
APPROVAL=$(curl -s -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent":"find best yield on ETH"}' | jq -r '.approval.id')

# Confirm (after MetaMask tx on frontend)
curl -X POST http://localhost:3001/execute/confirm \
  -H "Content-Type: application/json" \
  -d "{\"approvalId\":\"$APPROVAL\"}"
```

---

## Key Addresses (Sepolia)

| Contract | Address |
|---|---|
| Uniswap V3 QuoterV2 | `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3` |
| Uniswap V3 SwapRouter02 | `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` |
| WETH | `0xfff9976782d46cc05630d1f6ebab18b2324d6b14` |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

## Key Network Info

| Network | Chain ID | Purpose |
|---|---|---|
| Sepolia | 11155111 | ENS resolution + Uniswap execution (user-facing) |
| 0G Galileo | 16602 | Execution memory storage (backend-only) |
