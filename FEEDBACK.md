# FEEDBACK.md — Uniswap API & Developer Platform Experience

## Project Context

RelayX is an intent-centric DeFi execution engine. We integrated the Uniswap Quote API into our ExecutorAgent to fetch real swap routes, estimated output amounts, price impact, and gas estimates before simulating deposits into yield protocols. The Uniswap adapter sits alongside integrations with DefiLlama (yield data), ENS (on-chain reputation), and a custom AXL peer consensus network.

Our integration: `backend/src/adapters/UniswapAdapter.ts`

---

## What Worked

**The Quote API concept is solid.** Being able to POST a token pair and amount and get back a structured quote with routing, price impact, and gas estimates is exactly what a backend system needs. We didn't need the widget or the SDK — just a clean HTTP endpoint. That's the right abstraction for server-side integrations.

**Response data is useful.** When the API responds, the fields we need are there: `amountOut`, `priceImpact`, `gasUseEstimate`, and route information. This maps cleanly to our `UniswapQuoteResult` type without much transformation.

**No API key required for basic quotes.** This made initial integration fast. We didn't have to go through an approval process or manage secrets just to test the endpoint.

---

## What Didn't Work / Bugs Hit

**HTTP 409 responses with no explanation.** During testing, we frequently received `409 Conflict` responses from `https://api.uniswap.org/v1/quote`. There's no error body explaining what's conflicting. No rate limit headers. No retry-after. We had to treat it as a generic failure and fall back to mock data. This was the single biggest friction point — we couldn't tell if we were being rate limited, sending a malformed request, or hitting a temporary issue.

**Inconsistent response shape.** The quote response structure varies depending on the routing type and whether the request succeeds partially. Sometimes `amountOut` is at the top level, sometimes it's nested under `quote`. Sometimes `priceImpact` is a number, sometimes a string. We had to write defensive parsing that checks multiple paths:

```typescript
const amountOut = typeof quote.amountOut === 'string' ? quote.amountOut
  : typeof quote.quoteDecimals === 'string' ? quote.quoteDecimals
  : typeof quote.amount === 'string' ? quote.amount
  : null;
```

This shouldn't be necessary for a production API.

**No TypeScript types published.** We had to define our own `UniswapQuoteResult` interface by reverse-engineering API responses. An official `@uniswap/api-types` package (or even a JSON schema) would have saved time and prevented bugs.

---

## Documentation Gaps

**No clear server-side integration guide.** The docs focus heavily on the widget and the SDK for frontend use. For a backend service that just needs to call the Quote API via `fetch()`, there's no straightforward "here's the endpoint, here's the request body, here's the response" reference. We pieced it together from the SDK source code and community examples.

**Request body schema is underdocumented.** The `configs` array with `routingType` and `protocols` fields isn't well explained. We used `[{ routingType: 'CLASSIC', protocols: ['V3'] }]` because we saw it in examples, but we don't know what other valid combinations exist or what the defaults are.

**Error responses are undocumented.** When the API returns 409, 429, or 500, what does the error body look like? What are the rate limits? What should we retry vs. not retry? None of this is documented.

**Token address lookup is manual.** We had to hardcode a `TOKEN_ADDRESSES` map for WETH, USDC, USDT, DAI, WBTC. A helper endpoint or a canonical token list URL referenced in the docs would help.

---

## DX Friction

**No sandbox/test mode.** Every call hits the real API with real rate limits. For development and testing, a sandbox endpoint that returns deterministic responses (even if fake) would be valuable. We built our own mock fallback system because of this.

**Rate limiting is opaque.** We don't know what the limits are, when we're approaching them, or how long to back off. Standard `X-RateLimit-*` headers would solve this.

**Large response payloads.** Quote responses include a lot of routing detail we don't need. A `fields` parameter or a `slim` mode that returns just `amountOut`, `priceImpact`, `gasEstimate`, and `route` would reduce bandwidth and parsing complexity for simple use cases.

---

## Missing Endpoints / What We Wish Existed

**`GET /v1/tokens?chainId=1`** — A simple endpoint returning the canonical token list with addresses, symbols, and decimals. Would eliminate the need for hardcoded address maps.

**`GET /v1/quote/health`** — A health check endpoint so we can verify API availability without burning a real quote request. We built our own health check that calls the full quote endpoint, which is wasteful.

**`POST /v1/quote` with `mode: "estimate"`** — A lightweight mode that returns approximate values without full route computation. Faster, cheaper, good enough for display purposes.

**Webhook or streaming quotes** — For real-time dashboards, being able to subscribe to quote updates for a token pair would be more efficient than polling.

---

## Summary

The Uniswap Quote API does what it needs to do at a fundamental level — you send tokens and an amount, you get a quote back. The core value proposition works. But the developer experience around it (error handling, documentation, type safety, rate limiting transparency) has significant gaps that forced us to build defensive infrastructure (mock fallbacks, multi-path response parsing, custom health checks) that shouldn't be necessary for a production API.

The biggest wins Uniswap could ship for backend developers:
1. Publish TypeScript types for API request/response
2. Document error responses and rate limits
3. Add standard rate limit headers
4. Provide a test/sandbox mode
5. Ship a `/tokens` endpoint

We'd use the API much more aggressively if we could trust it to behave predictably under load.
