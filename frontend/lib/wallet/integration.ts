/**
 * Integration utilities for using wallet data in execution flows
 *
 * These functions demonstrate how to access wallet information
 * for use in backend API calls and execution logic.
 */

import { useWalletStore } from './store';

/**
 * Get the current wallet state for use in API calls
 *
 * @example
 * const walletInfo = getWalletInfo();
 * if (walletInfo.isConnected) {
 *   await fetch('/api/execute', {
 *     body: JSON.stringify({
 *       intent: "Swap 100 USDC",
 *       walletAddress: walletInfo.address,
 *       network: walletInfo.networkType
 *     })
 *   });
 * }
 */
export function getWalletInfo() {
  const state = useWalletStore.getState();
  return {
    isConnected: state.isConnected,
    address: state.address,
    walletType: state.walletType,
    networkType: state.networkType,
  };
}

/**
 * Check if wallet is connected and ready for execution
 */
export function isWalletReady(): boolean {
  const state = useWalletStore.getState();
  return state.isConnected && state.address !== null;
}

/**
 * Get wallet address or throw error if not connected
 */
export function requireWalletAddress(): string {
  const state = useWalletStore.getState();
  if (!state.isConnected || !state.address) {
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }
  return state.address;
}

/**
 * Subscribe to wallet state changes
 *
 * @example
 * const unsubscribe = subscribeToWallet((state) => {
 *   console.log('Wallet state changed:', state);
 * });
 *
 * // Later: unsubscribe()
 */
export function subscribeToWallet(
  callback: (state: ReturnType<typeof useWalletStore.getState>) => void
) {
  return useWalletStore.subscribe(callback);
}
