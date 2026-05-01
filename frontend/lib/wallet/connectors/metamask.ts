import { BrowserProvider } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export async function connectMetaMask(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('MetaMask can only be used in browser environment');
  }

  if (!window.ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask extension.');
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const address = accounts[0];

    // Setup account change listener
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        window.location.reload();
      } else {
        // Account changed
        window.location.reload();
      }
    });

    // Setup chain change listener
    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });

    return address;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('User rejected')) {
        throw new Error('Connection request rejected by user');
      }
      throw error;
    }
    throw new Error('Failed to connect to MetaMask');
  }
}

export async function getMetaMaskNetwork(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  return network.name;
}

export async function switchMetaMaskNetwork(chainId: string): Promise<void> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (error: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      throw new Error('Please add this network to MetaMask first');
    }
    throw error;
  }
}
