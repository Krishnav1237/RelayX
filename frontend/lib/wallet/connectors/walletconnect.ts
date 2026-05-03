import type { EIP1193Provider, EIP6963AnnounceProviderEvent } from '../types';

// WalletConnect implementation using EIP-6963 for broader wallet support
export async function connectWalletConnect(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('WalletConnect can only be used in browser environment');
  }

  // Try to use any available EIP-6963 wallet provider
  const provider = await detectEIP6963Providers();

  if (provider) {
    try {
      const accounts = await requestAccounts(provider);

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      return accounts[0];
    } catch (error) {
      if (error instanceof Error && error.message.includes('User rejected')) {
        throw new Error('Connection request rejected by user');
      }
      throw error;
    }
  }

  // Fallback: Check for any injected Ethereum provider
  if (window.ethereum) {
    try {
      const accounts = await requestAccounts(window.ethereum);

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      return accounts[0];
    } catch (error) {
      if (error instanceof Error && error.message.includes('User rejected')) {
        throw new Error('Connection request rejected by user');
      }
      throw error;
    }
  }

  throw new Error(
    'No Web3 wallet detected. Please install MetaMask or another Web3 wallet extension.'
  );
}

async function requestAccounts(provider: EIP1193Provider): Promise<string[]> {
  const accounts = await provider.request({
    method: 'eth_requestAccounts',
  });

  return Array.isArray(accounts)
    ? accounts.filter((account): account is string => typeof account === 'string')
    : [];
}

async function detectEIP6963Providers(): Promise<EIP1193Provider | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const providers: EIP1193Provider[] = [];

    // Listen for EIP-6963 announcements
    window.addEventListener('eip6963:announceProvider', (event: Event) => {
      const providerEvent = event as EIP6963AnnounceProviderEvent;
      if (!providerEvent.detail?.provider) return;
      providers.push(providerEvent.detail.provider);
    });

    // Request providers to announce themselves
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Wait a bit for providers to respond
    setTimeout(() => {
      resolve(providers[0] || null);
    }, 100);
  });
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}
