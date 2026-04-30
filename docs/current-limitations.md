# Current Limitations and Gaps

## 1) Frontend/Backend Agent Name Mismatch

Backend trace uses:

- `yield.relay.eth`
- `risk.relay.eth`
- `executor.relay.eth`

Frontend UI logic currently checks for:

- `yield.agent`
- `risk.agent`
- `executor.agent`

Impact: sidebar activity indicators and badge styling for those agents can appear inconsistent with real trace data.

## 2) APY Formatting Duplication in Dashboard

Backend returns `final_result.apy` as a string with `%` (example: `"4.2%"`), while dashboard renders `response.final_result.apy + "%"`.

Impact: UI may show double percent values (example: `4.2%%`).

## 3) No Shared Type Package

Backend and frontend each define execution interfaces separately.

Impact: contract drift risk when response shape evolves.

## 4) Partial Adapter Layer Coverage

`backend/src/adapters/ENSAdapter.ts` and `backend/src/adapters/AXLAdapter.ts` are integrated into the runtime path. `ExecutionAdapter`, `MemoryAdapter`, and `SwapAdapter` remain placeholders.

Impact: agent collaboration + ENS reputation signals are active, but execution still lacks on-chain swap/storage/automation adapters.

## 5) Local AXL Defaults to Mock/Simulated Peers

In local development, AXL commonly runs as the included mock node (or falls back to simulated peer responses when unreachable).

Impact: useful for deterministic integration testing, but not equivalent to production multi-node peer discovery.

## 6) Minimal Backend Test/Lint Surface

Backend `package.json` has no functional test suite and no lint script.

Impact: changes rely on manual verification and TypeScript compilation confidence.
