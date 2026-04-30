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

# Optional — enables LLM reasoning
export OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4o-mini"   # default
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
[BOOT] Server running on port 3001
```

### AXL Mock Node (optional)

```bash
cd backend && npm run axl:mock
```

Listens on `http://localhost:3005`. If not running, backend continues with empty AXL responses.

### Frontend

```bash
cd frontend && npm run dev
```

Listens on `http://localhost:3000`. Rewrites `/api/*` to backend.

## Testing

```bash
cd backend && npm test
```

Runs 92 tests via Vitest across 11 files. Tests hit real DefiLlama and ENS APIs (with graceful fallback).

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

# Demo mode (guaranteed retry path)
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH","context":{"demo":true}}'

# With ENS context
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"get best yield on ETH","context":{"ens":"vitalik.eth"}}'

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
- ENS data is cached for 5 minutes per name
- AXL calls are parallelized across 3 nodes with 1.5s timeout each
- If all external services are down, system continues with fallback data
- Demo mode uses stable protocols (Morpho, Aave, Compound) to guarantee retry path
