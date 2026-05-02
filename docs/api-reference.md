# Backend API Reference

Base URL: `http://localhost:3001`

## Health Endpoints

### GET /health

```json
{ "status": "ok" }
```

### GET /axl-health

Pings all 3 AXL nodes in parallel.

**200**: `{ "status": "ok", "nodesReachable": 2 }`
**503**: `{ "status": "down", "nodesReachable": 0 }`

### GET /yield-health

Tests DefiLlama yield data fetch.

```json
{ "status": "ok", "source": "defillama", "protocols": 5 }
```
or
```json
{ "status": "unavailable", "source": "none", "protocols": 0 }
```

### GET /ens-health

Resolves vitalik.eth to verify ENS RPC.

```json
{ "status": "ok", "addressResolved": true }
```
or
```json
{ "status": "fallback", "addressResolved": false }
```

## POST /execute

Main orchestration endpoint.

### Request

```json
{
  "intent": "get best yield on ETH",
  "context": {
    "ens": "vitalik.eth",
    "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "demo": false,
    "debug": false
  }
}
```

| Field | Required | Description |
|---|---|---|
| `intent` | Yes | Non-empty string describing the user's goal |
| `context.ens` | No | ENS name for reputation lookup |
| `context.wallet` | No | Wallet address for reverse ENS lookup |
| `context.demo` | No | Uses seeded memory (Morpho low success, Aave high success) without writing to real 0G |
| `context.debug` | No | Runs determinism check (logs consistency) |

### Response

```json
{
  "intent": "get best yield on ETH",
  "trace": [
    {
      "agent": "system.relay.eth",
      "step": "start",
      "message": "Processing intent: \"get best yield on ETH\" — ENS reputation: 0.93",
      "metadata": { "ensSourcesUsed": ["vitalik.eth", "ens.eth", "nick.eth"], "reputationScore": 0.93 },
      "timestamp": 1710000000000
    },
    {
      "agent": "yield.relay.eth",
      "step": "analyze",
      "message": "Fetched DefiLlama live yield data (5 protocols)",
      "metadata": { "asset": "ETH", "isLiveData": true, "protocols": [] },
      "timestamp": 1710000000010
    },
    {
      "agent": "risk.relay.eth",
      "step": "review",
      "message": "Reviewing Morpho (4.6% APY, medium risk) — ENS tier: strong (0.93)",
      "metadata": { "ensInfluence": { "tier": "strong", "reputationScore": 0.93, "effect": "increased tolerance" } },
      "timestamp": 1710000000060
    },
    {
      "agent": "risk.relay.eth",
      "step": "review",
      "message": "AXL: no peers available — proceeding with local decision",
      "metadata": { "axlInfluence": { "approvalRatio": 0.5, "decisionImpact": "none", "isSimulated": false } },
      "timestamp": 1710000000070
    },
    {
      "agent": "risk.relay.eth",
      "step": "review",
      "message": "Memory: Morpho has 42% success rate across 24 executions → decreasing confidence and adding risk",
      "metadata": { "successRate": 0.42, "executionCount": 24, "avgConfidence": 0.55, "influence": "negative" },
      "timestamp": 1710000000080
    },
    {
      "agent": "system.relay.eth",
      "step": "retry",
      "message": "Retrying: Rejected Morpho due to medium risk...",
      "timestamp": 1710000000090
    },
    {
      "agent": "executor.relay.eth",
      "step": "execute",
      "message": "Deposit successful. Funds now generating yield at 4.2% APY.",
      "timestamp": 1710000000150
    },
    {
      "agent": "system.relay.eth",
      "step": "memory",
      "message": "Memory stored execution outcome for Aave",
      "metadata": { "selectedProtocol": "Aave", "rejectedProtocol": "Morpho", "confidence": 0.82, "outcome": "success" },
      "timestamp": 1710000000160
    }
  ],
  "final_result": {
    "protocol": "Aave",
    "apy": "4.2%",
    "action": "deposit",
    "status": "success",
    "attempt": 2
  },
  "summary": {
    "selectedProtocol": "Aave",
    "initialProtocol": "Morpho",
    "finalProtocol": "Aave",
    "wasRetried": true,
    "reasonForRetry": "Rejected Morpho due to medium risk and strong ENS backing (0.93)...",
    "totalSteps": 14,
    "confidence": 0.82,
    "explanation": "Initially selected Morpho for higher yield, but switched to Aave due to risk constraints. Successfully executed deposit.",
    "decisionImpact": {
      "ens": "increased risk tolerance due to strong ENS (0.93)",
      "axl": "no AXL influence on decision"
    }
  },
  "debug": {
    "attempts": 2,
    "initialSelection": { "protocol": "Morpho" },
    "finalApprovedPlan": { "protocol": "Aave", "apy": 4.2, "riskLevel": "low" },
    "riskDecision": "approve",
    "ensReputationScore": 0.93,
    "ensInfluence": { "tier": "strong", "reputationScore": 0.93, "effect": "increased tolerance" },
    "axlInfluence": { "approvalRatio": 0.5, "decisionImpact": "none", "isSimulated": false },
    "confidenceBreakdown": { "yield": 0.78, "risk": 0.88, "execution": 0.9 }
  }
}
```

When no live or cached yield data is available, the endpoint still returns a valid response with `final_result.status = "failed"`, `protocol = "unavailable"`, and a summary explaining that no real yield data could be selected.

### Error Responses

**400**: `{ "error": "Invalid input: intent must be a non-empty string" }`
**500**: `{ "error": "Internal server error" }`
