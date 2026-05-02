# Current Limitations

Known constraints and workarounds.

## Runtime Limitations

### 1. No On-Chain Execution

**Issue**: Deposits are simulated. No actual blockchain transactions.

**Why**: RelayX is a **decision engine**, not a trading bot. Execution is design-limited for safety.

**Workaround**: Integrate with a signing library (ethers.js/viem) to submit actual transactions.

### 2. ENS Data Lag

**Issue**: ENS text records may be stale (not real-time).

**Why**: Caching (5-minute TTL) prevents excessive network calls.

**Impact**: Reputation scores reflect recent-ish (not current) ENS state.

**Workaround**: Set a shorter cache TTL or always fetch fresh.

### 3. Approval Expires

**Issue**: Approval ID valid for only 5 minutes.

**Why**: Security: Stale approvals shouldn't be executed without re-analysis.

**Impact**: User must execute within 5 minutes or re-request.

**Workaround**: Increase `APPROVAL_TTL_MS` in `ExecutionService.ts` (not recommended).

### 4. Single Chain (Ethereum Mainnet)

**Issue**: Only Ethereum mainnet supported.

**Why**: ENS, Uniswap, DefiLlama data are mainnet-specific.

**Workaround**: Extend adapters for other chains (Polygon, Arbitrum, etc.).

### 5. Limited Yield Assets

**Issue**: Only detects ETH, USDC, USDT, DAI, WETH, WBTC, STETH.

**Why**: Asset extraction is hardcoded.

**Workaround**: Add more assets to `YieldAgent.extractAsset()`.

### 6. No Portfolio Optimization

**Issue**: Single asset at a time; no multi-asset strategies.

**Why**: Scope limited to single-protocol yield.

**Workaround**: Call API multiple times for different assets.

## Adapter Limitations

### ENSAdapter

- **Fallback RPC may be slow**: Public RPCs are rate-limited.
  - Workaround: Set `ALCHEMY_MAINNET_RPC_URL`

- **Text records incomplete**: Only fetches 4 keys (description, url, com.twitter, com.github).
  - Workaround: Extend `getTextRecords()` to fetch more keys.

### YieldDataAdapter

- **DefiLlama may be unavailable**: Network errors, API changes.
  - Workaround: Implement local caching or mirror.

- **Only Ethereum yields**: Other chains not fetched.
  - Workaround: Extend adapter for other chains.

### UniswapAdapter

- **Uniswap API may timeout**: Network issues.
  - Fallback: Uses CoinGecko prices (slower but works).

- **No slippage protection**: Quote doesn't include slippage limits.
  - Workaround: Add slippage tolerance to quote.

### AXLAdapter

- **AXL node must be running**: If all nodes down, no peer consensus.
  - Fallback: Proceeds with local decisions (neutral).

- **No authentication**: AXL messages are unsigned.
  - Workaround: Add HMAC or signature verification.

## Frontend Limitations

### 1. No Real-Time Streaming

**Issue**: Trace entries loaded all at once (not streamed).

**Why**: Simple HTTP request/response pattern (no WebSocket/SSE).

**Workaround**: Add Server-Sent Events (SSE) or WebSocket for live updates.

### 2. No Wallet Integration

**Issue**: No MetaMask/WalletConnect integration.

**Why**: Frontend is UI-only; no on-chain actions.

**Workaround**: Add wallet connection for user context (used in ENS reverse lookup).

### 3. LocalStorage Only

**Issue**: Session history stored in browser only.

**Why**: No backend persistence layer.

**Impact**: History lost on clear browser data.

**Workaround**: Implement backend session store.

### 4. No Export/Share

**Issue**: Cannot export results or share execution traces.

**Why**: Not implemented (feature request).

**Workaround**: Copy trace from dev console.

## Data Limitations

### 1. No Protocol Metadata

**Issue**: Only protocol name + APY; no TVL, audits, insurance.

**Why**: Scope limited to yield + risk.

**Workaround**: Extend to fetch from Defillama or DeFi Score.

### 2. No Historical Volatility

**Issue**: Risk levels (low/medium/high) are hardcoded per protocol.

**Why**: No volatility data integrated.

**Workaround**: Fetch historical APY variance from DefiLlama.

### 3. No Liquidation Risk

**Issue**: Medium/high risk doesn't account for liquidation probability.

**Why**: Requires oracle data + position modeling.

**Workaround**: Integrate Aave/Compound risk APIs.

## Performance Limitations

### 1. Cold Start Latency

**Issue**: First request may take 3–5 seconds (ENS + yield fetch).

**Why**: Multiple network calls in sequence.

**Workaround**: Parallelize calls (already done) or cache aggressively.

### 2. No Query Caching Across Requests

**Issue**: Each user request re-fetches ENS + yield data.

**Why**: No cross-request cache (only within-request).

**Workaround**: Add Redis cache layer.

### 3. Max 2 Retry Attempts

**Issue**: Only tries 2 protocols before giving up.

**Why**: Design choice to avoid decision fatigue.

**Workaround**: Increase `maxAttempts` in `ExecutionService`.

## Security Considerations

### 1. No Input Validation (Extreme)

**Issue**: Intent string is not validated; could be very long.

**Why**: Intended flexibility; LLM would handle any intent.

**Mitigation**: Add length limits or prompt injection filters.

### 2. No API Authentication

**Issue**: Anyone can call `/api/execute`.

**Why**: Intended for public use; no sensitive operations.

**Mitigation**: Add API key or OAuth if needed.

### 3. No Rate Limiting

**Issue**: No rate limits on backend.

**Why**: Not implemented.

**Mitigation**: Add middleware (express-rate-limit).

### 4. Approval IDs Are UUIDs

**Issue**: UUIDs are predictable (not cryptographically random in some contexts).

**Why**: Node.js `randomUUID()` is cryptographically secure.

**Mitigation**: None needed; UUID v4 is safe.

## Known Issues

### Issue: Confidence Score > 0.95

**Status**: Won't happen (clamped in code).

**Note**: Confidence never exceeds 0.95 to avoid false certainty.

### Issue: Negative APY

**Status**: Handled gracefully (approved as low-risk).

**Note**: RiskAgent accepts APY ≤ 0 with low risk.

### Issue: Protocol Not in DefiLlama

**Status**: Skipped in selection.

**Note**: Unknown protocols default to low risk (conservative).

## Requested Features (Not Implemented)

1. **Multi-wallet support**: Currently hardcoded to single user context
2. **Gas price optimization**: No gas cost analysis
3. **Tax-loss harvesting**: No tax analysis
4. **Leverage strategies**: Only spot yield, no borrowed positions
5. **Stop-loss**: No risk triggers
6. **Portfolio rebalancing**: Single-asset only
7. **API webhooks**: No event notifications
8. **GraphQL API**: REST-only

## Roadmap

Near-term improvements:

- [ ] Add more yield sources (Yearn, Curve)
- [ ] Extend to other chains
- [ ] Add real on-chain execution
- [ ] Implement WebSocket for live traces
- [ ] Add wallet integration
- [ ] Backend session persistence

---

# Repository Map

Complete file structure with ownership and purpose.

## Root Level

```
RelayX/
├── README.md                  # Main project overview
├── .gitignore                 # Git exclusions
└── package.json               # Root metadata (if monorepo)
```

## Backend

```
backend/
├── package.json               # Dependencies: express, viem, vitest, etc.
├── tsconfig.json              # TypeScript strict config
├── vitest.config.ts           # Test runner config
├── nodemon.json               # Dev server auto-reload
├── eslint.config.mjs          # (optional) Code linting
├── .gitignore                 # Ignores node_modules, .env, dist
│
├── src/
│   ├── index.ts               # Express server + routes setup
│   │
│   ├── controllers/
│   │   └── execute.controller.ts          # Request handlers: /analyze, /execute, /execute/confirm
│   │
│   ├── orchestrator/
│   │   └── ExecutionService.ts            # Main orchestrator (analyze, execute, confirm)
│   │
│   ├── agents/
│   │   ├── BaseAgent.ts                   # Abstract logging interface
│   │   ├── YieldAgent.ts                  # Fetch + select yield
│   │   ├── RiskAgent.ts                   # Assess risk + approve/reject
│   │   └── ExecutorAgent.ts               # Quote + execute deposit
│   │
│   ├── adapters/
│   │   ├── ENSAdapter.ts                  # Viem + ENS resolution + cache
│   │   ├── YieldDataAdapter.ts            # DefiLlama + cache
│   │   ├── UniswapAdapter.ts              # Swap quotes + CoinGecko fallback
│   │   ├── AXLAdapter.ts                  # AXL broadcast + response validation
│   │   ├── ZeroGMemoryAdapter.ts          # Protocol history + in-memory store
│   │   └── ReasoningAdapter.ts            # Optional LLM explanations
│   │
│   ├── types/
│   │   └── index.ts                       # TypeScript interfaces (ExecutionRequest, etc.)
│   │
│   └── __tests__/
│       ├── setup.ts                       # Test fixtures
│       ├── BaseAgent.test.ts              # Agent logging tests
│       ├── YieldAgent.test.ts             # Yield selection tests
│       ├── RiskAgent.test.ts              # Risk decision tests
│       ├── ExecutorAgent.test.ts          # Execution tests
│       ├── EdgeCases.test.ts              # Confidence bounds, edge inputs
│       ├── ExecutionService.test.ts       # End-to-end orchestration
│       ├── YieldDataAdapter.test.ts       # Data fetching
│       ├── AXLAdapter.test.ts             # AXL broadcast
│       ├── UniswapAdapter.test.ts         # Swap quoting
│       └── ZeroGMemoryAdapter.test.ts     # Memory + retry
│
├── scripts/
│   └── axl-dev-node.js                    # AXL mock node (localhost:3005/3006/3007)
│
├── dist/                      # (Generated) Compiled JavaScript
└── node_modules/              # (Generated) Dependencies
```

## Frontend

```
frontend/
├── package.json               # Dependencies: next, react, tailwindcss
├── tsconfig.json              # TypeScript config
├── next.config.ts             # Next.js config + API rewrites
├── tailwind.config.ts         # TailwindCSS theme
├── postcss.config.mjs         # CSS processing
├── eslint.config.mjs          # (optional) Code linting
├── .gitignore                 # Ignores node_modules, .next, .env
│
├── app/
│   ├── layout.tsx             # Root layout (providers, head)
│   ├── globals.css            # Global styles + TailwindCSS
│   ├── page.tsx               # Home: /  (intent submission)
│   │
│   ├── dashboard/
│   │   ├── page.tsx           # /dashboard (trace + summary + approve)
│   │   └── logs/
│   │       └── page.tsx       # /dashboard/logs (session history)
│   │
│   └── api/                   # (No API routes here; proxied to backend)
│
├── components/
│   ├── navbar.tsx             # Header with logo + theme
│   ├── floating-panel.tsx     # Execution status indicator
│   ├── theme-toggle.tsx       # Dark/light mode switcher
│   ├── wallet-button.tsx      # Wallet integration UI
│   ├── background.tsx         # Animated background
│   ├── trace-display.tsx      # (Example) Trace rendering
│   └── ...
│
├── lib/
│   ├── execution.ts           # Response normalization + session storage
│   ├── utils.ts               # Utility functions (formatters, etc.)
│   │
│   └── wallet/
│       ├── hooks.ts           # (Example) useWallet hook
│       └── ...
│
├── public/
│   ├── favicon.ico
│   └── ...
│
├── .next/                     # (Generated) Build output
├── node_modules/              # (Generated) Dependencies
└── README.md                  # Frontend-specific README (replace with project-specific)
```

## Docs

```
docs/
├── README.md                  # Docs index
├── architecture.md            # System design + data flow
├── backend.md                 # Agent + adapter internals
├── frontend.md                # UI components + integration
├── api-reference.md           # Endpoint schemas
├── development-runbook.md     # Setup + debugging + testing
├── llm-setup.md               # Optional LLM configuration
├── current-limitations.md     # Known issues + workarounds
└── repository-map.md          # This file
```

## File Ownership & Responsibilities

| File/Directory | Owner | Responsibility |
|---|---|---|
| `src/orchestrator/` | Core team | Orchestration logic, approval flow, state management |
| `src/agents/` | Core team | Decision logic (must remain deterministic) |
| `src/adapters/` | Feature team | External integrations (ENS, AXL, yield data) |
| `src/controllers/` | Backend team | Request routing + validation |
| `app/` | Frontend team | UI routes + pages |
| `components/` | Frontend team | Reusable components |
| `lib/` | Frontend/backend team | Shared utilities + session management |
| `scripts/` | DevOps team | Infrastructure (AXL node, etc.) |
| `docs/` | Tech lead | Documentation (updated with code changes) |

## Build & Distribution

```
dist/                         # (Backend) Compiled TypeScript
.next/                        # (Frontend) Next.js build output
```

### Package Scripts

**Backend**:

```json
{
  "dev": "nodemon -r ts-node/register src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "vitest",
  "test:watch": "vitest --watch",
  "axl:node": "node scripts/axl-dev-node.js"
}
```

**Frontend**:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint ."
}
```

---

# LLM Setup

Optional LLM integration for natural language explanations.

## Overview

RelayX includes an optional **ReasoningAdapter** for generating natural language explanations of decisions.

**Important**: Core logic is **deterministic and LLM-free**. LLM is only for user-facing explanations.

## Supported Providers

### 1. OpenRouter (Recommended)

**Advantage**: Access to many models (Groq, Perplexity, Open AI, etc.), good pricing.

**Setup**:

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Create API key in settings
3. Set `OPENROUTER_API_KEY` in `backend/.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

**Cost**: ~$0.001 per request (depends on model).

### 2. Groq

**Advantage**: Fastest inference, free tier available.

**Setup**:

1. Sign up at [groq.com](https://console.groq.com)
2. Get API key from console
3. Set `GROQ_API_KEY` in `backend/.env`:

```bash
GROQ_API_KEY=gsk_...
```

**Cost**: Free tier (fair use limits), paid plans available.

## Configuration

### Backend Environment

Add to `backend/.env`:

```bash
# OpenRouter (priority if both set)
OPENROUTER_API_KEY=sk-or-v1-...

# Or Groq
GROQ_API_KEY=gsk_...
```

### Provider Priority

Code uses this priority:

1. **OpenRouter** (if `OPENROUTER_API_KEY` set)
2. **Groq** (if `GROQ_API_KEY` set)
3. **Disabled** (if neither set; fallback to templates)

### Fallback Behavior

If LLM is disabled or times out:

- Frontend still displays explanation (from template)
- `summary.explanation` uses rule-based template
- Execution proceeds normally

No crashes, always graceful.

## How It Works

### When LLM Is Called

**During `analyze()`**:

After YieldAgent + RiskAgent complete, `ReasoningAdapter` is called with:

```typescript
{
  selectedProtocol: "Aave",
  apy: 4.2,
  riskLevel: "low",
  wasRetried: false,
  initialProtocol: "Aave",
  reasonForRetry: null,
  ensInfluence: { tier: "neutral", reputationScore: 0.75, effect: "none" },
  memoryInfluence: null
}
```

Prompt template:

```
You are a DeFi yield analysis assistant. Explain why this protocol was selected.

Selected: Aave, 4.2% APY, low risk
Reason: Initially selected for highest yield...

Provide a concise, 1-sentence explanation suitable for a user.
```

**Response** (1–2 sentences):

```
Selected Aave for its stable 4.2% APY and low protocol risk.
```

### When Execution Completes

During `confirmExecution()`, LLM is called again with execution status:

```typescript
{
  selectedProtocol: "Aave",
  apy: 4.2,
  riskLevel: "low",
  wasRetried: false,
  executionStatus: "success"
}
```

Response (1–2 sentences):

```
Successfully deposited to Aave at 4.2% APY with low risk.
```

## Testing

### Without LLM

```bash
# Don't set OPENROUTER_API_KEY or GROQ_API_KEY
npm run dev
```

Explanations use templates (fully functional).

### With OpenRouter

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npm run dev
```

Check logs:

```
[LLM] Explanation generated (OpenRouter)
```

### With Groq

```bash
export GROQ_API_KEY=gsk_...
npm run dev
```

Check logs:

```
[LLM] Explanation generated (Groq)
```

### Debug

Enable debug context:

```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "find best yield on ETH",
    "context": { "debug": true }
  }'
```

Response includes LLM status in `debug.llmGenerated`.

## Customization

### Change Prompt Template

**File**: `backend/src/adapters/ReasoningAdapter.ts`

Method: `buildPrompt(context)`

Example customization:

```typescript
private buildPrompt(context: any): string {
  return `
    You are a financial advisor. Explain why this yield strategy was chosen.
    
    Protocol: ${context.selectedProtocol}
    APY: ${context.apy}%
    Risk: ${context.riskLevel}
    
    Provide a professional recommendation for the user.
  `;
}
```

### Change Model

**OpenRouter**: Edit `ReasoningAdapter` to specify model:

```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://relayX.example.com'
  },
  body: JSON.stringify({
    model: 'gpt-4-turbo',  // Change model here
    messages: [{ role: 'user', content: prompt }]
  })
});
```

Available models: See [OpenRouter models](https://openrouter.ai/docs/models).

**Groq**: Specify in adapter:

```typescript
body: JSON.stringify({
  model: 'mixtral-8x7b-32768',  // Change model here
  messages: [{ role: 'user', content: prompt }]
})
```

Available models: See [Groq models](https://console.groq.com/docs/speech-text).

## Cost Estimation

### OpenRouter

- **Model**: gpt-3.5-turbo (via OpenRouter)
- **Tokens per request**: ~150 (input) + ~50 (output)
- **Cost per token**: $0.0005 (input) + $0.0015 (output)
- **Cost per request**: ~$0.001

**Monthly** (1000 requests/day):

```
1000 req/day × 30 days = 30,000 requests
30,000 × $0.001 = $30/month
```

### Groq

- **Free tier**: 30 requests/minute, unlimited
- **Cost**: $0 (if free tier sufficient)

**Recommendation**: Start with Groq (free), switch to OpenRouter if hitting rate limits.

## Troubleshooting

### Issue: LLM explanations not appearing

**Symptoms**: `summary.explanation` is template string, not LLM-generated.

**Check**:

1. Verify `OPENROUTER_API_KEY` or `GROQ_API_KEY` is set:

```bash
echo $OPENROUTER_API_KEY
```

2. Check backend logs for `[LLM]` entries
3. Verify API key is valid (test with curl)
4. Check timeout (default 5000ms)

**Solution**: Add logging to `ReasoningAdapter.explainFinalDecision()` to debug.

### Issue: Timeout errors

**Symptom**: `[LLM] Timeout` in logs, templates used.

**Fix**:

1. Increase timeout: `const timeout = 10000` (10 seconds)
2. Use faster model (Groq over OpenRouter)
3. Disable LLM if not critical

### Issue: Invalid API key

**Symptom**: 401 Unauthorized errors.

**Fix**:

1. Verify key format (should start with `sk-or-v1` for OpenRouter, `gsk_` for Groq)
2. Regenerate key in provider dashboard
3. Check for trailing whitespace

## Production Checklist

- [ ] Set `OPENROUTER_API_KEY` or `GROQ_API_KEY` in production env
- [ ] Monitor LLM API costs
- [ ] Set timeout >= 3000ms to avoid false timeouts
- [ ] Test with production data
- [ ] Add error logging for LLM failures
- [ ] Plan fallback if LLM becomes unavailable

## References

- [OpenRouter Docs](https://openrouter.ai/docs)
- [Groq Docs](https://console.groq.com/docs)
- [ReasoningAdapter Source](../backend/src/adapters/ReasoningAdapter.ts)
