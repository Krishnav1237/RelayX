# Current Limitations

Known constraints and workarounds.

## Runtime Limitations

### 1. Testnet-Only Execution (Currently Sepolia)

**Issue**: RelayX executes real transactions, but is currently restricted to testnets (Sepolia) for safety.

**Why**: Production-grade mainnet execution requires extensive audit and slippage protection. The current system relies on Uniswap QuoterV2 for pricing, but executes without advanced MEV protection.

**Workaround**: Ensure your MetaMask is connected to Sepolia to execute generated `SwapCalldata`.

### 2. ENS Data Lag

**Issue**: ENS text records may be stale (not real-time).

**Why**: Caching prevents excessive network calls.

**Impact**: Reputation scores reflect recent-ish (not current) ENS state.

**Control**: Set `ENS_CACHE_TTL_MS` to shorten or disable the cache (`0` disables freshness reuse).

### 3. Approval Expires

**Issue**: Approval ID is short lived (default: 5 minutes).

**Why**: Security: Stale approvals shouldn't be executed without re-analysis.

**Impact**: User must execute within the configured window or re-request.

**Control**: Set `APPROVAL_TTL_MS` in the backend environment. Values are bounded between 30 seconds and 30 minutes.

### 4. Chain Scope

**Current**: ENS resolution and wallet reverse lookup support Ethereum mainnet and Sepolia via `RELAYX_CHAIN=mainnet|sepolia`.

**Remaining limitation**: DefiLlama yield discovery is still filtered to Ethereum market data by default, and live Uniswap API quotes are only used on mainnet. In Sepolia demos, RelayX uses live DefiLlama yield data and CoinGecko price fallback without submitting transactions.

**Control**: Set `DEFILLAMA_CHAIN` for another DefiLlama chain label, and add token metadata before enabling live quotes outside mainnet.

### 5. Limited Yield Assets

**Issue**: Built-in detection covers ETH, USDC, USDT, DAI, WETH, WBTC, STETH.

**Current**: Additional symbols can be added with `YIELD_SUPPORTED_ASSETS`. Longer symbols are matched first so `STETH` is not mistaken for `ETH`.

**Remaining limitation**: New symbols still need matching DefiLlama pools and, for quotes, token metadata.

### 6. No Portfolio Optimization

**Issue**: Single asset at a time; no multi-asset strategies.

**Why**: Scope limited to single-protocol yield.

**Workaround**: Call API multiple times for different assets.

## Adapter Limitations

### ENSAdapter

- **Fallback RPC may be slow**: Public RPCs are rate-limited.
  - Control: Set `ALCHEMY_MAINNET_RPC_URL`, `ALCHEMY_SEPOLIA_RPC_URL`, or `RELAYX_RPC_URL`

- **Text record scope is configured by env**: Defaults to description, url, com.twitter, com.github.
  - Control: Set `ENS_TEXT_RECORD_KEYS=description,url,avatar,email,...`

### YieldDataAdapter

- **DefiLlama may be unavailable**: Network errors, API changes.
  - Workaround: Implement local caching or mirror.

- **Ethereum yield default**: Other DefiLlama chains require `DEFILLAMA_CHAIN`.
  - Control: Set `DEFILLAMA_CHAIN=Arbitrum` or another DefiLlama chain label after validating risk assumptions.

### UniswapAdapter

- **Uniswap API may timeout**: Network issues.
  - Fallback: Uses CoinGecko prices (slower but works).

- **No advanced slippage/MEV protection**: RelayX prepares `SwapCalldata` with a fixed default slippage (0.5%).
  - Workaround: A future release should implement dynamic slippage calculations based on CoinGecko volatility metrics.

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

### 2. Basic Wallet Integration

**Issue**: MetaMask integration is basic (injected `window.ethereum` only).

**Why**: The frontend focuses on the execution flow and does not support WalletConnect or multi-wallet frameworks.

**Workaround**: Use standard MetaMask browser extension.

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

### 1. Limited Protocol Metadata

**Current**: Protocol name, APY, risk level, chain, pool ID, source, and TVL are included when DefiLlama provides them.

**Remaining limitation**: Audits, insurance, exploit history, and protocol-specific risk APIs are not integrated.

**Workaround**: Extend risk inputs with audit/insurance feeds or protocol-native risk APIs.

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

### 2. No Durable Query Cache

**Current**: ENS, yield, and quote adapters keep in-memory caches across requests in the running backend process.

**Remaining limitation**: Cache is process-local and disappears on restart or horizontal scaling.

**Workaround**: Add Redis or another shared cache layer.

### 3. Max 2 Retry Attempts

**Issue**: Only tries 2 protocols before giving up.

**Why**: Design choice to avoid decision fatigue.

**Workaround**: Increase `maxAttempts` in `ExecutionService`.

## Security Considerations

### 1. Limited Input Validation

**Current**: API requests require a non-empty string intent and enforce `MAX_INTENT_LENGTH` (default: 1000).

**Remaining limitation**: Semantic prompt-injection filtering is not implemented because core decisions are deterministic and do not require an LLM.

**Mitigation**: Add prompt-injection filters before enabling LLM-driven actions.

### 2. No API Authentication

**Issue**: Anyone can call `/api/execute`.

**Why**: Intended for public use; no sensitive operations.

**Mitigation**: Add API key or OAuth if needed.

### 3. In-Memory Rate Limiting Only

**Current**: Backend has a simple in-memory limiter (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_ENABLED=false` to disable locally).

**Remaining limitation**: Limits are per process and are not shared across deployments.

**Mitigation**: Use an edge gateway, Redis-backed limiter, or platform rate limits in production.

### 4. Approval IDs Are UUIDs

**Issue**: UUIDs are predictable (not cryptographically random in some contexts).

**Why**: Node.js `randomUUID()` is cryptographically secure.

**Mitigation**: None needed; UUID v4 is safe.

## Known Issues (All Current Issues Are Known & Tracked)

### ✅ RESOLVED: Memory Influence Trace Entries

**Status**: FIXED (May 2026)
**What was**: Memory influence on risk decisions wasn't logged to trace
**Now**: Memory stats clearly show in trace with success rates
**Reference**: `docs/bug-fixes.md` - Bug #1

### ✅ RESOLVED: Demo Mode Memory Protocol Names

**Status**: FIXED (May 2026)
**What was**: Demo memory used 'Morpho Blue' but YieldAgent selected 'Morpho'
**Now**: Protocol names match correctly across all adapters
**Reference**: `docs/bug-fixes.md` - Bug #2

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
- [ ] Extend execution to Arbitrum/Optimism
- [ ] Implement WebSocket for live traces
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
│   ├── config/
│   │   ├── agents.ts                      # RelayX ENS subdomain identities
│   │   ├── chain.ts                       # Mainnet/Sepolia + RPC selection
│   │   └── security.ts                    # Approval TTL, intent, rate-limit bounds
│   │
│   ├── middleware/
│   │   └── rateLimit.ts                   # In-memory API rate limiter
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
