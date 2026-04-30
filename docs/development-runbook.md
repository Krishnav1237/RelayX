# Development Runbook

## 1) Prerequisites

- Node.js (modern version compatible with Next 16 and TypeScript toolchain)
- npm
- Alchemy Ethereum mainnet RPC URL for ENS (`ALCHEMY_MAINNET_RPC_URL`)

## 2) Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

## 3) Run Services

### AXL Node (recommended for local collaboration flow)

RelayX backend posts AXL messages to `AXL_BASE_URL` (default: `http://localhost:3005`).

Use the included mock node:

```bash
cd backend
npm run axl:mock
```

Expected startup output:

- `[AXL MOCK] running on http://localhost:3005`
- `[AXL MOCK] routes: GET /health, POST /message, POST /broadcast`

If you have a real AXL node, point backend to it with:

```bash
export AXL_BASE_URL="http://<your-axl-host>:3005"
```

### Backend

Set ENS + AXL environment variables before starting backend:

```bash
export ALCHEMY_MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/<your-key>"
export AXL_BASE_URL="http://localhost:3005"
```

```bash
cd backend
npm run dev
```

- URL: `http://localhost:3001`
- Health check: `GET /health`
- AXL health proxy: `GET /axl-health` (backend checks `AXL_BASE_URL/health`)

### Frontend

```bash
cd frontend
npm run dev
```

- URL: `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard`
- API path used by UI: `/api/execute` (rewritten to backend)
- Frontend must not call AXL directly; it only consumes backend API responses.

## 4) Build Commands

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

## 5) Linting

Frontend includes ESLint script:

```bash
cd frontend
npm run lint
```

Backend currently has no dedicated lint script in `package.json`.

## 6) Operational Notes

- Backend uses deterministic protocol candidates.
- ENS and AXL adapters are active in runtime flow; remaining adapters are placeholders.
- If AXL node is unreachable, backend continues using deterministic simulated peer responses (non-blocking fallback).
- Root-level `package-lock.json` exists but there is no root `package.json` with orchestrating scripts.

## 7) AXL Verification Commands

Health:

```bash
curl http://localhost:3005/health
```

Broadcast dry run:

```bash
curl -X POST http://localhost:3005/broadcast \
  -H "Content-Type: application/json" \
  -d '{"payload":{"from":"yield.relay.eth","to":"axl.network","type":"yield_request","payload":{"intent":"maximize yield"},"timestamp":1710000000000}}'
```

Expected response shape:

- top-level `responses` array
- each item contains peer output (`option`, `decision`, or `acknowledged`)
