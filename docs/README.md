# RelayX Documentation

Complete guides for understanding, running, and extending the RelayX agent system.

**Tests: 140/140 passing.** On-chain execution via MetaMask (Sepolia) + 0G Galileo storage.

## Table of Contents

### Core Concepts

- **[Architecture](./architecture.md)** — System design, data flow, execution lifecycle
- **[Backend Design](./backend.md)** — Agents, adapters, orchestration, decision logic
- **[Frontend](./frontend.md)** — UI components, MetaMask flow, API integration

### Integration & Usage

- **[API Reference](./api-reference.md)** — Full request/response schemas, SwapCalldata, examples
- **[Development Runbook](./development-runbook.md)** — Local setup, debugging, deployment
- **[Testing Guide](./testing-guide.md)** — Step-by-step E2E test playbook (curl + UI + on-chain)
- **[LLM Setup](./llm-setup.md)** — Optional reasoning adapter configuration

### Reference

- **[Current Limitations](./current-limitations.md)** — Known constraints and workarounds
- **[Bug Fixes](./bug-fixes.md)** — Fixed issues (Audit #1 + Audit #2)
- **[Repository Map](./repository-map.md)** — File structure and ownership

---

## Quick Links

| Use Case | Document |
|---|---|
| *Understand how the system works* | [Architecture](./architecture.md) |
| *Modify agent logic* | [Backend Design](./backend.md) |
| *Customize the UI / MetaMask flow* | [Frontend](./frontend.md) |
| *Call the API* | [API Reference](./api-reference.md) |
| *Run and test locally* | [Development Runbook](./development-runbook.md) |
| *Walk through all tests (curl + UI)* | [Testing Guide](./testing-guide.md) |
| *Enable LLM explanations* | [LLM Setup](./llm-setup.md) |
| *Hit an issue / known constraint* | [Current Limitations](./current-limitations.md) |
| *What bugs were fixed?* | [Bug Fixes](./bug-fixes.md) |

---

## System Overview

RelayX is a **deterministic multi-agent DeFi execution engine** that:

1. **Analyzes** user intent → `YieldAgent` fetches live DefiLlama data
2. **Assesses risk** using on-chain signals → `RiskAgent` applies ENS + AXL + memory
3. **Retries** if rejected → selects next protocol with better risk/memory profile
4. **Generates `SwapCalldata`** bound to the connected wallet → `ExecutorAgent` + Uniswap V3 QuoterV2
5. **User signs** via MetaMask on Sepolia (`eth_sendTransaction`)
6. **Stores** execution record on 0G Galileo (chain 16602)
7. **Traces** every decision for complete explainability

**No LLM required for core logic.** Optional LLM for natural language explanations.

---

## Key Technologies

- **Backend**: Express + TypeScript + Viem
- **Frontend**: Next.js + React + TailwindCSS
- **Chain**: Ethereum mainnet and Sepolia ENS (`RELAYX_CHAIN`), with Ethereum market-data yields by default
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
├── README.md                   # This file — docs index
├── architecture.md             # System design + data flow
├── backend.md                  # Agent & adapter internals
├── frontend.md                 # UI components & MetaMask flow
├── api-reference.md            # Endpoint schemas + SwapCalldata
├── development-runbook.md      # Local setup & debugging
├── testing-guide.md            # Step-by-step test playbook
├── llm-setup.md                # Optional LLM config
├── bug-fixes.md                # Fixed issues (Audit #1 + Audit #2)
├── current-limitations.md      # Known constraints
└── repository-map.md           # File structure & ownership
```

---

## Support

For questions or issues:
1. Check [Current Limitations](./current-limitations.md) first
2. Review [Development Runbook](./development-runbook.md) for debugging
3. Inspect trace output via [API Reference](./api-reference.md)
