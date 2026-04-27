# RelayX Architecture

## 1) System Overview

RelayX is split into a backend execution engine and a frontend visualization UI.

- **Backend service (`backend/`)** receives intent requests and produces deterministic orchestration output.
- **Frontend service (`frontend/`)** provides a landing page plus an execution dashboard, and proxies API calls to backend using Next.js rewrites.

## 2) Runtime Topology

```mermaid
flowchart LR
    U[User Browser] --> F[Next.js Frontend :3000]
    F -->|POST /api/execute| R[Rewrite Layer]
    R --> B[Express Backend :3001]
    B --> O[ExecutionService]
    O --> Y[YieldAgent]
    O --> K[RiskAgent]
    O --> E[ExecutorAgent]
    E --> B
    B --> F
    F --> U
```

## 3) Backend Orchestration Sequence

```mermaid
sequenceDiagram
    participant User
    participant FE as Frontend Dashboard
    participant API as Express /execute
    participant ES as ExecutionService
    participant YA as YieldAgent
    participant RA as RiskAgent
    participant EA as ExecutorAgent

    User->>FE: Submit intent
    FE->>API: POST /execute { intent, context }
    API->>ES: execute(request)
    ES->>YA: think(intent, attempt=1)
    YA-->>ES: selected option (highest APY)
    ES->>RA: review(option)
    alt rejected and attempt < 2
      ES->>YA: think(intent, attempt=2)
      YA-->>ES: alternative option
      ES->>RA: review(option)
    end
    ES->>EA: execute(finalPlan)
    EA-->>ES: execution result
    ES-->>API: trace + final_result + summary + debug
    API-->>FE: JSON response
    FE-->>User: streamed trace + summary card
```

## 4) Decision Model in Current Implementation

1. **YieldAgent** has static options:
   - Morpho (4.6, medium risk)
   - Aave (4.2, low risk)
   - Compound (3.8, low risk)
2. Attempt 1 picks highest APY (Morpho).
3. **RiskAgent** rejects:
   - any `high` risk option, or
   - `medium` risk with APY > 4.5.
4. On rejection, orchestrator retries once and picks next best candidate.
5. **ExecutorAgent** returns a successful mock deposit result.

## 5) Trace-Centric Design

Each stage appends an `AgentTrace` entry:

- `agent`: identity string
- `step`: stage label
- `message`: human-readable log line
- `metadata`: structured diagnostic payload
- `timestamp`: synthetic incrementing timeline

This trace powers frontend terminal playback and summary generation.

## 6) Data Contracts

Shared conceptual model (implemented separately in backend and frontend):

- `ExecutionRequest`
- `ExecutionResponse`
- `ExecutionResult`
- `ExecutionSummary`
- `AgentTrace`

Backend is the source of truth for actual response shape.
