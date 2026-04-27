# Backend API Reference

Base URL for local development: `http://localhost:3001`

## `GET /health`

### Response

```json
{
  "status": "ok"
}
```

## `POST /execute`

Triggers intent orchestration and returns the full execution artifact.

### Request Body

```json
{
  "intent": "Find the safest yield for 1000 USDC",
  "context": {
    "chain": "ethereum"
  }
}
```

### Validation Rules

- `intent` is required.
- `intent` must be a non-empty string after trimming.
- `context` is optional and passed through as-is.

### Success Response Shape

```json
{
  "intent": "Find the safest yield for 1000 USDC",
  "trace": [
    {
      "agent": "system.relay.eth",
      "step": "start",
      "message": "Processing user intent: \"Find the safest yield for 1000 USDC\"",
      "timestamp": 1710000000000
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
    "reasonForRetry": "Rejected Morpho: ...",
    "totalSteps": 10,
    "confidence": 0.88,
    "explanation": "Initially selected Morpho for higher yield, but switched to Aave due to risk constraints. Successfully executed deposit."
  },
  "debug": {
    "attempts": 2,
    "initialSelection": { "protocol": "Morpho" },
    "finalApprovedPlan": {
      "protocol": "Aave",
      "apy": 4.2,
      "riskLevel": "low"
    },
    "riskDecision": "approve",
    "confidenceBreakdown": {
      "yield": 0.83,
      "risk": 0.95,
      "execution": 0.9
    }
  }
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": "Invalid input: intent must be a non-empty string"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

(or specific thrown error message when available)
