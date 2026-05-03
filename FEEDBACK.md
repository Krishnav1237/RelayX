# Uniswap API & Developer Platform Experience Feedback

## Project Context

RelayX is an intent-centric DeFi execution engine. We integrated the Uniswap Quote API into our ExecutorAgent to fetch real swap routes, estimated output amounts, price impact, and gas estimates before simulating deposits into yield protocols.

The Uniswap adapter sits alongside integrations with:

* DefiLlama (yield data)
* ENS (on-chain reputation)
* A custom AXL peer consensus network

**Integration path:** `backend/src/adapters/UniswapAdapter.ts`

---

## What Worked

### 1. Quote API Concept

The Quote API concept is solid.

Being able to POST a token pair and amount and receive:

* routing
* price impact
* gas estimates

…is exactly what a backend system needs.

We didn't need the widget or the SDK — just a clean HTTP endpoint. That’s the right abstraction for server-side integrations.

---

### 2. Response Data Usefulness

When the API responds, the fields we need are present:

* `amountOut`
* `priceImpact`
* `gasUseEstimate`
* route information

This maps cleanly to our `UniswapQuoteResult` type without much transformation.

---

### 3. No API Key Requirement

No API key required for basic quotes made initial integration fast.

We didn’t have to:

* go through an approval process
* manage secrets

This significantly reduced friction during early development.

---

## What Didn’t Work / Issues Encountered

### 1. HTTP 409 Responses Without Explanation

During testing, we frequently received:

```
HTTP 409 Conflict
https://api.uniswap.org/v1/quote
```

Issues:

* No error body
* No explanation of the conflict
* No rate limit headers
* No retry-after guidance

We had to treat it as a generic failure and fall back to mock data.

**Impact:**
This was the single biggest friction point. We couldn’t determine whether the issue was:

* rate limiting
* malformed requests
* temporary infrastructure failure

---

### 2. Inconsistent Response Shape

The quote response structure varies depending on:

* routing type
* partial success scenarios

Observed inconsistencies:

* `amountOut` sometimes at top level, sometimes nested
* `priceImpact` sometimes a number, sometimes a string

Example defensive parsing we had to implement:

```ts
const amountOut =
  typeof quote.amountOut === 'string' ? quote.amountOut :
  typeof quote.quoteDecimals === 'string' ? quote.quoteDecimals :
  typeof quote.amount === 'string' ? quote.amount :
  null;
```

**This should not be necessary for a production API.**

---

### 3. No TypeScript Types

No official TypeScript types are published.

We had to:

* reverse-engineer API responses
* define our own `UniswapQuoteResult` interface

Suggested improvement:

* publish an `@uniswap/api-types` package
* or provide a JSON schema

---

## Documentation Gaps

### 1. Lack of Server-Side Integration Guide

The documentation focuses heavily on:

* widgets
* SDK (frontend usage)

There is no clear backend-focused guide for:

* direct HTTP usage via `fetch()`
* minimal integration setup

We had to piece this together from:

* SDK source code
* community examples

---

### 2. Underdocumented Request Body Schema

The `configs` array with fields like:

* `routingType`
* `protocols`

…is not well explained.

We used:

```json
[{ "routingType": "CLASSIC", "protocols": ["V3"] }]
```

But:

* valid combinations are unclear
* defaults are undocumented

---

### 3. Undocumented Error Responses

Missing documentation for:

* 409 errors
* 429 errors
* 500 errors

Unknowns:

* error response format
* retry strategies
* rate limit thresholds

---

### 4. Manual Token Address Management

We had to hardcode a token map:

* WETH
* USDC
* USDT
* DAI
* WBTC

A helper endpoint or canonical token list reference would simplify this.

---

## Developer Experience (DX) Friction

### 1. No Sandbox / Test Mode

All requests hit the real API with real rate limits.

Missing:

* sandbox environment
* deterministic responses

We built a mock fallback system to compensate.

---

### 2. Opaque Rate Limiting

No visibility into:

* rate limits
* usage thresholds
* backoff strategies

Missing standard headers:

* `X-RateLimit-*`

---

### 3. Large Response Payloads

Quote responses include extensive routing data.

For many use cases, we only need:

* `amountOut`
* `priceImpact`
* `gasEstimate`
* route summary

A "slim mode" or field selector would:

* reduce bandwidth
* simplify parsing

---

## Missing Endpoints / Requested Features

### 1. Token List Endpoint

```
GET /v1/tokens?chainId=1
```

Returns:

* token addresses
* symbols
* decimals

Would eliminate hardcoded mappings.

---

### 2. Health Check Endpoint

```
GET /v1/quote/health
```

Allows:

* verifying API availability
* avoiding unnecessary quote calls

---

### 3. Lightweight Estimate Mode

```
POST /v1/quote { mode: "estimate" }
```

Returns:

* approximate values
* faster responses
* lower computation cost

---

### 4. Streaming / Webhook Quotes

For real-time systems:

* subscribe to quote updates
* avoid polling

---

## Summary

The Uniswap Quote API delivers on its core functionality:

* Input: token pair + amount
* Output: quote with routing and estimates

However, the surrounding developer experience has significant gaps:

* error handling is unclear
* documentation is incomplete
* type safety is missing
* rate limiting is opaque

This forced us to build:

* mock fallbacks
* defensive parsing
* custom health checks

**These should not be necessary for a production API.**

---

## Key Improvements That Would Have High Impact

* Publish TypeScript types for request/response
* Document error responses and rate limits
* Add standard rate limit headers
* Provide a sandbox/test mode
* Ship a `/tokens` endpoint

---

## Final Note

We would use the API more aggressively if it behaved predictably under load and had clearer developer guarantees.