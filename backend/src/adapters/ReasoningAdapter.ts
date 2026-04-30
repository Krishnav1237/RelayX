import { YieldOption } from '../types';

const LLM_TIMEOUT_MS = 2000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export class ReasoningAdapter {
  private enabled: boolean;

  constructor() {
    this.enabled = typeof OPENAI_API_KEY === 'string' && OPENAI_API_KEY.length > 0;
    if (!this.enabled) {
      console.log('[ReasoningAdapter] No OPENAI_API_KEY set — LLM reasoning disabled');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async explainYield(options: YieldOption[], selected: YieldOption): Promise<string | null> {
    if (!this.enabled) return null;

    const prompt = `You are a DeFi yield advisor. Given these yield options:\n${options.map(o => `- ${o.protocol}: ${o.apy}% APY, ${o.riskLevel ?? 'unknown'} risk`).join('\n')}\n\nThe system selected ${selected.protocol} (${selected.apy}% APY). Explain why in one concise sentence for a user dashboard.`;

    try {
      const result = await this.callLLM(prompt);
      return typeof result === 'string' && result.length > 0 ? result : null;
    } catch {
      return null;
    }
  }

  async evaluateRisk(plan: YieldOption, ensScore: number): Promise<{ reasoning: string; confidence: number } | null> {
    if (!this.enabled) return null;

    const prompt = `You are a DeFi risk analyst. Evaluate this plan:\n- Protocol: ${plan.protocol}\n- APY: ${plan.apy}%\n- Risk Level: ${plan.riskLevel ?? 'unknown'}\n- ENS Reputation Score: ${ensScore}\n\nRespond with JSON only: {"reasoning": "one sentence", "confidence": 0.0 to 1.0}`;

    try {
      const raw = await this.callLLM(prompt);
      if (!raw) return null;

      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return null;
      if (typeof parsed.reasoning !== 'string' || parsed.reasoning.length === 0) return null;
      if (typeof parsed.confidence !== 'number' || !Number.isFinite(parsed.confidence)) return null;

      return {
        reasoning: parsed.reasoning,
        confidence: normalizeConfidence(Math.max(0, Math.min(1, parsed.confidence))),
      };
    } catch {
      return null;
    }
  }

  private async callLLM(prompt: string): Promise<string | null> {
    if (!OPENAI_API_KEY) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`[ReasoningAdapter] OpenAI HTTP ${response.status}`);
        return null;
      }

      const body: unknown = await response.json();
      if (!isRecord(body)) return null;

      const choices = body.choices;
      if (!Array.isArray(choices) || choices.length === 0) return null;

      const first: unknown = choices[0];
      if (!isRecord(first)) return null;

      const message = first.message;
      if (!isRecord(message)) return null;

      return typeof message.content === 'string' ? message.content.trim() : null;
    } catch (error) {
      console.error('[ReasoningAdapter] LLM call failed:', error instanceof Error ? error.message : error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
