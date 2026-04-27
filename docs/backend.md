# Backend Deep Dive (`backend/`)

## 1) Stack and Build

- **Runtime**: Node.js
- **Language**: TypeScript (strict mode enabled)
- **Framework**: Express 5
- **Dev run**: `npm run dev` (`nodemon src/index.ts`)
- **Build**: `npm run build` (`tsc`)
- **Output**: `dist/`

## 2) Entry Point and Routing

File: `src/index.ts`

- Creates Express app.
- Enables JSON parsing with `express.json()`.
- Exposes:
  - `GET /health` → uptime health response.
  - `POST /execute` → orchestration endpoint.
- Binds server on port `3001`.

## 3) Controller Layer

File: `src/controllers/execute.controller.ts`

`executeHandler(req, res)`:

1. Reads `{ intent, context }` from request body.
2. Validates `intent` is a non-empty string.
3. Builds `ExecutionRequest`.
4. Calls `ExecutionService.execute()`.
5. Returns JSON response or 500 on thrown errors.

## 4) Orchestration Core

File: `src/orchestrator/ExecutionService.ts`

`ExecutionService.execute(request)` performs the full pipeline:

1. Resolves ENS identity + text records (`success_rate`, `reputation`, `role`, etc.) for core agents once per request.
2. Starts trace with `system.relay.eth`.
3. Calls `YieldAgent.think(intent, attempt=1)`.
4. Calls `RiskAgent.review(selectedOption)` with ENS-derived risk signals.
5. If rejected and retries remain:
   - appends system retry trace
   - runs `YieldAgent` again with `attempt=2`
   - re-runs `RiskAgent`
6. Appends final-plan trace.
7. Calls `ExecutorAgent.execute(finalPlan, attempt)`.
8. Appends completion trace.
9. Computes final confidence from yield + risk + execution confidence values.
10. Returns `ExecutionResponse` including `trace`, `final_result`, `summary`, and `debug`.

## 5) Agent Modules

### `src/agents/BaseAgent.ts`

Defines shared identity (`id`, `name`) and structured trace logging helper.

### `src/agents/YieldAgent.ts`

- Holds static protocol options.
- Sorts options by APY descending.
- Selects by attempt index (`attempt-1`) for deterministic fallback.
- Emits analysis and evaluation traces with confidence metadata.

### `src/agents/RiskAgent.ts`

- Reviews selected plan risk profile.
- Produces a deterministic decision function across APY + `riskLevel` + ENS signals (`successRate`, `reputation`, `role`).
- Low ENS success rate (<0.7) tightens rejection and lowers confidence.
- High ENS success rate (>0.9) increases confidence and allows slightly higher medium-risk APY.
- Emits `ensInfluence` metadata in risk trace entries.

### `src/agents/ExecutorAgent.ts`

- Emits execution start + completion trace entries.
- Returns successful mock execution result.

## 6) Types and Utility

- `src/types/index.ts`: authoritative backend interfaces for request/response and agent outputs.
- `src/utils/index.ts`: module-scoped logger helper around `console`.

## 7) Adapter Layer (Current State)

Files in `src/adapters/`:

- `ENSAdapter.ts` (implemented): viem-based Ethereum mainnet ENS resolution + text-record lookup + in-memory cache (5-minute TTL).
- `AXLAdapter.ts` (Axelar placeholder)
- `ExecutionAdapter.ts` (KeeperHub placeholder)
- `MemoryAdapter.ts` (0G storage placeholder)
- `SwapAdapter.ts` (Uniswap placeholder)

Execution orchestration now resolves ENS identity metadata for backend agents once per request and enriches trace metadata with that identity context.

## 8) Configuration Files

- `package.json`: backend scripts and dependencies.
- `tsconfig.json`: strict TS compiler settings, NodeNext module resolution.
- `.gitignore`: ignores `node_modules`, `dist`, logs, env files.
- `nodemon.json`: watches `src` with `.ts` extension.
