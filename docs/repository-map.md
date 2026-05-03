# Repository Map

Complete file structure with purpose and ownership.

## Root

```
RelayX/
├── README.md                   # Project overview, quick start, examples
├── .gitignore
└── package.json                # Root scripts (workspace-level)
```

## Backend

```
backend/
├── .env.example                # Environment variable template (copy → .env)
├── package.json                # Dependencies, scripts
├── tsconfig.json               # TypeScript strict config
├── vitest.config.ts            # Test runner config
├── scripts/
│   └── axl-dev-node.js         # AXL sim node (auto-started by dev:full)
└── src/
    ├── index.ts                # Express server + health endpoints + boot log
    ├── controllers/
    │   └── execute.controller.ts   # Route handlers: /analyze, /execute, /execute/confirm
    ├── orchestrator/
    │   ├── ExecutionService.ts     # Core pipeline: analyze → risk → execute → confirm
    │   └── ApprovalStore.ts        # In-process approval TTL store
    ├── agents/
    │   ├── YieldAgent.ts           # Intent parsing, DefiLlama fetch, protocol selection
    │   ├── RiskAgent.ts            # Risk scoring, ENS/AXL/memory signals, approve/reject
    │   ├── ExecutorAgent.ts        # Uniswap V3 quote, SwapCalldata generation
    │   └── BaseAgent.ts            # Shared trace logging, identity (ENS names)
    ├── adapters/
    │   ├── ENSAdapter.ts           # viem ENS resolution + reverse lookup + caching
    │   ├── AXLAdapter.ts           # Gensyn AXL real node + sim node fallback
    │   ├── UniswapAdapter.ts       # QuoterV2 on-chain + getSwapCalldata + CoinGecko fallback
    │   ├── YieldDataAdapter.ts     # DefiLlama pools API + caching
    │   ├── ZeroGMemoryAdapter.ts   # 0G Galileo testnet storage + in-memory fallback
    │   └── ReasoningAdapter.ts     # Optional LLM (OpenRouter / Groq) for explanations
    ├── config/
    │   ├── chain.ts                # Sepolia / Mainnet config, RPC URL resolution
    │   ├── agents.ts               # RelayX ENS subdomain identities
    │   └── security.ts             # Approval TTL, intent length, rate limit config
    ├── middleware/
    │   └── rateLimit.ts            # In-memory sliding-window rate limiter
    ├── types/
    │   └── index.ts                # All shared TypeScript interfaces (incl. SwapCalldata)
    └── __tests__/
        ├── integration.test.ts     # Full E2E pipeline (live data)
        ├── hardening.test.ts       # Response shape + confidence bounds (7 scenarios)
        ├── ExecutorAgent.test.ts
        ├── RiskAgent.test.ts
        ├── YieldAgent.test.ts
        ├── UniswapAdapter.test.ts
        ├── AXLAdapter.test.ts
        ├── ZeroGMemoryAdapter.test.ts
        ├── ENSAdapter.test.ts
        ├── ExecutionService.test.ts
        └── ...                     # 15 test files total, 140 tests
```

## Frontend

```
frontend/
├── .env.local.example          # Optional frontend env vars
├── package.json
├── tsconfig.json
├── next.config.ts              # /api/* → localhost:3001 proxy
├── tailwind.config.ts
├── app/
│   ├── layout.tsx              # Root layout, theme provider
│   ├── page.tsx                # Landing page (/)
│   ├── dashboard/
│   │   └── page.tsx            # Execution dashboard — intent form, trace terminal, approval
│   └── logs/
│       └── page.tsx            # Execution history log viewer
├── components/
│   ├── navbar.tsx              # Top navigation, wallet button
│   ├── wallet-button.tsx       # Connect wallet dropdown
│   ├── wallet-connect-modal.tsx # MetaMask / WalletConnect modal
│   ├── execution-floating-panel.tsx # Summary panel, approve/reject controls
│   ├── integration-status.tsx  # Adapter health widget (axl/uniswap/memory/ens)
│   ├── app-background.tsx      # Animated background variants
│   └── theme-provider.tsx      # Dark/light theme
├── lib/
│   ├── execution.ts            # Type definitions + normalization + localStorage helpers
│   ├── chains.ts               # Chain configs: Sepolia (11155111), 0G Galileo (16602)
│   ├── wallet-actions.ts       # switchToSepolia, submitSwapTransaction, getCurrentChainId
│   ├── utils.ts                # cn() (class merging)
│   └── wallet/
│       ├── store.ts            # Zustand wallet state (address, connected, network)
│       ├── types.ts            # WalletStore, WalletType, NetworkType
│       └── connectors/
│           ├── metamask.ts     # EIP-1193 connect
│           ├── phantom.ts      # Solana Phantom connect
│           └── walletconnect.ts # WalletConnect v2
└── public/
    └── ...                     # Static assets
```

## Documentation

```
docs/
├── README.md                   # Docs index
├── architecture.md             # System design, data flow, execution lifecycle
├── backend.md                  # Agent & adapter internals, decision logic
├── frontend.md                 # UI components, MetaMask flow, API integration
├── api-reference.md            # Full request/response schemas, SwapCalldata
├── development-runbook.md      # Local setup, debugging, deployment
├── testing-guide.md            # Step-by-step test playbook (curl + UI + E2E)
├── current-limitations.md      # Known constraints and workarounds
├── bug-fixes.md                # Fixed issues (Audit #1 + Audit #2)
├── repository-map.md           # This file
└── llm-setup.md                # Optional LLM reasoning adapter config
```

## Key Files Quick Reference

| File | Purpose |
|---|---|
| `backend/src/orchestrator/ExecutionService.ts` | Core pipeline orchestration |
| `backend/src/agents/ExecutorAgent.ts` | Uniswap quote + SwapCalldata generation |
| `backend/src/agents/RiskAgent.ts` | ENS/AXL/memory risk signals |
| `backend/src/adapters/UniswapAdapter.ts` | QuoterV2 + SwapRouter calldata |
| `backend/src/adapters/ZeroGMemoryAdapter.ts` | 0G Galileo testnet storage |
| `backend/src/adapters/AXLAdapter.ts` | Gensyn AXL broadcast (non-blocking) |
| `backend/src/types/index.ts` | `SwapCalldata`, `UniswapQuoteResult`, all shared types |
| `backend/src/config/chain.ts` | Sepolia/Mainnet RPC config |
| `frontend/app/dashboard/page.tsx` | Main dashboard — MetaMask trigger logic |
| `frontend/lib/execution.ts` | API normalization, SwapCalldata passthrough |
| `frontend/lib/wallet-actions.ts` | `submitSwapTransaction`, `getCurrentChainId` |
| `frontend/lib/chains.ts` | Sepolia (11155111) + 0G Galileo (16602) chain configs |

## Networks

| Network | Chain ID | Used By |
|---|---|---|
| Ethereum Sepolia | 11155111 | User wallet (MetaMask), ENS, Uniswap V3 |
| 0G Galileo Testnet | 16602 | Backend storage only (no wallet switch) |

## Build Outputs

- `backend/dist/` — Compiled TypeScript (`npm run build`)
- `frontend/.next/` — Next.js production build (`npm run build`)
