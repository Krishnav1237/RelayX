export type RelayXAgentRole = 'system' | 'yield' | 'risk' | 'executor';

export const RELAYX_AGENT_ROLES: readonly RelayXAgentRole[] = [
  'system',
  'yield',
  'risk',
  'executor',
] as const;

const DEFAULT_AGENT_ENS_ROOT = 'relayx.eth';

export function getAgentEnsRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.RELAYX_AGENT_ENS_ROOT?.trim().toLowerCase();
  if (!configured) return DEFAULT_AGENT_ENS_ROOT;
  if (!configured.includes('.') || configured.startsWith('.') || configured.endsWith('.')) {
    console.warn(
      `[AGENTS] Invalid RELAYX_AGENT_ENS_ROOT="${env.RELAYX_AGENT_ENS_ROOT}". Falling back to ${DEFAULT_AGENT_ENS_ROOT}.`
    );
    return DEFAULT_AGENT_ENS_ROOT;
  }
  return configured;
}

export function getAgentEnsName(
  role: RelayXAgentRole,
  env: NodeJS.ProcessEnv = process.env
): string {
  return `${role}.${getAgentEnsRoot(env)}`;
}

export function getRequiredAgentNames(env: NodeJS.ProcessEnv = process.env): string[] {
  return RELAYX_AGENT_ROLES.map((role) => getAgentEnsName(role, env));
}
