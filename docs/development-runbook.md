# Development Runbook

Local setup, debugging, and deployment guide for RelayX.

---

## Local Setup

### 1. Prerequisites

- Node.js 18+
- npm 9+
- MetaMask browser extension (for on-chain execution)
- Sepolia testnet ETH (get at [sepoliafaucet.com](https://sepoliafaucet.com))

### 2. Clone & Install

```bash
git clone https://github.com/Krishnav1237/RelayX.git
cd RelayX
cd backend && npm install
cd ../frontend && npm install
```

### 3. Environment Configuration

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in the values:

```bash
# ── Chain & RPC ───────────────────────────────────────────────────────────────
# Chain for ENS resolution and Uniswap quoting: mainnet | sepolia
RELAYX_CHAIN=sepolia

# Alchemy free-tier RPC (recommended for reliable ENS + QuoterV2)
ALCHEMY_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ALCHEMY_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
# Get free keys at: https://dashboard.alchemy.com

# ── ENS Identity ──────────────────────────────────────────────────────────────
RELAYX_AGENT_ENS_ROOT=relayx.eth
RELAYX_DEFAULT_ENS_SOURCES=system.relayx.eth,ens.eth,nick.eth
ENS_CACHE_TTL_MS=300000
ENS_TEXT_RECORD_KEYS=description,url,com.twitter,com.github

# ── Gensyn AXL Peer Network ───────────────────────────────────────────────────
# Real AXL binary (optional): https://github.com/gensyn-ai/axl
AXL_NODE_URL=http://127.0.0.1:9002
# Sim node fallback (auto-started by npm run dev:full)
AXL_BASE_URL=http://localhost:3005
AXL_TIMEOUT_MS=1500

# ── Uniswap V3 QuoterV2 (no API key — uses your Alchemy RPC) ─────────────────
# Sepolia QuoterV2: 0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3 (auto-selected)
# Mainnet QuoterV2: 0x61fFE014bA17989E743c5F6cB21bF9697530B21e (auto-selected)
# Override: UNISWAP_QUOTER_V2_ADDRESS=0x...
# COINGECKO_API_KEY=CG-...    # optional, raises rate limits

# ── 0G Galileo Testnet (chain 16602) — Backend-only ──────────────────────────
# Get tokens at: https://faucet.0g.ai  |  Explorer: https://explorer.0g.ai
ZEROG_EVM_RPC=https://evmrpc-testnet.0g.ai
ZEROG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
ZEROG_PRIVATE_KEY=0x_YOUR_TESTNET_PRIVATE_KEY
ZEROG_CHAIN_ID=16602
# Leave ZEROG_PRIVATE_KEY empty to use in-memory fallback (no 0G needed)

# ── Safety & Rate Limits ──────────────────────────────────────────────────────
APPROVAL_TTL_MS=300000
MAX_INTENT_LENGTH=1000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120

# ── Yield Discovery ───────────────────────────────────────────────────────────
YIELD_SUPPORTED_ASSETS=ETH,USDC,USDT,DAI,WETH,WBTC,STETH
DEFILLAMA_CHAIN=Ethereum

# ── Optional LLM (OpenRouter priority > Groq) ─────────────────────────────────
# OPENROUTER_API_KEY=sk-or-...
# GROQ_API_KEY=gsk_...

# ── Server ────────────────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:3000
PORT=3001
```

**Frontend** (`frontend/.env.local`) — usually not needed:

```bash
# Only needed if backend is not on localhost:3001
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

### 4. Start Services

**Option A — All in one (recommended)**:

```bash
cd backend
npm run dev:full    # starts backend + AXL sim node together
```

Then in another terminal:

```bash
cd frontend
npm run dev
```

**Option B — Manually**:

```bash
# Terminal 1: AXL sim node
cd backend && npm run axl:node

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

### 5. Verify Setup

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","chain":"sepolia","chainId":11155111}

curl http://localhost:3001/integration-health
# Expected: {"axl":"ok","uniswap":"fallback","memory":"fallback","ens":"ok"}
```

- `uniswap: fallback` = CoinGecko fallback active (set `ALCHEMY_SEPOLIA_RPC_URL` for `ok`)
- `memory: fallback` = in-memory mode (set `ZEROG_PRIVATE_KEY` for `ok`)

Open `http://localhost:3000` and submit: `find best yield on ETH`

---

## Testing

### Run Full Suite

```bash
cd backend
npm test
# Expected: Test Files 15 passed (15) | Tests 140 passed (140)
```

### Run Specific File

```bash
npm test -- ExecutorAgent
npm test -- UniswapAdapter
npm test -- integration
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage

```bash
npm test -- --coverage
```

Test files and what they cover:

| File | Covers |
|---|---|
| `integration.test.ts` | Full E2E pipeline with live data |
| `hardening.test.ts` | Response shape, all agents present |
| `ExecutorAgent.test.ts` | Swap quote, calldata, execution mode |
| `RiskAgent.test.ts` | ENS/AXL/memory influence, approve/reject |
| `YieldAgent.test.ts` | Intent parsing, protocol selection, retry |
| `UniswapAdapter.test.ts` | QuoterV2, CoinGecko fallback |
| `AXLAdapter.test.ts` | Non-blocking broadcast, sim node |
| `ZeroGMemoryAdapter.test.ts` | Memory storage, protocol stats |
| `ENSAdapter.test.ts` | ENS resolution, cache |
| `ExecutionService.test.ts` | Orchestration, approval flow |

---

## Debugging

### 1. Enable Debug Context

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": "find best yield on ETH", "context": {"debug": true}}'
```

Response `debug` block includes:
- `confidenceBreakdown`: `{yield, risk, execution}`
- `ensReputationScore`: computed 0.0–1.0 score
- `ensInfluence`: tier + effect on decision
- `axlInfluence`: peer approval ratio + impact
- `memoryInfluence`: historical success rate used

### 2. Console Log Filtering

```bash
# Watch ENS resolution
npm run dev 2>&1 | grep '\[ENS'

# Watch Uniswap quotes
npm run dev 2>&1 | grep '\[UniswapAdapter\]\|\[UNISWAP\]'

# Watch 0G storage
npm run dev 2>&1 | grep '\[ZeroGMemory\]'

# Watch AXL broadcast
npm run dev 2>&1 | grep '\[AXL'
```

### 3. Trace Inspection

Every response includes a `trace[]` array:

```javascript
trace.forEach(e => console.log(`[${e.agent}] ${e.step} → ${e.message}`));
```

Key trace steps:

| Agent | Step | Meaning |
|---|---|---|
| `system.relayx.eth` | `start` | ENS context built, reputation computed |
| `yield.relayx.eth` | `analyze` | Intent parsed, asset extracted |
| `yield.relayx.eth` | `evaluate` | Protocol options ranked |
| `risk.relayx.eth` | `evaluate` | Risk score computed |
| `risk.relayx.eth` | `approve` or `reject` | Final risk decision |
| `system.relayx.eth` | `retry` | Second protocol selected |
| `executor.relayx.eth` | `quote` | Uniswap/CoinGecko quote fetched |
| `executor.relayx.eth` | `execute` | On-chain transaction confirmed |

### 4. Demo Mode

Exercises retry path with seeded memory without needing real ENS/AXL:

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": "find best yield on ETH", "context": {"demo": true}}'
```

Demo memory seeds:
- Morpho: 42% success rate → rejected on first attempt
- Aave: 92% success rate → approved on retry

### 5. Check Swap Calldata Generation

Pass a wallet address to trigger calldata generation:

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": "swap ETH for USDC", "context": {"wallet": "0xYOUR_ADDRESS"}}'
```

Look for `final_result.swap.calldata` in the response:
```json
{
  "to": "0x3bFA4769...",     // Uniswap SwapRouter02
  "data": "0x...",            // ABI-encoded exactInputSingle
  "value": "1000000000000000000",
  "gasEstimate": "200000",
  "deadline": 1234567890
}
```

---

## Common Issues

### ENS resolution hangs / times out
```
Symptom: No trace entries after "start" step, request times out.
Fix:     Set ALCHEMY_SEPOLIA_RPC_URL (or MAINNET). ENS failures are graceful — check logs for [ENS TIMEOUT].
```

### No yield data
```
Symptom: status: "failed" — "Yield data unavailable"
Fix:     Check DefiLlama: curl https://yields.llama.fi/pools
         Backend logs cache hits: [YieldData] Using cached data
```

### AXL not responding
```
Symptom: Trace shows "AXL: no peers available" (execution continues fine)
Fix:     Start sim node: npm run dev:full
         Verify: curl http://localhost:3005/health
```

### Uniswap: fallback (CoinGecko)
```
Symptom: integration-health shows "uniswap: fallback"
Fix:     Set ALCHEMY_SEPOLIA_RPC_URL so QuoterV2 can be called on-chain.
         Without it, CoinGecko spot prices are used — quotes still work.
```

### Memory: fallback (in-memory)
```
Symptom: memory-health shows "mode: in-memory"
Fix:     Set ZEROG_PRIVATE_KEY + fund wallet at faucet.0g.ai
         Without it, execution history is stored in-process (resets on restart).
```

### MetaMask transaction rejected
```
Symptom: Dashboard shows "Transaction failed or rejected"
Effect:  Nothing written to 0G backend — data purity preserved.
Fix:     Re-submit the intent and try again.
```

### Approval expired
```
Symptom: 404 — "Approval request expired or not found"
Fix:     Re-submit intent (approval TTL = 5 min by default).
         Set APPROVAL_TTL_MS to increase window.
```

---

## Build & Deployment

### Backend Build

```bash
cd backend
npm run build    # compiles TypeScript → dist/index.js
npm start        # runs compiled output
```

### Frontend Build

```bash
cd frontend
npm run build    # Next.js production build → .next/
npm start        # serves production build
```

### Environment Variables for Production

Set these in your deployment platform (Vercel, Railway, Fly.io, etc.):

**Required:**
- `RELAYX_CHAIN=sepolia`
- `ALCHEMY_SEPOLIA_RPC_URL`

**Strongly recommended:**
- `ZEROG_PRIVATE_KEY` (0G Galileo storage)
- `AXL_NODE_URL` (real AXL binary endpoint)

**Optional:**
- `OPENROUTER_API_KEY` / `GROQ_API_KEY` (LLM explanations)
- `COINGECKO_API_KEY` (raises CoinGecko rate limits)
- `FRONTEND_URL` (CORS restriction; default `*`)

### Docker (Example)

**Backend:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Frontend:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Code Style

- **TypeScript** strict mode everywhere
- **Vitest** for all tests
- Add tests for any new adapter or agent logic
- Update the relevant doc in `/docs` when changing public behavior
- All approval IDs, confidence values, and thresholds are configurable — avoid hardcoding

---

## Resources

- [Architecture](./architecture.md) — System design and execution lifecycle
- [API Reference](./api-reference.md) — Endpoint schemas
- [Testing Guide](./testing-guide.md) — Step-by-step test playbook
- [Current Limitations](./current-limitations.md) — Known constraints
