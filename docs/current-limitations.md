# Current Limitations

## 1. No On-Chain Execution

ExecutorAgent prepares a successful deposit result and attaches upstream quote data when available, but it does not sign or submit token deposits, swaps, or blockchain transactions.

## 2. Frontend/Backend Agent Name Mismatch

Backend uses ENS-style names (`yield.relay.eth`, `risk.relay.eth`, `executor.relay.eth`). Frontend UI may still reference older names. Sidebar indicators may not match trace data.

## 3. APY Formatting

Backend returns `final_result.apy` as `"4.2%"` (string with percent). Frontend should not append another `%`.

## 4. No Shared Type Package

Backend and frontend define execution interfaces separately. Contract drift is possible when response shape evolves.

## 5. DefiLlama And Memory Variability

Live yield data changes constantly, and 0G memory evolves after successful executions. The same intent may produce different protocol selections over time because historical success stats can influence risk and retry decisions. Demo mode injects memory only; it does not write to real 0G storage.

## 6. AXL Requires Reachable Nodes

AXL broadcasts to `localhost:3005`, `:3006`, `:3007` by default. In most environments, these are not running, so AXL returns empty responses. The optional `npm run axl:node` relay only forwards to configured `AXL_PEER_URLS`; it does not generate peer opinions.

## 7. ENS Depends on RPC Availability

ENS resolution requires a working Ethereum mainnet RPC. Without `ALCHEMY_MAINNET_RPC_URL`, it falls back to public RPCs which may be slow or rate-limited. If ENS fails entirely, the system uses neutral reputation (0.7).

## 8. LLM Is Optional

The ReasoningAdapter requires `OPENAI_API_KEY`. Without it, LLM reasoning is completely disabled. The system works identically without it — LLM only enhances explanations and slightly adjusts confidence.

## 9. DefiLlama Timeout

The DefiLlama pools endpoint returns a large payload. With an 8-second timeout, it may fail on slow connections. The system falls back only to cached upstream data; if there is no cache, `/execute` returns a structured failed response.

## 10. Quote Precision

CoinGecko fallback quotes are spot-price estimates, not executable routes. Use `UNISWAP_API_KEY` for route-level quote data.

## 11. 0G Write Gateway Configuration

The adapter expects configured `ZEROG_MEMORY_KV_URL` and `ZEROG_MEMORY_LOG_URL` endpoints. If those endpoints are absent or unavailable, memory returns null stats and does not influence decisions.
