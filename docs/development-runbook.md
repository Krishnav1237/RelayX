# Development Runbook

Quick start for local development, testing, and debugging.

## Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/Krishnav1237/RelayX.git
cd RelayX
cd backend && npm install
cd ../frontend && npm install
```

### 2. Environment Configuration

**Backend** (`backend/.env`):

```bash
# Required for ENS resolution (Alchemy recommended, fallback to public RPC)
ALCHEMY_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# AXL node URL (default: localhost:3005)
AXL_BASE_URL=http://localhost:3005

# Optional: LLM explanations (OpenRouter priority > Groq)
OPENROUTER_API_KEY=sk-...
GROQ_API_KEY=gsk-...

# Optional: Uniswap API (fallback to CoinGecko)
UNISWAP_API_KEY=...

# Optional: 0G Memory storage
ZEROG_MEMORY_KV_URL=...
ZEROG_MEMORY_LOG_URL=...
```

**Frontend** (`frontend/.env.local`):

```bash
# Usually auto-discovered if backend is on localhost:3001
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

### 3. Start Services

**Terminal 1**: Start AXL node (optional but recommended)

```bash
cd backend
npm run axl:node
```

Listens on `http://localhost:3005` (and simulates :3006, :3007 locally).

**Terminal 2**: Start backend

```bash
cd backend
npm run dev
```

API available on `http://localhost:3001`.

**Terminal 3**: Start frontend

```bash
cd frontend
npm run dev
```

Dashboard available on `http://localhost:3000`.

### 4. Verification

Visit `http://localhost:3000` and submit a request:

```
Prompt: "find best yield on ETH"
```

Should see:
- **Green loading** → agents working
- **Trace entries** → decisions made
- **Summary** → selected protocol + confidence
- **Approve button** → ready to execute

## Testing

### Run Full Test Suite

```bash
cd backend
npm run test
```

Runs **Vitest** with all test files in `src/__tests__/`:

- Agent logic (YieldAgent, RiskAgent, ExecutorAgent)
- Adapter behavior (ENS, AXL, Uniswap, memory)
- Edge cases and bounds
- End-to-end execution scenarios

### Run Specific Test

```bash
npm run test -- YieldAgent.test.ts
npm run test -- RiskAgent.test.ts
```

### Watch Mode

```bash
npm run test:watch
```

Re-run tests on file changes.

### Test Coverage

```bash
npm run test -- --coverage
```

## Debugging

### 1. Enable Debug Context

Add `debug: true` to request:

```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "find best yield on ETH",
    "context": { "debug": true }
  }'
```

Response includes `debug` object with:

- `confidenceBreakdown`: {yield, risk, execution}
- `ensReputationScore`: computed ENS score
- `ensInfluence`: tier + effect
- `axlInfluence`: approval ratio + decision impact
- `memoryInfluence`: historical data used

### 2. Console Logs

Backend logs important milestones:

```
[BOOT] ENS RPC: configured
[BOOT] AXL base: http://localhost:3005
[CONTROLLER] Request received
[ENS] Resolving: vitalik.eth
[EXEC] ENS resolution complete: 0.85
[EXEC] Execution complete
[CONTROLLER] Response sent (245ms)
```

Filter for specific components:

```bash
npm run dev 2>&1 | grep '\[ENS\]'
npm run dev 2>&1 | grep '\[EXEC\]'
```

### 3. Trace Inspection

Response includes `trace[]` with every agent step:

```javascript
trace.forEach(entry => {
  console.log(entry.agent, entry.step, entry.message);
  console.log(entry.metadata);
});
```

Key steps:

- **system.relay.eth / start** → ENS context built
- **yield.relay.eth / analyze** → Intent understood
- **yield.relay.eth / evaluate** → Options evaluated
- **risk.relay.eth / evaluate** → Risk checked
- **risk.relay.eth / approve** or **reject** → Decision made
- **system.relay.eth / retry** → Retry triggered (if needed)
- **executor.relay.eth / quote** → Swap quote fetched
- **executor.relay.eth / execute** → Deposit executed

### 4. Demo Mode

Test without real ENS/yield/AXL:

```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "find best yield on ETH",
    "context": { "demo": true }
  }'
```

Demo uses seeded memory:

- Morpho: 42% success rate → rejected
- Aave V3: 92% success rate → approved on retry

## Common Issues

### Issue: ENS resolution hangs

**Symptom**: Request times out, no trace entries after `start` step.

**Fix**:
1. Check `ALCHEMY_MAINNET_RPC_URL` is set
2. Verify RPC endpoint is accessible: `curl https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY`
3. Check backend logs for `[ENS TIMEOUT]`
4. ENS failures are graceful; request should still complete

### Issue: No yield data

**Symptom**: `"status": "failed"` with message "Yield data unavailable".

**Fix**:
1. Check DefiLlama: `curl https://yields.llama.fi/pools`
2. Backend should log cache hits: `[YieldData] Using cached data`
3. On error, frontend will display reason

### Issue: AXL not responding

**Symptom**: Trace shows `"AXL: no peers available"` but execution continues.

**Fix**:
1. Start AXL node: `npm run axl:node`
2. Verify on `http://localhost:3005/health`
3. AXL is optional; requests work without it

### Issue: LLM explanations not showing

**Symptom**: `summary.explanation` is template string, not LLM-generated.

**Fix**:
1. Check `OPENROUTER_API_KEY` or `GROQ_API_KEY` is set
2. Verify API key is valid (test with curl)
3. Check backend logs for `[LLM]` entries
4. LLM is optional; fallback to templates works

### Issue: Swap quote is null

**Symptom**: `final_result.swap` is missing even with Uniswap enabled.

**Fix**:
1. Check Uniswap API is accessible
2. Backend logs show which fallback was used (`uniswap` vs `coingecko` vs `cache`)
3. Quotes are optional; deposit still executes

## Build & Deployment

### Backend Build

```bash
cd backend
npm run build
```

Compiles TypeScript → `dist/index.js`.

### Frontend Build

```bash
cd frontend
npm run build
```

Generates Next.js static/serverless export in `.next/`.

### Docker (Optional)

Add `Dockerfile` in `backend/` and `frontend/` as needed.

**Backend Dockerfile** (example):

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Frontend Dockerfile** (example):

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### Environment for Production

Set via deployment platform (Vercel, Railway, AWS Lambda, etc.):

- `ALCHEMY_MAINNET_RPC_URL`
- `AXL_BASE_URL` (point to remote AXL node)
- `OPENROUTER_API_KEY` (if using LLM)
- `UNISWAP_API_KEY` (if using Uniswap)
- `ZEROG_MEMORY_KV_URL` (if using 0G)

## Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Follows tsconfig/eslint rules
- **Testing**: Vitest conventions

### Linting (if added)

```bash
npm run lint          # Check
npm run lint:fix      # Fix
```

## Commit & PR

When making changes:

1. **Run tests** locally: `npm run test`
2. **Update docs** if behavior changes
3. **Keep API contract stable** unless versioning is added
4. **Test locally** with debug=true before submitting

## Resources

- [Architecture](./architecture.md) — System design
- [Backend Design](./backend.md) — Agent/adapter internals
- [API Reference](./api-reference.md) — Endpoint schemas
- [Current Limitations](./current-limitations.md) — Known issues

