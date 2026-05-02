# Repository Map

Complete file structure with ownership and purpose.

## Root Level

```
RelayX/
├── README.md                  # Main project overview
├── .gitignore                 # Git exclusions
└── package.json               # Root metadata
```

## Backend

```
backend/
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── vitest.config.ts           # Test config
├── src/
│   ├── index.ts               # Express server
│   ├── controllers/           # Request handlers
│   ├── orchestrator/          # ExecutionService
│   ├── agents/                # YieldAgent, RiskAgent, ExecutorAgent
│   ├── adapters/              # ENS, AXL, Yield, Uniswap, Memory, LLM
│   ├── types/                 # TypeScript interfaces
│   └── __tests__/             # Full test suite
├── scripts/
│   └── axl-dev-node.js        # AXL infrastructure node
└── node_modules/              # Dependencies
```

## Frontend

```
frontend/
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── next.config.ts             # API rewrites
├── app/                       # Pages & routes
│   ├── page.tsx               # Home (/)
│   └── dashboard/             # Dashboard pages
├── components/                # UI components
├── lib/                       # Utilities & API layer
├── public/                    # Static assets
└── node_modules/              # Dependencies
```

## Documentation

```
docs/
├── README.md                  # Docs index
├── architecture.md            # System design
├── backend.md                 # Agent & adapter internals
├── frontend.md                # UI components
├── api-reference.md           # API schemas
├── development-runbook.md     # Local setup
├── current-limitations.md     # Known issues
├── repository-map.md          # This file
└── llm-setup.md               # Optional LLM config
```

## Key Files

| File | Purpose |
|------|---------|
| backend/src/orchestrator/ExecutionService.ts | Core orchestration logic |
| backend/src/agents/YieldAgent.ts | Yield selection |
| backend/src/agents/RiskAgent.ts | Risk assessment |
| backend/src/agents/ExecutorAgent.ts | Execution |
| backend/src/adapters/ENSAdapter.ts | ENS resolution |
| backend/src/adapters/AXLAdapter.ts | AXL network |
| frontend/app/page.tsx | Request form |
| frontend/app/dashboard/page.tsx | Execution monitor |
| frontend/lib/execution.ts | API normalization |

## Build Outputs

- `backend/dist/` — Compiled TypeScript
- `frontend/.next/` — Next.js build
