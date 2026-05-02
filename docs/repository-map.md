# Repository Map

## Root

| File         | Purpose                          |
| ------------ | -------------------------------- |
| `README.md`  | Project overview and quick start |
| `.gitignore` | Root ignore rules                |

## Documentation (`docs/`)

| File                     | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `README.md`              | Documentation index                        |
| `architecture.md`        | System architecture and decision model     |
| `backend.md`             | Backend modules, agents, adapters, testing |
| `api-reference.md`       | HTTP endpoint contracts                    |
| `frontend.md`            | Frontend routes and UI                     |
| `development-runbook.md` | Setup, environment, run commands           |
| `current-limitations.md` | Known gaps and future work                 |
| `repository-map.md`      | This file                                  |

## Backend (`backend/`)

### Config

| File               | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `package.json`     | Scripts (`dev`, `build`, `test`) and dependencies |
| `tsconfig.json`    | Strict TypeScript config (NodeNext, zero any)     |
| `vitest.config.ts` | Test runner config                                |
| `nodemon.json`     | Dev server watch config                           |
| `.gitignore`       | Backend ignore rules                              |

### Scripts

| File                      | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `scripts/axl-dev-node.js` | Local AXL relay for configured peer URLs |

### Source: Entry + Controller

| File                                    | Purpose                                         |
| --------------------------------------- | ----------------------------------------------- |
| `src/index.ts`                          | Express server, boot logging, health endpoints  |
| `src/controllers/execute.controller.ts` | Request validation, determinism check, dispatch |

### Source: Orchestration

| File                                   | Purpose                                                             |
| -------------------------------------- | ------------------------------------------------------------------- |
| `src/orchestrator/ExecutionService.ts` | Multi-agent pipeline, ENS resolution, retry logic, trace validation |

### Source: Agents

| File                          | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `src/agents/BaseAgent.ts`     | Shared identity + trace logging helper                    |
| `src/agents/YieldAgent.ts`    | Live yield data fetch, AXL merge, protocol selection      |
| `src/agents/RiskAgent.ts`     | ENS tiers + AXL consensus + LLM blending → approve/reject |
| `src/agents/ExecutorAgent.ts` | Quote retrieval + deposit result preparation + AXL signal |

### Source: Adapters

| File                                 | Purpose                                                    |
| ------------------------------------ | ---------------------------------------------------------- |
| `src/adapters/YieldDataAdapter.ts`   | DefiLlama live yield data (cached, no synthetic fallback)  |
| `src/adapters/ENSAdapter.ts`         | Real ENS resolution via viem (cached, RPC fallback)        |
| `src/adapters/AXLAdapter.ts`         | Multi-node AXL HTTP adapter (parallel, validated)          |
| `src/adapters/UniswapAdapter.ts`     | Uniswap quote API + CoinGecko spot quote fallback (cached) |
| `src/adapters/ReasoningAdapter.ts`   | Optional LLM (OpenRouter/Groq) with fallback priority      |
| `src/adapters/ZeroGMemoryAdapter.ts` | 0G-backed execution log and protocol stats memory          |

### Source: Types

| File                 | Purpose                                |
| -------------------- | -------------------------------------- |
| `src/types/index.ts` | All TypeScript interfaces (zero `any`) |

### Tests (129 tests across 14 files)

| File                         | Tests | Coverage                                         |
| ---------------------------- | ----- | ------------------------------------------------ |
| `BaseAgent.test.ts`          | 5     | Identity, logging, metadata                      |
| `YieldAgent.test.ts`         | 9     | Live data, selection, retry, asset extraction    |
| `RiskAgent.test.ts`          | 12    | ENS tiers, AXL influence, approve/reject         |
| `ExecutorAgent.test.ts`      | 9     | Quote data, result fields, narrative             |
| `ExecutionService.test.ts`   | 11    | Full flow, retry, determinism, decisionImpact    |
| `AXLAdapter.test.ts`         | 6     | Empty responses, graceful degradation            |
| `YieldDataAdapter.test.ts`   | 4     | Live fetch, caching, no-data behavior            |
| `UniswapAdapter.test.ts`     | 5     | Quote fetch, caching, unknown tokens             |
| `EdgeCases.test.ts`          | 15    | Boundaries, ENS tiers, confidence bounds         |
| `integration.test.ts`        | 1     | Full end-to-end flow                             |
| `hardening.test.ts`          | 15    | Stability, live retry path, low data, validation |
| `verification.test.ts`       | 7     | Verification scenarios, output contract          |
| `audit.test.ts`              | 25    | Pipeline, edge cases, determinism, security      |
| `ZeroGMemoryAdapter.test.ts` | 5     | Memory storage, stats influence, fail-safe, demo |

## Frontend (`frontend/`)

| File                            | Purpose                |
| ------------------------------- | ---------------------- |
| `app/layout.tsx`                | Global layout          |
| `app/page.tsx`                  | Landing page           |
| `app/dashboard/page.tsx`        | Execution dashboard    |
| `app/globals.css`               | Global styles          |
| `next.config.ts`                | API rewrite to backend |
| `components/navbar.tsx`         | Navigation             |
| `components/theme-provider.tsx` | Theme wrapper          |
| `components/theme-toggle.tsx`   | Dark/light toggle      |
