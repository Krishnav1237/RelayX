export const DEFAULT_APPROVAL_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_MAX_INTENT_LENGTH = 1_000;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 120;

export function getApprovalTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  return readBoundedInteger(env.APPROVAL_TTL_MS, DEFAULT_APPROVAL_TTL_MS, 30_000, 30 * 60_000);
}

export function getMaxIntentLength(env: NodeJS.ProcessEnv = process.env): number {
  return readBoundedInteger(env.MAX_INTENT_LENGTH, DEFAULT_MAX_INTENT_LENGTH, 50, 10_000);
}

export function getRateLimitWindowMs(env: NodeJS.ProcessEnv = process.env): number {
  return readBoundedInteger(
    env.RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
    1_000,
    60 * 60_000
  );
}

export function getRateLimitMaxRequests(env: NodeJS.ProcessEnv = process.env): number {
  return readBoundedInteger(env.RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX_REQUESTS, 1, 10_000);
}

export function validateIntent(
  value: unknown,
  env: NodeJS.ProcessEnv = process.env
): { ok: true; intent: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, error: 'Invalid input: intent must be a non-empty string' };
  }

  const intent = value.trim();
  const maxLength = getMaxIntentLength(env);
  if (intent.length > maxLength) {
    return {
      ok: false,
      error: `Invalid input: intent must be ${maxLength} characters or fewer`,
    };
  }

  return { ok: true, intent };
}

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
