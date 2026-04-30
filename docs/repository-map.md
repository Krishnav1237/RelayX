# Repository Map

## Root

| File | Purpose |
|---|---|
| `README.md` | Project overview and quick start |
| `.gitignore` | Root ignore rules |
| `nodemon.json` | Root nodemon config |

## Documentation (`docs/`)

| File | Purpose |
|---|---|
| `README.md` | Documentation index |
| `architecture.md` | System architecture and decision model |
| `backend.md` | Backend modules, agents, adapters, testing |
| `api-reference.md` | HTTP endpoint contracts |
| `frontend.md` | Frontend routes and UI |
| `development-runbook.md` | Setup, environment, run commands |
| `current-limitations.md` | Known gaps and future work |
| `repository-map.md` | This file |

## Backend (`backend/`)

### Config

| File | Purpose |
|---|---|
| `package.json` | Scripts (`dev`, `build`, `test`) and dependencies |
| `tsconfig.json` | Strict TypeScript config (NodeNext, zero any) |
| `vitest.config.ts` | Test runner config (30s timeout) |
| `nodemon.json` | Dev server watch config |
| `.gitignore` | Backend ignore rules |

### Scripts

| File | Purpose |
|---|---|
| `scripts/axl-mock-node.js` | Local AXL mock HTTP node for development |

### Source: Entry + Controller

| File | Purpose |
|---|---|
| `src/index.ts` | Express server, boot logging, health endpoints |
| `src/controllers/execute.controller.ts` | Request validation, determinism check, dispatch |

### Source: Orchestration

| File | Purpose |
|---|---|
| `src/orchestrator/ExecutionService.ts` | Multi-agent pipeline, ENS resolution, retry logic, trace validation |

### Source: Agents

| File | Purpose |
|---|---|
| `src/agents/BaseAgent.ts` | Shared identity + trace logging helper |
| `src/agents/YieldAgent.ts` | Live yield data fetch, AXL merge, protocol selection |
| `src/agents/RiskAgent.ts` | ENS tiers + AXL consensus + LLM blending → approve/reject |
| `src/agents/ExecutorAgent.ts` | Simulated deposit execution + AXL signal |

### Source: Adapters

| File | Purpose |
|---|---|
| `src/adapters/YieldDataAdapter.ts` | DefiLlama live yield data (cached, with fallback) |
| `src/adapters/ENSAdapter.ts` | Real ENS resolution via viem (cached, RPC fallback) |
| `src/adapters/AXLAdapter.ts` | Multi-node AXL HTTP adapter (parallel, validated) |
| `src/adapters/ReasoningAdapter.ts` | Optional OpenAI LLM (safe mode, 2s timeout) |
| `src/adapters/ExecutionAdapter.ts` | Placeholder (KeeperHub) |
| `src/adapters/MemoryAdapter.ts` | Placeholder (0G storage) |
| `src/adapters/SwapAdapter.ts` | Placeholder (Uniswap) |

### Source: Types + Utils

| File | Purpose |
|---|---|
| `src/types/index.ts` | All TypeScript interfaces (zero `any`) |
| `src/utils/index.ts` | Logger helper |

### Tests (92 tests across 11 files)

| File | Tests | Coverage |
|---|---|---|
| `BaseAgent.test.ts` | 5 | Identity, logging, metadata |
| `YieldAgent.test.ts` | 8 | Live data, selection, retry, asset extraction |
| `RiskAgent.test.ts` | 12 | ENS tiers, AXL influence, approve/reject |
| `ExecutorAgent.test.ts` | 6 | Result fields, confidence, narrative |
| `ExecutionService.test.ts` | 11 | Full flow, retry, determinism, decisionImpact |
| `AXLAdapter.test.ts` | 6 | Empty responses, graceful degradation |
| `YieldDataAdapter.test.ts` | 4 | Live fetch, caching, fallback |
| `EdgeCases.test.ts` | 13 | Boundaries, ENS tiers, confidence bounds |
| `integration.test.ts` | 1 | Full end-to-end flow |
| `hardening.test.ts` | 19 | Stability, demo mode, low data, validation |
| `verification.test.ts` | 7 | All demo scenarios, output contract |

## Frontend (`frontend/`)

| File | Purpose |
|---|---|
| `app/layout.tsx` | Global layout |
| `app/page.tsx` | Landing page |
| `app/dashboard/page.tsx` | Execution dashboard |
| `app/globals.css` | Global styles |
| `next.config.ts` | API rewrite to backend |
| `components/navbar.tsx` | Navigation |
| `components/theme-provider.tsx` | Theme wrapper |
| `components/theme-toggle.tsx` | Dark/light toggle |
