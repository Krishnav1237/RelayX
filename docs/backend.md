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
  - `GET /axl-health` → backend-side connectivity check for configured AXL node.
  - `POST /execute` → orchestration endpoint.
- Binds server on port `3001`.
- Runs a startup ENS smoke check (`vitalik.eth`) for RPC diagnostics.
- Reads `AXL_BASE_URL` (default `http://localhost:3005`) for infrastructure AXL connectivity.

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

1. Builds dynamic ENS sources per request:
   - primary: user-provided `context.ens` (when valid)
   - optional: wallet reverse ENS via `context.wallet`
   - optional: resolvable agent ENS identities (`yield.relay.eth`, `risk.relay.eth`)
   - defaults/fallback: `ens.eth`, `nick.eth`, and `vitalik.eth` when no user ENS is provided
   - deterministic source list with dedupe and max 3 entries
2. Resolves the selected ENS sources once per request.
3. Fetches deterministic reputation signals from on-chain ENS state:
   - resolution success (address exists)
   - text record availability (`description`, `url`, `com.twitter`, `com.github`)
   - trusted-source weighting for known ENS sources
4. Builds a global ENS reputation context (`sources`, `resolved`, `reputationScore`).
5. Starts trace with `system.relay.eth`.
6. Calls `YieldAgent.think(intent, attempt=1)`.
7. Calls `RiskAgent.review(selectedOption)` with ENS reputation context.
8. If rejected and retries remain:
   - appends system retry trace
   - runs `YieldAgent` again with `attempt=2`
   - re-runs `RiskAgent`
9. Appends final-plan trace.
10. Calls `ExecutorAgent.execute(finalPlan, attempt)`.
11. Appends completion trace.
12. Computes final confidence from yield + risk + execution confidence values.
13. Returns `ExecutionResponse` including `trace`, `final_result`, `summary`, and `debug`.

## 5) Agent Modules

### `src/agents/BaseAgent.ts`

Defines shared identity (`id`, `name`) and structured trace logging helper.

### `src/agents/YieldAgent.ts`

- Holds static protocol options.
- Sorts options by APY descending.
- Selects by attempt index (`attempt-1`) for deterministic fallback.
- Emits analysis and evaluation traces with confidence metadata.
- Broadcasts `yield_request` over AXL, merges remote suggestions, and deduplicates protocols.

### `src/agents/RiskAgent.ts`

- Reviews selected plan risk profile.
- Produces a deterministic decision function across APY + `riskLevel` + ENS `reputationScore`.
- Low ENS reputation score (<0.7) tightens rejection and lowers confidence.
- High ENS reputation score (>0.85) increases confidence and allows medium-risk APY up to 4.6.
- Emits `ensInfluence` metadata in risk trace entries.
- Broadcasts `risk_request` over AXL and applies remote approval/rejection consensus to confidence.

### `src/agents/ExecutorAgent.ts`

- Emits execution start + completion trace entries.
- Returns successful mock execution result.
- Broadcasts execution outcome over AXL and records peer response metadata.

## 6) Types and Utility

- `src/types/index.ts`: authoritative backend interfaces for request/response and agent outputs.
- `src/utils/index.ts`: module-scoped logger helper around `console`.

## 7) Adapter Layer (Current State)

Files in `src/adapters/`:

- `ENSAdapter.ts` (implemented): viem-based Ethereum mainnet ENS resolution + text-record lookup + in-memory cache (5-minute TTL), using `ALCHEMY_MAINNET_RPC_URL`.
- `AXLAdapter.ts` (implemented): local AXL node HTTP adapter (`AXL_BASE_URL` or `http://localhost:3005`) with safe timeout, error handling, and deterministic simulated peers when no live responses are available.
- `ExecutionAdapter.ts` (KeeperHub placeholder)
- `MemoryAdapter.ts` (0G storage placeholder)
- `SwapAdapter.ts` (Uniswap placeholder)

Execution orchestration resolves external ENS sources once per request and uses them as a reputation signal layer for risk decisions. Agents also exchange AXL messages (`yield_request`, `risk_request`, `execution_signal`) and include network-consensus trace metadata without blocking execution.

### AXL HTTP contract used by backend

`AXLAdapter` calls:

- `POST /message` with `{ target, payload }`
- `POST /broadcast` with `{ payload }`

Broadcast responses accepted by backend can be either:

- `[]` (raw array), or
- `{ responses: [] }`, or
- `{ data: [] }`

If no valid responses are returned (or request fails), adapter falls back to deterministic simulated peers.

## 8) Configuration Files

- `package.json`: backend scripts and dependencies.
- `scripts/axl-mock-node.js`: local AXL mock node for development on port `3005`.
- `tsconfig.json`: strict TS compiler settings, NodeNext module resolution.
- `.gitignore`: ignores `node_modules`, `dist`, logs, env files.
- `nodemon.json`: watches `src` with `.ts` extension.
