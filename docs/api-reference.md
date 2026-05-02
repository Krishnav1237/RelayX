# API Reference

Complete request/response schemas for the RelayX backend API.

## Base URL

```
http://localhost:3001
```

## Health Endpoints

### GET /health

Server health check.

**Response** (200):
```json
{ "status": "ok" }
```

### GET /axl-health

AXL network availability (3 nodes).

**Response** (200/503):
```json
{
  "status": "ok" | "down",
  "nodesReachable": 0-3
}
```

### GET /yield-health

DefiLlama data availability.

**Response** (200/503):
```json
{
  "status": "ok" | "unavailable",
  "source": "defillama" | "cache" | "none",
  "protocols": number
}
```

### GET /ens-health

ENS resolution capability.

**Response** (200):
```json
{
  "status": "ok" | "fallback",
  "addressResolved": boolean
}
```

## Execution Endpoints

### POST /analyze

Analyze user intent, return pending approval.

**Request**:
```json
{
  "intent": "find best yield on ETH",
  "context": {
    "ens": "vitalik.eth",
    "wallet": "0x...",
    "demo": false,
    "debug": false
  }
}
```

**Response** (200):
```json
{
  "intent": "find best yield on ETH",
  "trace": [
    {
      "agent": "system.relay.eth",
      "step": "start",
      "message": "Processing intent...",
      "metadata": { "ensSourcesUsed": [...], "reputationScore": 0.85 },
      "timestamp": 1234567890
    },
    ...
  ],
  "final_result": {
    "protocol": "Aave",
    "apy": "4.2%",
    "action": "deposit",
    "status": "pending_approval",
    "attempt": 1,
    "swap": {
      "amountOut": "1234.56",
      "priceImpact": 0.5,
      "gasEstimate": "120000",
      "route": "ETH → USDC",
      "source": "uniswap" | "coingecko" | "cache",
      "lastUpdatedAt": 1234567890
    }
  },
  "summary": {
    "selectedProtocol": "Aave",
    "initialProtocol": "Aave",
    "finalProtocol": "Aave",
    "wasRetried": false,
    "reasonForRetry": null,
    "totalSteps": 12,
    "confidence": 0.85,
    "explanation": "Selected Aave with 4.2% APY based on current yield...",
    "decisionImpact": {
      "ens": "strong ENS reputation increased tolerance",
      "axl": "2/3 peers approved",
      "memory": "Aave has 92% success rate"
    }
  },
  "approval": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": 1234567890000 + 300000
  },
  "debug": {
    "attempts": 1,
    "initialSelection": { "protocol": "Aave" },
    "finalApprovedPlan": { "protocol": "Aave", "apy": 4.2, "riskLevel": "low" },
    "riskDecision": "approve",
    "ensReputationScore": 0.85,
    "ensInfluence": {
      "tier": "strong",
      "reputationScore": 0.85,
      "effect": "increased tolerance"
    },
    "axlInfluence": {
      "approvalRatio": 0.67,
      "decisionImpact": "boost",
      "isSimulated": false
    },
    "memoryInfluence": {
      "protocol": "Aave",
      "hasHistory": true,
      "impact": "boosted",
      "successRate": 0.92,
      "executionCount": 13
    },
    "confidenceBreakdown": {
      "yield": 0.83,
      "risk": 0.86,
      "execution": 0.85
    }
  }
}
```

**Error** (400/500):
```json
{
  "error": "Invalid input: intent must be a non-empty string"
}
```

### POST /execute

Analyze + confirm execution in one call.

**Request**: Same as `/analyze`

**Response**: Same as `/execute/confirm` (below), with `status: "success"` if execution succeeds

### POST /execute/confirm

Execute approved plan.

**Request**:
```json
{
  "approvalId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response** (200):
```json
{
  "intent": "find best yield on ETH",
  "trace": [
    ...
    {
      "agent": "executor.relay.eth",
      "step": "execute",
      "message": "Deposit successful via ETH → USDC. Estimated output: 1234.56 USDC...",
      "metadata": { "protocol": "Aave", "apy": "4.2%", "status": "success" },
      "timestamp": 1234567900
    }
  ],
  "final_result": {
    "protocol": "Aave",
    "apy": "4.2%",
    "action": "deposit",
    "status": "success",
    "attempt": 1,
    "swap": { ... }
  },
  "summary": {
    "selectedProtocol": "Aave",
    "initialProtocol": "Aave",
    "finalProtocol": "Aave",
    "wasRetried": false,
    "totalSteps": 18,
    "confidence": 0.85,
    "explanation": "Selected Aave with 4.2% APY. Successfully executed deposit.",
    "decisionImpact": { ... }
  },
  "debug": { ... }
}
```

**Error** (404/500):
```json
{
  "error": "Approval request expired or not found"
}
```

---

## Data Types

### ExecutionRequest

```typescript
interface ExecutionRequest {
  intent: string;                    // Required, non-empty
  context?: {
    ens?: string;                    // e.g., "vitalik.eth"
    wallet?: string;                 // e.g., "0x..."
    demo?: boolean;                  // Demo mode with seeded memory
    debug?: boolean;                 // Include debug output
  };
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  protocol: string;
  apy: string;                       // e.g., "4.2%"
  action: "deposit";
  status: "pending_approval" | "success" | "failed";
  attempt: number;
  swap?: UniswapQuoteResult;
}
```

### AgentTrace

```typescript
interface AgentTrace {
  agent: string;                     // e.g., "yield.relay.eth"
  step: string;                      // e.g., "analyze", "evaluate"
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;                 // Unix milliseconds
}
```

### ExecutionSummary

```typescript
interface ExecutionSummary {
  selectedProtocol: string;
  initialProtocol: string;
  finalProtocol: string;
  wasRetried: boolean;
  reasonForRetry?: string;
  totalSteps: number;
  confidence: number;                // 0.0–0.95
  explanation: string;
  decisionImpact: {
    ens: string;
    axl: string;
    memory?: string;
  };
}
```

### UniswapQuoteResult

```typescript
interface UniswapQuoteResult {
  amountOut: string;                 // e.g., "1234.56"
  priceImpact: number;               // 0–100
  gasEstimate: string;               // e.g., "120000"
  route: string;                     // e.g., "ETH → USDC"
  source: "uniswap" | "coingecko" | "cache";
  lastUpdatedAt?: number;
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid params) |
| 404 | Approval not found or expired |
| 500 | Server error |
| 503 | Service unavailable (health checks) |

---

## Context Parameters

### intent (Required)

User's natural language request. Examples:
- "find best yield on ETH"
- "get best USDC yield"
- "find highest APY"

Asset is extracted automatically (ETH, USDC, USDT, DAI, WETH, WBTC, STETH).

### context.ens (Optional)

User's ENS name to influence reputation signal. Examples:
- "vitalik.eth"
- "alice.eth"

If provided, becomes primary ENS source (highest priority).

### context.wallet (Optional)

User's wallet address for reverse ENS lookup. Format: `0x` + 40 hex chars.

Example: `0x1234567890123456789012345678901234567890`

### context.demo (Optional)

Enable demo mode with seeded memory. Causes rejection of Morpho (low history) and approval of Aave V3.

### context.debug (Optional)

Include debug metadata in response (confidence breakdown, raw decisions, etc.).

---

## Approval Flow

1. `/analyze` returns `approval.id` and `approval.expiresAt` (5 minutes)
2. User reviews `summary.explanation` and `trace`
3. User calls `/execute/confirm` with `approvalId`
4. Response includes final execution status

Approval IDs expire after 5 minutes if not confirmed.

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
  -d '{"intent":"find best USDC yield"}' | jq -r '.approval.id')

# Step 2: Confirm
curl -X POST http://localhost:3001/execute/confirm \
  -H "Content-Type: application/json" \
  -d "{\"approvalId\":\"$APPROVAL\"}"
```

### JavaScript

```javascript
// Analyze
const analysis = await fetch('http://localhost:3001/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    intent: 'find best yield on ETH',
    context: { ens: 'vitalik.eth', debug: true }
  })
}).then(r => r.json());

console.log(analysis.summary.confidence); // 0.85
console.log(analysis.trace); // [...AgentTrace]
console.log(analysis.approval.id); // "..."

// Confirm
const result = await fetch('http://localhost:3001/execute/confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ approvalId: analysis.approval.id })
}).then(r => r.json());

console.log(result.final_result.status); // "success"
```

