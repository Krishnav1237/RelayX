/**
 * Chain configurations for RelayX testnet interactions.
 *
 * Supported chains:
 *   - Sepolia (11155111) — DEFAULT: Uniswap v3 quotes + swap signing
 *   - 0G Galileo (16602) — BACKEND ONLY: execution memory storage
 *   - Ethereum Mainnet (1) — production
 *
 * NOTE: 0G Galileo is backend-only. Users only need Sepolia connected.
 */

export interface ChainConfig {
  chainId: string;         // hex string e.g. '0xaa36a7'
  chainIdDecimal: number;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  iconUrl?: string;
  isTestnet?: boolean;
  backendOnly?: boolean;  // true = no UI chain switching required
}

export const CHAINS: Record<string, ChainConfig> = {
  sepolia: {
    chainId: '0xaa36a7',
    chainIdDecimal: 11155111,
    chainName: 'Sepolia Testnet',
    nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
    ],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
    isTestnet: true,
  },

  mainnet: {
    chainId: '0x1',
    chainIdDecimal: 1,
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum.publicnode.com'],
    blockExplorerUrls: ['https://etherscan.io'],
  },

  zerogGalileo: {
    chainId: '0x40DA',   // 16602 decimal (0G Galileo Testnet — BACKEND ONLY)
    chainIdDecimal: 16602,
    chainName: '0G Galileo Testnet',
    nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
    rpcUrls: ['https://evmrpc-testnet.0g.ai'],
    blockExplorerUrls: ['https://explorer.0g.ai'],
    isTestnet: true,
    backendOnly: true,  // storage is handled server-side; no frontend chain switch needed
  },
};

export function getChainById(chainId: number): ChainConfig | null {
  return Object.values(CHAINS).find((c) => c.chainIdDecimal === chainId) ?? null;
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const chain = getChainById(chainId);
  const explorerBase = chain?.blockExplorerUrls[0] ?? 'https://etherscan.io';
  return `${explorerBase}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: number, address: string): string {
  const chain = getChainById(chainId);
  const explorerBase = chain?.blockExplorerUrls[0] ?? 'https://etherscan.io';
  return `${explorerBase}/address/${address}`;
}
