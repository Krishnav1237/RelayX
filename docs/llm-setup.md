# LLM Setup Guide

RelayX supports optional LLM-enhanced reasoning through **OpenRouter** or **Groq**. Both providers offer **free tiers** that work perfectly for development and testing.

## Why LLM is Optional

The system works identically without LLM - it only enhances:

- Human-readable yield explanations
- Risk confidence adjustments (blended at 30% weight)

**The core decision logic never depends on LLM.**

---

## Option 1: OpenRouter (Recommended)

OpenRouter provides access to multiple models including **free Llama models**.

### Get Your API Key

1. Go to [openrouter.ai](https://openrouter.ai/)
2. Sign up with GitHub or email
3. Navigate to **Keys** in the dashboard
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-...`)

### Configure RelayX

Add to `backend/.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

### Free Models Available

- `meta-llama/llama-3.1-8b-instruct:free` (default, recommended)
- `meta-llama/llama-3.2-3b-instruct:free`
- `google/gemma-2-9b-it:free`
- `mistralai/mistral-7b-instruct:free`

See [openrouter.ai/models](https://openrouter.ai/models?order=newest&supported_parameters=tools&max_price=0) for all free models.

---

## Option 2: Groq

Groq provides **ultra-fast inference** with generous free tier limits.

### Get Your API Key

1. Go to [console.groq.com](https://console.groq.com/)
2. Sign up with Google or email
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key (starts with `gsk_...`)

### Configure RelayX

Add to `backend/.env`:

```bash
GROQ_API_KEY=gsk_your-key-here
GROQ_MODEL=llama-3.1-8b-instant
```

### Free Models Available

- `llama-3.1-8b-instant` (default, recommended)
- `llama-3.2-3b-preview`
- `mixtral-8x7b-32768`
- `gemma2-9b-it`

See [console.groq.com/docs/models](https://console.groq.com/docs/models) for all available models.

### Free Tier Limits

- **30 requests per minute**
- **6,000 tokens per minute**
- More than enough for RelayX usage

---

## Priority Order

If both API keys are configured, RelayX uses:

1. **OpenRouter** (first priority)
2. **Groq** (fallback)

---

## Verify Setup

Start the backend and check the boot logs:

```bash
cd backend
npm run dev
```

You should see:

```
[BOOT] LLM: OpenRouter enabled
```

or

```
[BOOT] LLM: Groq enabled
```

If no API key is configured:

```
[BOOT] LLM: disabled
[ReasoningAdapter] No LLM API key set (OPENROUTER_API_KEY or GROQ_API_KEY) — LLM reasoning disabled
```

---

## Test LLM Integration

Make a request with demo mode:

```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "get best yield on ETH",
    "context": {"demo": true}
  }'
```

Check the trace for LLM-enhanced messages:

```json
{
  "agent": "yield.relay.eth",
  "step": "evaluate",
  "message": "LLM reasoning: ...",
  "metadata": {
    "llmGenerated": true
  }
}
```

---

## Troubleshooting

### "LLM: disabled" even with API key set

- Ensure the key is in `backend/.env` (not root `.env`)
- Restart the backend server
- Check for typos in the environment variable name

### "LLM call failed" errors

- Verify your API key is valid
- Check your rate limits (especially on Groq)
- Ensure you have internet connectivity
- The system will continue working without LLM

### Rate limit exceeded

- Switch to the other provider (OpenRouter ↔ Groq)
- Reduce request frequency
- The system gracefully handles LLM failures

---

## Cost Comparison

| Provider       | Free Tier                | Rate Limits               | Best For               |
| -------------- | ------------------------ | ------------------------- | ---------------------- |
| **OpenRouter** | ✅ Free models available | Varies by model           | Multiple model options |
| **Groq**       | ✅ Generous free tier    | 30 req/min, 6k tokens/min | Ultra-fast inference   |

**Both are completely free for RelayX usage!**

---

## Disable LLM

To disable LLM reasoning entirely:

1. Remove or comment out the API keys in `backend/.env`:

```bash
# OPENROUTER_API_KEY=...
# GROQ_API_KEY=...
```

2. Restart the backend

The system will work identically without LLM - it only enhances explanations and slightly adjusts confidence scores.
