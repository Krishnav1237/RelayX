# Current Limitations

## 1. No On-Chain Execution

ExecutorAgent returns a simulated success result. No actual token deposits, swaps, or blockchain transactions occur. The `ExecutionAdapter`, `MemoryAdapter`, and `SwapAdapter` are placeholders.

## 2. Frontend/Backend Agent Name Mismatch

Backend uses ENS-style names (`yield.relay.eth`, `risk.relay.eth`, `executor.relay.eth`). Frontend UI may still reference older names. Sidebar indicators may not match trace data.

## 3. APY Formatting

Backend returns `final_result.apy` as `"4.2%"` (string with percent). Frontend should not append another `%`.

## 4. No Shared Type Package

Backend and frontend define execution interfaces separately. Contract drift is possible when response shape evolves.

## 5. DefiLlama Data Variability

Live yield data changes constantly. The same intent may produce different protocol selections on different runs. Demo mode (`context.demo = true`) provides stable behavior for presentations.

## 6. AXL Requires Local Nodes

AXL broadcasts to `localhost:3005`, `:3006`, `:3007`. In most environments, these are not running, so AXL returns empty responses. The system works fine without AXL — it just doesn't get peer consensus influence.

## 7. ENS Depends on RPC Availability

ENS resolution requires a working Ethereum mainnet RPC. Without `ALCHEMY_MAINNET_RPC_URL`, it falls back to public RPCs which may be slow or rate-limited. If ENS fails entirely, the system uses neutral reputation (0.7).

## 8. LLM Is Optional

The ReasoningAdapter requires `OPENAI_API_KEY`. Without it, LLM reasoning is completely disabled. The system works identically without it — LLM only enhances explanations and slightly adjusts confidence.

## 9. DefiLlama Timeout

The DefiLlama pools endpoint returns a large payload. With a 5-second timeout, it may fail on slow connections. The system falls back to cached data or the Aave+Compound minimal set.
