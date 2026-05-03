import { YieldOption } from '../types/index.js';

const LLM_TIMEOUT_MS = 8000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export class ReasoningAdapter {
  private enabled: boolean;

  constructor() {
    if (GROQ_API_KEY && GROQ_API_KEY.length > 0) {
      this.enabled = true;
      console.log(`[ReasoningAdapter] ✓ LLM enabled (provider: Groq, model: ${GROQ_MODEL})`);
    } else {
      this.enabled = false;
      console.log('[ReasoningAdapter] ✗ LLM disabled (no GROQ_API_KEY found)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async explainYield(options: YieldOption[], selected: YieldOption): Promise<string | null> {
    if (!this.enabled) return null;

    const otherOptions = options.filter((o) => o.protocol !== selected.protocol).slice(0, 3);
    const prompt = `You are explaining a decision ALREADY MADE by the system. Do NOT suggest alternatives.

SELECTED PROTOCOL: ${selected.protocol}
APY: ${selected.apy}%
Risk Level: ${selected.riskLevel ?? 'unknown'}

Other options considered: ${otherOptions.map((o) => `${o.protocol} (${o.apy}%)`).join(', ')}

Task: Explain in ONE sentence why ${selected.protocol} was selected. You MUST reference "${selected.protocol}" by name. Do NOT mention other protocols as better choices.`;

    try {
      const result = await this.callLLM(prompt);
      if (typeof result !== 'string' || result.length === 0) return null;

      // Validation: Ensure the response mentions the selected protocol
      const selectedProtocolLower = selected.protocol.toLowerCase();
      const resultLower = result.toLowerCase();

      if (!resultLower.includes(selectedProtocolLower)) {
        console.warn(
          `[ReasoningAdapter] LLM response does not mention selected protocol "${selected.protocol}", discarding`
        );
        return null;
      }

      return result;
    } catch {
      return null;
    }
  }

  async evaluateRisk(
    plan: YieldOption,
    ensScore: number
  ): Promise<{ reasoning: string; confidence: number } | null> {
    if (!this.enabled) return null;

    const prompt = `You are evaluating a risk decision ALREADY MADE by the system. Do NOT suggest alternatives.

PROTOCOL BEING EVALUATED: ${plan.protocol}
APY: ${plan.apy}%
Risk Level: ${plan.riskLevel ?? 'unknown'}
ENS Reputation Score: ${ensScore}

Task: Provide risk assessment for ${plan.protocol} specifically. You MUST reference "${plan.protocol}" in your reasoning.

Respond with JSON only: {"reasoning": "one sentence about ${plan.protocol}", "confidence": 0.0 to 1.0}`;

    try {
      const raw = await this.callLLM(prompt);
      if (!raw) return null;

      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return null;
      if (typeof parsed.reasoning !== 'string' || parsed.reasoning.length === 0) return null;
      if (typeof parsed.confidence !== 'number' || !Number.isFinite(parsed.confidence)) return null;

      // Validation: Ensure the reasoning mentions the protocol being evaluated
      const protocolLower = plan.protocol.toLowerCase();
      const reasoningLower = parsed.reasoning.toLowerCase();

      if (!reasoningLower.includes(protocolLower)) {
        console.warn(
          `[ReasoningAdapter] LLM risk reasoning does not mention protocol "${plan.protocol}", discarding`
        );
        return null;
      }

      return {
        reasoning: parsed.reasoning,
        confidence: normalizeConfidence(Math.max(0, Math.min(1, parsed.confidence))),
      };
    } catch {
      return null;
    }
  }

  async explainFinalDecision(
    context: {
      selectedProtocol: string;
      apy: number;
      riskLevel: string;
      wasRetried: boolean;
      initialProtocol?: string;
      reasonForRetry?: string;
      ensInfluence?: any;
      memoryInfluence?: any;
      executionStatus?: string;
    },
    userIntent: string
  ): Promise<string | null> {
    if (!this.enabled) return null;

    // Build context for the LLM
    let contextInfo = '';

    if (context.wasRetried && context.initialProtocol) {
      contextInfo += `We almost went with ${context.initialProtocol} but pivoted to ${context.selectedProtocol}. `;
    }

    if (context.memoryInfluence && context.memoryInfluence.hasHistory) {
      const successRate = Math.round(context.memoryInfluence.successRate * 100);
      contextInfo += `${context.selectedProtocol} has a ${successRate}% win rate historically. `;
    }

    const prompt = `You're a crypto trader explaining a play to a friend. Be REAL, not corporate.

SELECTED: ${context.selectedProtocol}
APY: ${context.apy}%
Risk: ${context.riskLevel}
${contextInfo ? `Context: ${contextInfo}` : ''}

USER SAID: "${userIntent}"

Write ONE punchy sentence explaining why ${context.selectedProtocol} is the move.

STYLE RULES:
- Match their energy EXACTLY (hype = hype, chill = chill, degen = full degen)
- Use crypto slang naturally (ape, moon, ngmi, wagmi, degen, based, etc.)
- Be opinionated and confident - no "may" or "could" or "potentially"
- Add personality - humor, sarcasm, excitement, whatever fits
- NO corporate speak - no "optimal" "strategic" "comprehensive"
- Keep it SHORT - one sentence max
- Sound like you're texting a friend, not writing a report

GOOD EXAMPLES:
- User: "ape into gains" → "${context.selectedProtocol} is printing ${context.apy}% and we're not missing this train"
- User: "safe play" → "${context.selectedProtocol} at ${context.apy}% is boring but you'll actually keep your money"
- User: "moon mission" → "${context.selectedProtocol} hitting ${context.apy}% - not quite moon but we're not ngmi either"
- User: "best returns" → "${context.selectedProtocol} with ${context.apy}% because everything else is trash rn"

BAD EXAMPLES (too corporate):
- "We've strategically selected ${context.selectedProtocol} for optimal returns"
- "${context.selectedProtocol} offers a compelling risk-adjusted yield"
- "This protocol provides comprehensive value"

Your response (one sentence only):`;

    try {
      const result = await this.callLLM(prompt);
      if (typeof result !== 'string' || result.length === 0) return null;

      // Validation: Ensure the response mentions the selected protocol
      const selectedProtocolLower = context.selectedProtocol.toLowerCase();
      const resultLower = result.toLowerCase();

      if (!resultLower.includes(selectedProtocolLower)) {
        console.warn(
          `[ReasoningAdapter] Final explanation does not mention selected protocol "${context.selectedProtocol}", discarding`
        );
        return null;
      }

      return result;
    } catch {
      return null;
    }
  }

  private async callLLM(prompt: string): Promise<string | null> {
    if (!this.enabled) return null;

    console.log(`[ReasoningAdapter] LLM CALL → provider: groq, model: ${GROQ_MODEL}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const requestBody = {
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3,
      };

      console.log(
        `[ReasoningAdapter] → Request: POST https://api.groq.com/openai/v1/chat/completions`
      );
      console.log(`[ReasoningAdapter] → Model: ${GROQ_MODEL}`);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      console.log(`[ReasoningAdapter] ← Response: HTTP ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error body');
        console.error(
          `[ReasoningAdapter] ✗ groq HTTP ${response.status}: ${errorText}`
        );
        return null;
      }

      const body: unknown = await response.json();
      if (!isRecord(body)) {
        console.error(`[ReasoningAdapter] ✗ Invalid response body (not an object)`);
        return null;
      }

      const choices = body.choices;
      if (!Array.isArray(choices) || choices.length === 0) {
        console.error(`[ReasoningAdapter] ✗ No choices in response`);
        return null;
      }

      const first: unknown = choices[0];
      if (!isRecord(first)) {
        console.error(`[ReasoningAdapter] ✗ Invalid choice format`);
        return null;
      }

      const message = first.message;
      if (!isRecord(message)) {
        console.error(`[ReasoningAdapter] ✗ Invalid message format`);
        return null;
      }

      const content = typeof message.content === 'string' ? message.content.trim() : null;

      if (content) {
        console.log(
          `[ReasoningAdapter] ✓ LLM response received (${content.length} chars): "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`
        );
      } else {
        console.error(`[ReasoningAdapter] ✗ No content in message`);
      }

      return content;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error(`[ReasoningAdapter] ✗ groq call timeout (${LLM_TIMEOUT_MS}ms)`);
        } else {
          console.error(`[ReasoningAdapter] ✗ groq call failed: ${error.message}`);
        }
      } else {
        console.error(`[ReasoningAdapter] ✗ groq call failed:`, error);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
