/**
 * Wallet utilities for RelayX on-chain interactions.
 *
 * Handles:
 *   - MetaMask connection via EIP-1193 (window.ethereum)
 *   - Network switching (Sepolia, 0G Galileo)
 *   - EIP-712 typed data signing for approval confirmations
 *   - Swap transaction submission via MetaMask
 */

import { CHAINS, getExplorerTxUrl } from './chains';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletConnection {
  address: string;
  chainId: number;
  chainName: string;
}

export interface SwapCalldata {
  to: string;
  data: string;
  value: string;
  gasEstimate: string;
  tokenIn: string;
  tokenOut: string;
  amountOut: string;
  router: string;
  deadline: number;
}

export interface SignedApproval {
  approvalId: string;
  signature: string;
  signer: string;
  timestamp: number;
}

export interface SwapResult {
  txHash: string;
  explorerUrl: string;
  chainId: number;
}

// ─── EIP-1193 provider type ───────────────────────────────────────────────────

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

function getEthereum(): EthereumProvider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
  }
  return window.ethereum as EthereumProvider;
}

// ─── Connection ───────────────────────────────────────────────────────────────

export async function connectWallet(): Promise<WalletConnection> {
  const ethereum = getEthereum();

  const accounts = (await ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please unlock MetaMask.');
  }

  const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;
  const chainId = parseInt(chainIdHex, 16);

  const chainName = getChainName(chainId);

  return { address: accounts[0], chainId, chainName };
}

export async function getCurrentChainId(): Promise<number> {
  const ethereum = getEthereum();
  const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;
  return parseInt(chainIdHex, 16);
}

export function getChainName(chainId: number): string {
  const chain = Object.values(CHAINS).find((c) => c.chainIdDecimal === chainId);
  return chain?.chainName ?? `Chain ${chainId}`;
}

// ─── Network switching ────────────────────────────────────────────────────────

export async function switchToSepolia(): Promise<void> {
  await switchToChain(CHAINS.sepolia);
}

export async function switchToZeroGGalileo(): Promise<void> {
  await switchToChain(CHAINS.zerogGalileo);
}

export async function switchToChain(chain: (typeof CHAINS)[string]): Promise<void> {
  const ethereum = getEthereum();

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chain.chainId }],
    });
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error?.code === 4902) {
      // Chain not added yet — add it
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chain.chainId,
            chainName: chain.chainName,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls,
            blockExplorerUrls: chain.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw new Error(
        `Failed to switch to ${chain.chainName}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

// ─── EIP-712 Approval signing ─────────────────────────────────────────────────

export async function signApproval(
  approvalId: string,
  expiresAt: number,
  signerAddress: string,
  chainId: number
): Promise<SignedApproval> {
  const ethereum = getEthereum();

  const domain = {
    name: 'RelayX',
    version: '1',
    chainId,
  };

  const types = {
    Approval: [
      { name: 'approvalId', type: 'string' },
      { name: 'signer', type: 'address' },
      { name: 'expiresAt', type: 'uint256' },
    ],
  };

  const value = {
    approvalId,
    signer: signerAddress,
    expiresAt,
  };

  const msgParams = {
    domain,
    message: value,
    primaryType: 'Approval',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
      ...types,
    },
  };

  const signature = (await ethereum.request({
    method: 'eth_signTypedData_v4',
    params: [signerAddress, JSON.stringify(msgParams)],
  })) as string;

  return {
    approvalId,
    signature,
    signer: signerAddress,
    timestamp: Date.now(),
  };
}

// ─── Swap transaction submission ──────────────────────────────────────────────

export async function submitSwapTransaction(
  calldata: SwapCalldata,
  signerAddress: string,
  chainId: number
): Promise<SwapResult> {
  const ethereum = getEthereum();

  // Estimate gas with 20% buffer
  let gasLimit = '0x' + Math.ceil(Number(calldata.gasEstimate) * 1.2).toString(16);

  try {
    const estimated = (await ethereum.request({
      method: 'eth_estimateGas',
      params: [
        {
          from: signerAddress,
          to: calldata.to,
          data: calldata.data,
          value: '0x' + BigInt(calldata.value).toString(16),
        },
      ],
    })) as string;
    gasLimit = '0x' + Math.ceil(Number(estimated) * 1.2).toString(16);
  } catch {
    // Use the estimate from the calldata
  }

  const txHash = (await ethereum.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: signerAddress,
        to: calldata.to,
        data: calldata.data,
        value: '0x' + BigInt(calldata.value).toString(16),
        gas: gasLimit,
      },
    ],
  })) as string;

  return {
    txHash,
    explorerUrl: getExplorerTxUrl(chainId, txHash),
    chainId,
  };
}

// ─── Wallet event listeners ───────────────────────────────────────────────────

export function onAccountsChanged(callback: (accounts: string[]) => void): () => void {
  if (typeof window === 'undefined' || !window.ethereum) return () => {};
  const handler = (accounts: unknown) => callback(accounts as string[]);
  (window.ethereum as EthereumProvider).on('accountsChanged', handler);
  return () => (window.ethereum as EthereumProvider).removeListener('accountsChanged', handler);
}

export function onChainChanged(callback: (chainId: number) => void): () => void {
  if (typeof window === 'undefined' || !window.ethereum) return () => {};
  const handler = (chainIdHex: unknown) => callback(parseInt(chainIdHex as string, 16));
  (window.ethereum as EthereumProvider).on('chainChanged', handler);
  return () => (window.ethereum as EthereumProvider).removeListener('chainChanged', handler);
}

// ─── Address formatting ────────────────────────────────────────────────────────

export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
