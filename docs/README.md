# RelayX Documentation

Complete guides for understanding and extending the RelayX agent system.

## Table of Contents

### Core Concepts

- **[Architecture](./architecture.md)** — System design, data flow, component relationships
- **[Backend Design](./backend.md)** — Agents, adapters, orchestration, decision logic
- **[Frontend Implementation](./frontend.md)** — UI components, API integration, session management

### Integration & Usage

- **[API Reference](./api-reference.md)** — Complete request/response schemas and endpoints
- **[Development Runbook](./development-runbook.md)** — Local setup, debugging, testing
- **[LLM Setup](./llm-setup.md)** — Optional reasoning adapter configuration

### Reference

- **[Current Limitations](./current-limitations.md)** — Known constraints and workarounds
- **[Repository Map](./repository-map.md)** — File structure and ownership

---

## Quick Links

| Use Case | Document |
|----------|----------|
| *I want to understand how the system works* | [Architecture](./architecture.md) |
| *I want to modify agent logic* | [Backend Design](./backend.md) |
| *I want to customize the UI* | [Frontend Implementation](./frontend.md) |
| *I want to call the API* | [API Reference](./api-reference.md) |
| *I want to run locally* | [Development Runbook](./development-runbook.md) |
| *I want to enable LLM explanations* | [LLM Setup](./llm-setup.md) |
| *I hit an issue* | [Current Limitations](./current-limitations.md) |

---

## System Overview

RelayX is a **deterministic multi-agent DeFi execution engine** that:

1. **Analyzes** user intent (YieldAgent)
2. **Assesses risk** using on-chain signals (RiskAgent)
3. **Retries** intelligently if needed (memory-aware)
4. **Executes** with real swap quotes (ExecutorAgent)
5. **Traces** every decision for explainability

**No LLM required for core logic.** Optional LLM for natural language explanations.

---

## Key Technologies

- **Backend**: Express + TypeScript + Viem
- **Frontend**: Next.js + React + TailwindCSS
- **Chain**: Ethereum mainnet (ENS, Uniswap)
- **Data**: DefiLlama (yield), CoinGecko (prices), AXL (consensus)
- **Testing**: Vitest + TypeScript

---

## Getting Started

1. Read [Architecture](./architecture.md) to understand the design
2. Follow [Development Runbook](./development-runbook.md) to set up locally
3. Review [API Reference](./api-reference.md) for integration
4. Check [Backend Design](./backend.md) if modifying agent logic

---

## File Organization

```
docs/
├── README.md                   # This file
├── architecture.md             # System design + diagrams
├── backend.md                  # Agent & adapter internals
├── frontend.md                 # UI components & flow
├── api-reference.md            # Endpoint schemas
├── development-runbook.md      # Local setup & debugging
├── llm-setup.md                # Optional LLM config
├── current-limitations.md      # Known issues
└── repository-map.md           # File structure
```

---

## Support

For questions or issues:
1. Check [Current Limitations](./current-limitations.md) first
2. Review [Development Runbook](./development-runbook.md) for debugging
3. Inspect trace output via [API Reference](./api-reference.md)
