# Development Runbook

## Prerequisites

- Node.js 18+
- npm
- Alchemy Ethereum mainnet RPC URL (recommended for ENS)

## Environment Variables

```bash
# Required for live ENS resolution (falls back to public RPC if not set)
export ALCHEMY_MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/<key>"

# Optional — defaults to http://localhost:3005
export AXL_BASE_URL="http://localhost:3005"
export AXL_PEER_URLS="https://peer-one.example,https://peer-two.example"

# Optional — enables Uniswap route quotes; CoinGecko is used when unset
export UNISWAP_API_KEY="<key>"
export COINGECKO_API_KEY="<key>"  # optional, improves CoinGecko rate limits

# Optional — enables 0G-backed persistent memory
export ZEROG_MEMORY_KV_URL="http://<kv-node-or-writer>"
export ZEROG_MEMORY_LOG_URL="http://<log-writer>"
export ZEROG_MEMORY_STREAM_ID="relayx.execution.memory"

# Optional — enables LLM reasoning (choose one)
# OpenRouter (Free tier available)
export OPENROUTER_API_KEY="your_key_here"
export OPENROUTER_MODEL="meta-llama/llama-3.1-8b-instruct:free"  # default

# OR Groq (Free tier available)
export GROQ_API_KEY="your_key_here"
export GROQ_MODEL="llama-3.1-8b-instant"  # default
```

## Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Run Services

### Backend

```bash
cd backend && npm run dev
```

Listens on `http://localhost:3001`. Boot log shows integration status:

```
[BOOT] ENS RPC: configured
[BOOT] AXL base: http://localhost:3005
[BOOT] LLM: disabled
[BOOT] Uniswap API: disabled (CoinGecko quote fallback active)
[BOOT] 0G memory: disabled
[BOOT] Server running on port 3001
```

### AXL Development Relay (optional)

```bash
cd backend && npm run axl:node
```

Listens on `http://localhost:3005`. It forwards `/message` and `/broadcast` to comma-separated `AXL_PEER_URLS`. If not running, or if no peers are configured, backend continues with empty AXL responses.

### Frontend

```bash
cd frontend && npm run dev
```

Listens on `http://localhost:3000`. Rewrites `/api/*` to backend.

## Testing

```bash
cd backend && npm test
```

Runs 129 tests via Vitest across 14 files. Tests use API-shaped upstream fixtures for DefiLlama and CoinGecko, plus an injected 0G memory store for deterministic memory scenarios.

## Health Checks

```bash
curl http://localhost:3001/health        # Server up
curl http://localhost:3001/axl-health    # AXL node connectivity
curl http://localhost:3001/yield-health  # DefiLlama data availability
curl http://localhost:3001/ens-health    # ENS RPC connectivity
```

## Execute Intent

```bash
# Standard execution
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH"}'

# With ENS context
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH","context":{"ens":"vitalik.eth"}}'

# Demo mode (seeded 0G memory: Morpho low success, Aave high success)
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH","context":{"demo":true}}'

# Debug mode (determinism check)
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH","context":{"debug":true}}'
```

## Build

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

## Operational Notes

- DefiLlama data is cached for 60 seconds per asset
- Stale DefiLlama cache can be used for 10 minutes; no synthetic yield options are generated
- Uniswap quote data is cached for 30 seconds per token pair/amount
- CoinGecko spot prices are used when Uniswap is not configured or unavailable
- 0G memory stores protocol stats in KV and execution history in an append-only log
- If 0G memory is unavailable, risk and retry decisions remain deterministic and trace the fallback
- ENS data is cached for 5 minutes per name
- AXL calls are parallelized across 3 nodes with 1.5s timeout each
- If no live or cached yield data exists, `/execute` returns a structured failed execution instead of invented protocol data
