# RelayX

RelayX is a two-service TypeScript project for intent-centric DeFi execution:

1. **Backend (`backend/`)**: Express API that receives an intent, runs a multi-agent orchestration flow (yield discovery → risk review → execution), and returns a traceable response.
2. **Frontend (`frontend/`)**: Next.js App Router UI with a landing page and dashboard that submits intents and visualizes orchestration traces.

AXL runs as standalone infrastructure. Runtime path is:
**Frontend → Backend API → AXL Node** (frontend does not call AXL directly).

## Repository Layout

```text
RelayX/
├── backend/                 # Express + TypeScript API
├── frontend/                # Next.js + React UI
├── docs/                    # Deep project documentation
├── nodemon.json             # Root nodemon config (watch settings)
└── package-lock.json        # Root lockfile (no root package scripts)
```

## Quick Start

### 1) Configure backend environment

RelayX backend reads:

- `ALCHEMY_MAINNET_RPC_URL` (required for live ENS resolution)
- `AXL_BASE_URL` (optional, defaults to `http://localhost:3005`)

```bash
export ALCHEMY_MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/<your-key>"
export AXL_BASE_URL="http://localhost:3005"
```

### 2) Start AXL node (mock for local dev)

```bash
cd backend
npm install
npm run axl:mock
```

AXL mock listens on `http://localhost:3005`.
If you run a real AXL node, set `AXL_BASE_URL` to that endpoint instead.

### 3) Start backend

```bash
cd backend
npm run dev
```

Backend listens on `http://localhost:3001`.
AXL health probe is available at `http://localhost:3001/axl-health`.

### 4) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000` and rewrites `/api/*` to the backend (`http://localhost:3001/*`).

## Core API

- `GET /health` → `{ "status": "ok" }`
- `POST /execute` with:

```json
{
  "intent": "Find the safest yield for 1000 USDC",
  "context": {}
}
```

Returns:

- full agent trace (`trace`)
- execution output (`final_result`)
- summary (`summary`)
- debug metadata (`debug`)

## Documentation

Detailed docs are in `docs/`:

- `docs/README.md` (documentation index)
- `docs/architecture.md`
- `docs/backend.md`
- `docs/frontend.md`
- `docs/api-reference.md`
- `docs/development-runbook.md`
- `docs/current-limitations.md`
- `docs/repository-map.md`
