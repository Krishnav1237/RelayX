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

`backend/src/adapters/ENSAdapter.ts` is integrated as an external ENS reputation signal layer, but the remaining adapters (`AXLAdapter`, `ExecutionAdapter`, `MemoryAdapter`, `SwapAdapter`) are still placeholders and not integrated into execution path.

Impact: execution remains mostly simulation-oriented apart from ENS enrichment.

## 5) Minimal Backend Test/Lint Surface

Backend `package.json` has no functional test suite and no lint script.

Impact: changes rely on manual verification and TypeScript compilation confidence.
