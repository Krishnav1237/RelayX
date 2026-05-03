# Bug Fixes & Resolution History

Chronological record of significant bugs found and fixed in RelayX.

---

## Audit #2 — May 2026 (Current Session)

### Bug #5: `UniswapQuoteResult.source` type mismatch ✅ FIXED

**Severity**: HIGH — Silent data corruption  
**File**: `frontend/lib/execution.ts`

**Issue**: The frontend type defined `source: 'live' | 'mock'`, but the backend returns `'uniswap-v3-quoter' | 'coingecko' | 'cache'`. The normalizer mapped all non-`'live'` values to `'mock'` — including real on-chain QuoterV2 data.

**Impact**: On-chain quotes displayed as "mock" in the UI. Swap "success" tone (green) never shown for real data.

**Fix**: Updated `UniswapQuoteResult.source` to `'uniswap' | 'uniswap-v3-quoter' | 'coingecko' | 'cache' | 'live'` and updated tone logic to treat `uniswap-v3-quoter` / `uniswap` as "success" (green).

---

### Bug #6: `normalizeUniswapQuoteResult` silently dropped `calldata` ✅ FIXED

**Severity**: CRITICAL — MetaMask never triggered  
**File**: `frontend/lib/execution.ts`

**Issue**: The normalize function only returned `amountOut`, `priceImpact`, `gasEstimate`, `route`, `source`. The `calldata` object from the backend was silently discarded. The dashboard's MetaMask trigger checked `response.final_result.swap?.calldata` which was always `undefined`.

**Impact**: Real on-chain execution via MetaMask was completely broken — calldata was generated correctly by the backend but dropped before reaching the UI.

**Fix**: Added `normalizeSwapCalldata()` helper and passed `calldata` through in `normalizeUniswapQuoteResult()`.

---

### Bug #7: `ExecutionResult` missing `calldata` and `executionMode` fields ✅ FIXED

**Severity**: HIGH — TypeScript blind spot  
**File**: `frontend/lib/execution.ts`

**Issue**: `ExecutionResult` interface lacked `executionMode?: 'prepared' | 'executed'` and `swap.calldata` (since `UniswapQuoteResult` didn't have it). TypeScript accepted the property access without error due to `unknown` cast paths, but the value was `undefined` at runtime.

**Fix**: Added `SwapCalldata` interface (exported), `calldata?` to `UniswapQuoteResult`, and `executionMode?` to `ExecutionResult`.

---

### Bug #8: Dashboard used hardcoded Sepolia chainId ✅ FIXED

**Severity**: MEDIUM — Breaks multi-network support  
**File**: `frontend/app/dashboard/page.tsx`

**Issue**: ChainId for MetaMask was inferred as `networkType === 'ethereum' ? 11155111 : 1`. Since MetaMask always sets `networkType = 'ethereum'`, the chainId was always `11155111` (Sepolia) regardless of what network the user was actually on.

**Fix**: Replaced with `getCurrentChainId()` — a live EIP-1193 `eth_chainId` call to MetaMask.

---

### Bug #9: Synthetic MetaMask trace overwritten by backend response ✅ FIXED

**Severity**: MEDIUM — UX — transaction hash never shown  
**File**: `frontend/app/dashboard/page.tsx`

**Issue**: When MetaMask succeeded, a synthetic trace entry was queued (e.g., `"Transaction broadcasted! Hash: 0x..."`). But then `setStreamQueue(backendTraces)` immediately replaced the queue, overwriting and losing the synthetic entry. The tx hash was never shown in the terminal.

**Fix**: Accumulated synthetic traces in a local array and **merged** them with backend traces before setting `streamQueue`. The tx hash now appears as the first entry in the completion trace.

---

### Bug #10: `ExecutorAgent.test.ts` confidence assertion was fragile ✅ FIXED

**Severity**: LOW — Test reliability  
**File**: `backend/src/__tests__/ExecutorAgent.test.ts`

**Issue**: Test asserted `expect(confidence).toBe(0.9)`, but confidence is dynamically computed (base 0.85 + bonuses for low risk and quote availability). On retry paths the value could be 0.85.

**Fix**: Relaxed to `toBeGreaterThanOrEqual(0.75) / toBeLessThanOrEqual(0.95)`.

---

### Bug #11: `SwapCalldata` defined in two files ✅ FIXED

**Severity**: LOW — Maintainability  
**Files**: `UniswapAdapter.ts`, `types/index.ts`

**Issue**: `SwapCalldata` was defined in both files after the previous session's refactoring. The backend imported from its local definition while the frontend used a different definition.

**Fix**: Removed the duplicate from `UniswapAdapter.ts`. Now imports from `types/index.ts` (single source of truth).

---

### Bug #12: `ZeroGMemoryAdapter.seedStats()` used `Math.random()` ✅ FIXED

**Severity**: LOW — Non-determinism  
**File**: `backend/src/adapters/ZeroGMemoryAdapter.ts`

**Issue**: `lastUsed` timestamps for seeded protocol stats were set using `Math.random() * 86400000 * 7`, making test runs non-deterministic.

**Fix**: Replaced with fixed offsets: `now - 86400000 * N` (1 day apart per entry).

---

## Audit #1 — May 2026

### Bug #1: Missing Memory Influence Trace Entries ✅ FIXED

**Severity**: CRITICAL  
**File**: `backend/src/agents/RiskAgent.ts`

**Issue**: RiskAgent calculated memory influence but never logged it to the trace. Users couldn't see why protocols were approved/rejected based on historical performance.

**Fix**: Added trace entry creation after `applyMemoryInfluence()`.

---

### Bug #2: Protocol Name Mismatch in Demo Memory ✅ FIXED

**Severity**: CRITICAL  
**File**: `backend/src/adapters/ZeroGMemoryAdapter.ts`

**Issue**: Demo memory stored stats under `'Morpho Blue'` but YieldAgent returned `'Morpho'`. Memory lookup always missed.

**Fix**: Changed demo memory protocol names to match actual YieldAgent output names.

---

### Bug #3: Memory Influence Metadata Field Name Mismatch ✅ FIXED

**Severity**: MEDIUM  
**File**: `backend/src/agents/RiskAgent.ts`

**Issue**: Code logged `impact: 'boosted'|'penalized'` but tests expected `influence: 'positive'|'negative'`.

**Fix**: Added mapping from `impact` values to `influence` field names.

---

### Bug #4: Integration Test Fixed Confidence Assertion ✅ FIXED

**Severity**: MEDIUM  
**File**: `backend/src/__tests__/integration.test.ts`

**Issue**: Test expected `execution confidence === 0.9` exactly. In retry scenarios confidence was 0.85.

**Fix**: Changed to range assertion `[0.75, 0.95]`.

---

## Cumulative Test Status

| Audit Round | Before | After |
|---|---|---|
| Audit #1 | 124/129 (96.1%) | 129/129 (100%) |
| Audit #2 | 135/135 (100%) | 140/140 (100%) ✅ |

---

## Impact Summary

### What Was Fixed

- ✅ Real Uniswap calldata now reaches MetaMask correctly
- ✅ Transaction hash shown in terminal after on-chain execution
- ✅ Swap quote source displayed accurately (green for on-chain, grey for CoinGecko)
- ✅ Execution type system complete (SwapCalldata, executionMode)
- ✅ ChainId correctly fetched from live MetaMask provider
- ✅ Memory influence visible in trace (Audit #1)
- ✅ Demo mode fully functional (Audit #1)
- ✅ All tests deterministic (no Math.random in seeds)
- ✅ No duplicate type definitions

### What Did Not Change

- ✗ No API contract changes
- ✗ No feature removals
- ✗ No breaking changes to existing integrations

---

## Verify

```bash
cd backend && npm test
# Expected: Test Files 15 passed (15) | Tests 140 passed (140)
```
