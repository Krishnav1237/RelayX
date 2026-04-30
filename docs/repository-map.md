# Repository Map (Tracked Files)

This map reflects the current tracked files in Git and their purpose.

## Root

- `.gitignore` — root ignore rules (`node_modules`, `dist`, logs, env).
- `nodemon.json` — root nodemon watch config.
- `package-lock.json` — root lockfile metadata.
- `README.md` — project-level overview and onboarding.

## Documentation (`docs/`)

- `docs/README.md` — documentation index.
- `docs/architecture.md` — architecture and sequence overview.
- `docs/backend.md` — backend implementation guide.
- `docs/frontend.md` — frontend implementation guide.
- `docs/api-reference.md` — backend endpoint contract.
- `docs/development-runbook.md` — setup and run instructions.
- `docs/current-limitations.md` — known gaps and drift points.
- `docs/repository-map.md` — complete file map.

## Backend (`backend/`)

### Config and metadata

- `backend/.gitignore` — backend ignore rules.
- `backend/nodemon.json` — backend nodemon config.
- `backend/package.json` — backend scripts + dependencies.
- `backend/package-lock.json` — backend dependency lockfile.
- `backend/tsconfig.json` — TypeScript compiler configuration.

### Scripts

- `backend/scripts/axl-mock-node.js` — local mock AXL HTTP node (`/health`, `/message`, `/broadcast`) for backend integration testing.

### Source: entry and controller

- `backend/src/index.ts` — Express server bootstrap and routes.
- `backend/src/controllers/execute.controller.ts` — `/execute` request validation and dispatch.

### Source: orchestration core

- `backend/src/orchestrator/ExecutionService.ts` — multi-agent execution flow and response assembly.

### Source: agents

- `backend/src/agents/BaseAgent.ts` — shared agent base/log helper.
- `backend/src/agents/YieldAgent.ts` — protocol selection logic.
- `backend/src/agents/RiskAgent.ts` — risk scoring and approval/rejection.
- `backend/src/agents/ExecutorAgent.ts` — execution trace + success result.

### Source: adapters

- `backend/src/adapters/ENSAdapter.ts` — viem-based ENS resolver + text-record fetcher + cache.
- `backend/src/adapters/AXLAdapter.ts` — local AXL HTTP adapter with timeout-safe send/broadcast and deterministic simulated-peer fallback.
- `backend/src/adapters/ExecutionAdapter.ts` — placeholder for execution-layer integration.
- `backend/src/adapters/MemoryAdapter.ts` — placeholder for memory/storage integration.
- `backend/src/adapters/SwapAdapter.ts` — placeholder for swap integration.

### Source: shared backend definitions

- `backend/src/types/index.ts` — backend interface contracts.
- `backend/src/utils/index.ts` — logger helper.

## Frontend (`frontend/`)

### Config and metadata

- `frontend/.gitignore` — frontend ignore rules.
- `frontend/AGENTS.md` — coding-assistant guidance reference.
- `frontend/CLAUDE.md` — assistant import reference.
- `frontend/README.md` — default Next.js starter README.
- `frontend/eslint.config.mjs` — ESLint config.
- `frontend/next.config.ts` — API rewrite config.
- `frontend/package.json` — frontend scripts + dependencies.
- `frontend/package-lock.json` — frontend dependency lockfile.
- `frontend/postcss.config.mjs` — PostCSS/Tailwind config.
- `frontend/tsconfig.json` — frontend TypeScript config.

### App routes and global styles

- `frontend/app/layout.tsx` — global layout and theme wrapper.
- `frontend/app/page.tsx` — landing page.
- `frontend/app/dashboard/page.tsx` — execution dashboard.
- `frontend/app/globals.css` — global tokens and styling.
- `frontend/app/favicon.ico` — favicon asset.

### Components and utilities

- `frontend/components/navbar.tsx` — top navbar.
- `frontend/components/theme-provider.tsx` — app theme provider.
- `frontend/components/theme-toggle.tsx` — theme switcher.
- `frontend/lib/utils.ts` — className utility.

### Public assets

- `frontend/public/file.svg`
- `frontend/public/globe.svg`
- `frontend/public/next.svg`
- `frontend/public/vercel.svg`
- `frontend/public/window.svg`
