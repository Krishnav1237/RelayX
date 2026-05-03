import { describe, expect, it } from 'vitest';
import { getAgentEnsName, getAgentEnsRoot } from '../config/agents';
import { getRelayXChain, getRelayXRpcUrls } from '../config/chain';
import { getApprovalTtlMs, validateIntent } from '../config/security';

describe('Runtime configuration', () => {
  it('defaults agent identities to RelayX ENS subdomains', () => {
    expect(getAgentEnsRoot({} as NodeJS.ProcessEnv)).toBe('relayx.eth');
    expect(getAgentEnsName('yield', {} as NodeJS.ProcessEnv)).toBe('yield.relayx.eth');
  });

  it('supports custom RelayX ENS roots for testnet subdomains', () => {
    const env = { RELAYX_AGENT_ENS_ROOT: 'agents.relayx.eth' } as NodeJS.ProcessEnv;
    expect(getAgentEnsName('risk', env)).toBe('risk.agents.relayx.eth');
  });

  it('selects Sepolia chain and Sepolia RPC endpoints', () => {
    const env = {
      RELAYX_CHAIN: 'sepolia',
      ALCHEMY_SEPOLIA_RPC_URL: 'https://example.invalid/sepolia',
    } as NodeJS.ProcessEnv;

    expect(getRelayXChain(env).chainId).toBe(11155111);
    expect(getRelayXRpcUrls(env)[0]).toBe('https://example.invalid/sepolia');
  });

  it('bounds approval TTL and intent length validation', () => {
    expect(getApprovalTtlMs({ APPROVAL_TTL_MS: '1' } as NodeJS.ProcessEnv)).toBe(30_000);
    expect(validateIntent('deposit ETH', {} as NodeJS.ProcessEnv)).toEqual({
      ok: true,
      intent: 'deposit ETH',
    });
    expect(
      validateIntent('x'.repeat(51), { MAX_INTENT_LENGTH: '10' } as NodeJS.ProcessEnv)
    ).toEqual({
      ok: false,
      error: 'Invalid input: intent must be 50 characters or fewer',
    });
  });
});
