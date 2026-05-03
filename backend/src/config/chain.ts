import type { Chain } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

export type RelayXChainName = 'mainnet' | 'sepolia';

export interface RelayXChainConfig {
  name: RelayXChainName;
  displayName: string;
  chain: Chain;
  chainId: number;
  defaultRpcUrls: readonly string[];
  alchemyEnvVar: 'ALCHEMY_MAINNET_RPC_URL' | 'ALCHEMY_SEPOLIA_RPC_URL';
  defiLlamaChain: 'Ethereum';
}

const CHAIN_CONFIGS: Record<RelayXChainName, RelayXChainConfig> = {
  mainnet: {
    name: 'mainnet',
    displayName: 'Ethereum Mainnet',
    chain: mainnet,
    chainId: mainnet.id,
    defaultRpcUrls: ['https://rpc.ankr.com/eth', 'https://eth.llamarpc.com'],
    alchemyEnvVar: 'ALCHEMY_MAINNET_RPC_URL',
    defiLlamaChain: 'Ethereum',
  },
  sepolia: {
    name: 'sepolia',
    displayName: 'Ethereum Sepolia',
    chain: sepolia,
    chainId: sepolia.id,
    defaultRpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.org'],
    alchemyEnvVar: 'ALCHEMY_SEPOLIA_RPC_URL',
    defiLlamaChain: 'Ethereum',
  },
};

export function getRelayXChain(env: NodeJS.ProcessEnv = process.env): RelayXChainConfig {
  return CHAIN_CONFIGS[normalizeChainName(env.RELAYX_CHAIN ?? env.ETHEREUM_CHAIN)];
}

export function getRelayXRpcUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const config = getRelayXChain(env);
  const urls = [
    ...splitUrls(env.RELAYX_RPC_URL),
    ...splitUrls(env[config.alchemyEnvVar]),
    ...splitUrls(env.ETH_RPC_URL),
    ...splitUrls(env.RPC_URL),
    ...config.defaultRpcUrls,
  ];

  return [...new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0))];
}

export function getQuoteChainId(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.UNISWAP_QUOTE_CHAIN_ID);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return getRelayXChain(env).chainId;
}

function normalizeChainName(value: string | undefined): RelayXChainName {
  const raw = value?.trim().toLowerCase();
  if (raw === 'sepolia' || raw === '11155111') return 'sepolia';
  if (raw === 'mainnet' || raw === 'ethereum' || raw === '1' || raw === undefined || raw === '') {
    return 'mainnet';
  }

  console.warn(`[CHAIN] Unsupported RELAYX_CHAIN="${value}". Falling back to mainnet.`);
  return 'mainnet';
}

function splitUrls(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}
