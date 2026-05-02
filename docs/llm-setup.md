# LLM Setup

Optional integration for natural language explanations.

## Overview

RelayX includes an optional **ReasoningAdapter** for generating natural language explanations.

**Important**: Core logic is deterministic and LLM-free. LLM is only for user-facing explanations.

## Supported Providers

### OpenRouter (Recommended)

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Create API key
3. Set in `backend/.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

### Groq (Fast & Free)

1. Sign up at [groq.com](https://console.groq.com)
2. Get API key
3. Set in `backend/.env`:

```bash
GROQ_API_KEY=gsk_...
```

## Configuration

Add to `backend/.env`:

```bash
# OpenRouter (priority if both set)
OPENROUTER_API_KEY=sk-or-v1-...

# Or Groq
GROQ_API_KEY=gsk_...
```

## How It Works

After analysis completes, ReasoningAdapter is called to generate a human-readable explanation.

**Example Input**:

```json
{
  "selectedProtocol": "Aave",
  "apy": 4.2,
  "riskLevel": "low",
  "wasRetried": false
}
```

**Example Output**:

```
Selected Aave for its stable 4.2% APY and low protocol risk.
```

## Testing

### Without LLM

```bash
# Don't set API keys
npm run dev
```

Uses template explanations (fully functional).

### With OpenRouter

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npm run dev
```

### With Groq

```bash
export GROQ_API_KEY=gsk_...
npm run dev
```

## Fallback Behavior

If LLM is disabled or times out:
- Uses template explanation
- Execution proceeds normally
- No crashes or blocking

## Cost Estimation

**OpenRouter**: ~$0.001 per request (~$30/month at 1000 req/day)

**Groq**: Free tier (30 req/min limit)

## See Also

- [Backend Design](./backend.md) — ReasoningAdapter implementation
- [API Reference](./api-reference.md) — Response format

## Customization

To change prompt template, edit `ReasoningAdapter.ts`:

```typescript
private buildPrompt(context: any): string {
  return `You are a DeFi advisor...`;
}
```

To use a different model, update the model field in the API request.
