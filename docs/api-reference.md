# API Reference

Complete request/response schemas for the RelayX backend API.

## Base URL

```
http://localhost:3001
```

Frontend proxies `/api/*` → `http://localhost:3001/*` via `next.config.ts`.

---

## Health Endpoints

### GET /health

Overall server status.

**Response (200)**:
```json
{
  "status": "ok",
  "chain": "sepolia",
  "chainId": 11155111,
  "timestamp": 1714000000000,
  "integrations": {
    "uniswap": "QuoterV2 on-chain + CoinGecko fallback",
    "zerog": "0G Galileo Testnet",
    "axl": "real AXL node"
  }
}
```

### GET /integration-health

Unified adapter status — all in one request.

**Response (200)**:
```json
{
  "axl":     "ok" | "fallback",
  "uniswap": "ok" | "fallback",
  "memory":  "ok" | "fallback",
  "ens":     "ok",
  "timestamp": 1714000000000
}
```

### GET /axl-health

AXL peer node status.

**Response (200 / 503)**:
```json
{
  "status":       "ok" | "down",
  "mode":         "real" | "sim" | "offline",
  "nodeUrl":      "http://127.0.0.1:9002",
  "peerCount":    3,
  "ourPublicKey": "abcdef123456..."
}
```

### GET /yield-health

DefiLlama data availability.

**Response (200 / 503)**:
```json
{
  "status":    "ok" | "unavailable",
  "source":    "defillama" | "cache" | "none",
  "protocols": 12
}
```

### GET /ens-health

ENS resolution capability.

**Response (200)**:
```json
{
  "status":          "ok" | "fallback",
  "addressResolved": true,
  "chain":           "sepolia"
}
```

### GET /quote-health

Uniswap V3 QuoterV2 status.

**Response (200 / 503)**:
```json
{
  "status":        "ok" | "degraded" | "offline",
  "source":        "uniswap-v3-quoter" | "coingecko",
  "chainId":       11155111,
  "quoterAddress": "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3"
}
```

### GET /memory-health

0G Galileo storage status.

**Response (200)**:
```json
{
  "status":      "ok" | "degraded",
  "mode":        "0g-storage" | "in-memory" | "demo",
  "chainId":     16602,
  "recordCount": 5,
  "faucetUrl":   "https://faucet.0g.ai",
  "explorerUrl": "https://explorer.0g.ai",
  "details": {
    "rpcUrl":        "https://evmrpc-testnet.0g.ai",
    "indexerUrl":    "https://indexer-storage-testnet-turbo.0g.ai",
    "walletAddress": "0x...",
    "balance":       "1.23 0G"
  }
}
```

---

## Execution Endpoints

### POST /analyze

Analyze user intent, generate Uniswap swap quote + `SwapCalldata`, return pending approval.

**Request**:
```json
{
  "intent": "find best yield on ETH",
  "context": {
    "ens":    "vitalik.eth",
    "wallet": "0x1234...abcd",
    "demo":   false,
    "debug":  false
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `intent` | string | ✅ | Max `MAX_INTENT_LENGTH` chars (default 1000) |
| `context.ens` | string | ❌ | ENS name → primary reputation source |
| `context.wallet` | string | ❌ | Address → triggers `SwapCalldata` generation |
| `context.demo` | boolean | ❌ | Use seeded memory for demo/testing |
| `context.debug` | boolean | ❌ | Include debug block in response |

**Response (200)**:
```json
{
  "intent": "find best yield on ETH",
  "trace": [
    {
      "agent":     "system.relayx.eth",
      "step":      "start",
      "message":   "Processing intent: find best yield on ETH",
      "metadata":  { "ensSourcesUsed": ["vitalik.eth"], "reputationScore": 0.85 },
      "timestamp": 1714000000000
    }
  ],
  "final_result": {
    "protocol":      "Aave",
    "apy":           "4.2%",
    "action":        "deposit",
    "status":        "pending_approval",
    "attempt":       1,
    "executionMode": "prepared",
    "swap": {
      "amountOut":   "1823.45 USDC",
      "priceImpact": 0.1,
      "gasEstimate": "180000",
      "route":       "ETH → [V3 0.05%] → USDC",
      "source":      "uniswap-v3-quoter",
      "calldata": {
        "to":          "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
        "data":        "0x414bf389...",
        "value":       "1000000000000000000",
        "gasEstimate": "180000",
        "tokenIn":     "WETH",
        "tokenOut":    "USDC",
        "amountOut":   "1823450000",
        "router":      "0x3bFA4769...",
        "deadline":    1714001800
      }
    }
  },
  "summary": {
    "selectedProtocol":  "Aave",
    "initialProtocol":   "Aave",
    "finalProtocol":     "Aave",
    "wasRetried":        false,
    "reasonForRetry":    null,
    "totalSteps":        12,
    "confidence":        0.84,
    "explanation":       "Selected Aave V3 for its stable 4.2% APY and low protocol risk.",
    "decisionImpact": {
      "ens":    "strong ENS reputation increased risk tolerance",
      "axl":    "2/3 peers approved",
      "memory": "Aave has 92% historical success rate"
    }
  },
  "approval": {
    "id":        "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": 1714000300000
  },
  "debug": {
    "attempts":          1,
    "initialSelection":  { "protocol": "Aave", "apy": 4.2, "riskLevel": "low" },
    "finalApprovedPlan": { "protocol": "Aave", "apy": 4.2, "riskLevel": "low" },
    "riskDecision":      "approve",
    "ensReputationScore": 0.85,
    "ensInfluence": {
      "tier":            "strong",
      "reputationScore": 0.85,
      "effect":          "increased tolerance"
    },
    "axlInfluence": {
      "approvalRatio":  0.67,
      "decisionImpact": "boost",
      "isSimulated":    false
    },
    "memoryInfluence": {
      "protocol":       "Aave",
      "hasHistory":     true,
      "impact":         "boosted",
      "successRate":    0.92,
      "executionCount": 10
    },
    "confidenceBreakdown": {
      "yield":     0.83,
      "risk":      0.87,
      "execution": 0.90
    }
  }
}
```

> **Note**: `swap.calldata` is only present when `context.wallet` is supplied and a valid Uniswap pool is found.
> When using CoinGecko fallback, `calldata` is omitted (no pool address available).

**Errors**:

| Status | Body | Cause |
|---|---|---|
| 400 | `{"error": "Intent must be a non-empty string"}` | Empty intent |
| 400 | `{"error": "Intent must be 1000 characters or fewer"}` | Intent too long |
| 429 | `{"error": "Too many requests"}` | Rate limit exceeded |
| 500 | `{"error": "Internal server error"}` | Unexpected failure |

---

### POST /execute/confirm

Confirm an approved execution. Call this **after** the MetaMask transaction has been successfully broadcast. Stores the execution record to 0G Galileo.

**Request**:
```json
{
  "approvalId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200)**:
```json
{
  "intent": "find best yield on ETH",
  "trace": [...],
  "final_result": {
    "protocol":      "Aave",
    "apy":           "4.2%",
    "action":        "deposit",
    "status":        "success",
    "attempt":       1,
    "executionMode": "prepared",
    "swap":          { ... }
  },
  "summary": { ... }
}
```

**Errors**:

| Status | Body | Cause |
|---|---|---|
| 404 | `{"error": "Approval request expired or not found"}` | ID invalid or TTL elapsed |
| 500 | `{"error": "..."}` | Execution failure |

---

### POST /execute

Analyze + confirm in one call (no MetaMask). Useful for server-to-server or testing.

**Request**: Same as `/analyze`

**Response**: Same shape as `/execute/confirm` with `status: "success"`

---

## Data Types

### UniswapQuoteResult

```typescript
interface UniswapQuoteResult {
  amountOut:   string;   // e.g. "1823.45 USDC"
  priceImpact: number;   // 0–100 (%)
  gasEstimate: string;   // e.g. "180000"
  route:       string;   // e.g. "ETH → [V3 0.05%] → USDC"
  source:      'uniswap-v3-quoter' | 'coingecko' | 'cache';
  calldata?:   SwapCalldata;  // only when context.wallet supplied + pool found
}
```

### SwapCalldata

```typescript
interface SwapCalldata {
  to:          string;  // Uniswap SwapRouter02 address
  data:        string;  // ABI-encoded exactInputSingle calldata
  value:       string;  // ETH amount in wei (0 for token-only swaps)
  gasEstimate: string;  // estimated gas limit
  tokenIn:     string;  // input token symbol
  tokenOut:    string;  // output token symbol
  amountOut:   string;  // minimum amount out (wei)
  router:      string;  // router address (same as `to`)
  deadline:    number;  // Unix timestamp (30 min from quote time)
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  protocol:       string;
  apy:            string;   // e.g. "4.2%"
  action:         'deposit';
  status:         'pending_approval' | 'success' | 'failed';
  attempt:        number;
  executionMode?: 'prepared' | 'executed';
  swap?:          UniswapQuoteResult;
}
```

### AgentTrace

```typescript
interface AgentTrace {
  agent:     string;                      // e.g. "yield.relayx.eth"
  step:      string;                      // e.g. "analyze", "approve", "execute"
  message:   string;
  metadata?: Record<string, unknown>;
  timestamp: number;                      // Unix milliseconds
}
```

### ExecutionSummary

```typescript
interface ExecutionSummary {
  selectedProtocol:  string;
  initialProtocol:   string;
  finalProtocol:     string;
  wasRetried:        boolean;
  reasonForRetry?:   string;
  totalSteps:        number;
  confidence:        number;   // 0.0–0.95
  explanation:       string;
  decisionImpact: {
    ens:     string;
    axl:     string;
    memory?: string;
  };
}
```

---

## Approval Flow

1. `POST /analyze` → returns `approval.id` + `approval.expiresAt` (default 5 min TTL)
2. Frontend detects `swap.calldata` → prompts MetaMask → `eth_sendTransaction` on Sepolia
3. On MetaMask success → `POST /execute/confirm` with `approvalId`
4. Backend stores record to 0G Galileo → returns `status: "success"`

Approval TTL is bounded between 30 seconds and 30 minutes via `APPROVAL_TTL_MS`.
Expired approvals return `404`.

---

## Swap Sources

| Source | When Active | Calldata Available |
|---|---|---|
| `uniswap-v3-quoter` | Alchemy RPC configured + pool exists on-chain | ✅ Yes |
| `coingecko` | No Alchemy RPC or no on-chain pool | ❌ No |
| `cache` | Serving a cached previous quote | Same as original |

---

## Context Parameters

### `context.wallet` → Enables Real Calldata

When provided, `ExecutorAgent` calls `UniswapAdapter.getSwapCalldata()` to produce ABI-encoded `exactInputSingle` data bound to that wallet address as the `recipient`. The frontend can pass this directly to MetaMask:

```javascript
await window.ethereum.request({
  method: 'eth_sendTransaction',
  params: [{
    from:     walletAddress,
    to:       calldata.to,
    data:     calldata.data,
    value:    '0x' + BigInt(calldata.value).toString(16),
    gas:      '0x' + BigInt(calldata.gasEstimate).toString(16),
  }]
});
```

### `context.demo` → Seeded Memory

Activates isolated in-memory store with:
- **Morpho**: 42% success rate → rejected
- **Aave / Aave V3**: 92% success rate → approved on retry

Useful for demos and testing the retry path without real on-chain data.

---

## Examples

### Curl: Simple Request

```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent":"find best yield on ETH"}'
```

### Curl: Two-Step Flow

```bash
# Step 1: Analyze
APPROVAL=$(curl -s -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent":"find best yield on ETH"}' | jq -r '.approval.id')

# Step 2: Confirm (after MetaMask Tx)
curl -X POST http://localhost:3001/execute/confirm \
  -H "Content-Type: application/json" \
  -d "{\"approvalId\":\"$APPROVAL\"}"
```

### Curl: With Wallet (Generates Calldata)

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "swap 1 ETH for USDC",
    "context": { "wallet": "0x1234567890123456789012345678901234567890" }
  }'
```

### JavaScript: Full Flow

```javascript
// 1. Analyze
const analysis = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    intent: 'find best yield on ETH',
    context: { wallet: accounts[0] }
  })
}).then(r => r.json());

// 2. MetaMask — if calldata available
const { calldata } = analysis.final_result.swap ?? {};
if (calldata && window.ethereum) {
  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from:  accounts[0],
      to:    calldata.to,
      data:  calldata.data,
      value: '0x' + BigInt(calldata.value).toString(16),
    }]
  });
  console.log('Tx:', txHash);
}

// 3. Confirm
const result = await fetch('/api/execute/confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ approvalId: analysis.approval.id })
}).then(r => r.json());

console.log(result.final_result.status); // "success"
```

---

## Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request (missing / invalid params) |
| 404 | Approval not found or expired |
| 429 | Rate limit exceeded |
| 500 | Server error |
| 503 | Service unavailable (health endpoints) |
