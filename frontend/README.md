# RelayX Frontend

Next.js + React dashboard for analyzing DeFi yield strategies.

## Overview

Provides a user interface for:

- **Submitting yield requests**: "find best yield on ETH"
- **Monitoring execution**: View agent traces in real-time
- **Approving & executing**: Review before committing
- **Viewing history**: Past executions with full audit trail

## Quick Start

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:3000` and proxies API calls to backend (`http://localhost:3001`).

## Architecture

```
app/
├── page.tsx            # Home: request submission
├── dashboard/
│   ├── page.tsx        # Dashboard: trace + results
│   └── logs/page.tsx   # Logs: session history
└── ...

components/
├── navbar.tsx          # Header
├── floating-panel.tsx  # Status indicator
├── theme-toggle.tsx    # Dark mode
└── ...

lib/
├── execution.ts        # API normalization + session storage
└── utils.ts            # Utilities
```

## API Integration

Frontend calls backend via API proxy (set in `next.config.ts`):

```
Frontend /api/analyze  →  Backend localhost:3001/analyze
```

All requests include full trace and decision metadata.

## Features

- **Agent Trace Display**: See each agent's reasoning
- **Confidence Breakdown**: Yield, risk, execution confidence scores
- **ENS Influence**: Show ENS reputation impact
- **Memory Influence**: Show protocol history impact
- **Dark Mode**: Theme toggle
- **Session History**: LocalStorage-backed execution log

## Environment

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Check code style (if configured)
```

## See Also

- [Architecture](../docs/architecture.md) — System design
- [Frontend Design](../docs/frontend.md) — Components & patterns
- [API Reference](../docs/api-reference.md) — Endpoint schemas
- [Development Runbook](../docs/development-runbook.md) — Debugging

