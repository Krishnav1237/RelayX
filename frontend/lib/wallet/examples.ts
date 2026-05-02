/**
 * Example usage patterns for wallet integration
 *
 * These examples show how to integrate wallet functionality
 * with your execution flows and API calls.
 */

import { useWalletStore } from './store';
import { getWalletInfo, requireWalletAddress, isWalletReady } from './integration';

// ============================================================================
// Example 1: Check wallet before execution
// ============================================================================

export async function executeWithWallet(intent: string) {
  // Check if wallet is connected
  if (!isWalletReady()) {
    throw new Error('Please connect your wallet first');
  }

  const walletInfo = getWalletInfo();

  // Make API call with wallet information
  const response = await fetch('/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent,
      walletAddress: walletInfo.address,
      network: walletInfo.networkType,
      walletType: walletInfo.walletType,
    }),
  });

  return response.json();
}

// ============================================================================
// Example 2: React hook usage in component
// ============================================================================

/**
 * Example of using wallet store in a React component:
 *
 * import { useWalletStore } from '@/lib/wallet';
 *
 * function MyComponent() {
 *   const { isConnected, address, networkType, connect, disconnect } = useWalletStore();
 *
 *   const handleExecute = async () => {
 *     if (!isConnected) {
 *       alert('Please connect your wallet first');
 *       return;
 *     }
 *
 *     try {
 *       const result = await executeWithWallet('Swap 100 USDC for ETH');
 *       console.log('Execution result:', result);
 *     } catch (error) {
 *       console.error('Execution failed:', error);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {isConnected ? (
 *         <div>
 *           <p>Connected: {address}</p>
 *           <p>Network: {networkType}</p>
 *           <button onClick={handleExecute}>Execute</button>
 *           <button onClick={disconnect}>Disconnect</button>
 *         </div>
 *       ) : (
 *         <button onClick={() => connect('metamask')}>Connect MetaMask</button>
 *       )}
 *     </div>
 *   );
 * }
 */

// ============================================================================
// Example 3: Conditional execution based on network
// ============================================================================

export async function executeOnEthereum(intent: string) {
  const walletInfo = getWalletInfo();

  if (!walletInfo.isConnected) {
    throw new Error('Wallet not connected');
  }

  if (walletInfo.networkType !== 'ethereum') {
    throw new Error('Please connect an Ethereum wallet');
  }

  // Proceed with Ethereum-specific execution
  return fetch('/api/execute/ethereum', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent,
      address: walletInfo.address,
    }),
  });
}

export async function executeOnSolana(intent: string) {
  const walletInfo = getWalletInfo();

  if (!walletInfo.isConnected) {
    throw new Error('Wallet not connected');
  }

  if (walletInfo.networkType !== 'solana') {
    throw new Error('Please connect a Solana wallet');
  }

  // Proceed with Solana-specific execution
  return fetch('/api/execute/solana', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent,
      address: walletInfo.address,
    }),
  });
}

// ============================================================================
// Example 4: Form submission with wallet validation
// ============================================================================

export async function handleFormSubmit(formData: { intent: string; amount: number }) {
  try {
    // Require wallet to be connected (throws if not)
    const address = requireWalletAddress();

    // Submit with wallet address
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        walletAddress: address,
      }),
    });

    if (!response.ok) {
      throw new Error('Execution failed');
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not connected')) {
      // Handle wallet not connected
      alert('Please connect your wallet to continue');
      return null;
    }
    throw error;
  }
}

// ============================================================================
// Example 5: Subscribe to wallet changes
// ============================================================================

export function setupWalletListener() {
  // Subscribe to wallet state changes
  const unsubscribe = useWalletStore.subscribe((state, prevState) => {
    // Wallet connected
    if (state.isConnected && !prevState.isConnected) {
      console.log('Wallet connected:', state.address);
      // Trigger any necessary updates
    }

    // Wallet disconnected
    if (!state.isConnected && prevState.isConnected) {
      console.log('Wallet disconnected');
      // Clear any wallet-dependent state
    }

    // Address changed
    if (state.address !== prevState.address) {
      console.log('Wallet address changed:', state.address);
      // Refresh data for new address
    }
  });

  // Return cleanup function
  return unsubscribe;
}

// ============================================================================
// Example 6: Wallet-aware API client
// ============================================================================

export class WalletAwareAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const walletInfo = getWalletInfo();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add wallet information to headers if connected
    if (walletInfo.isConnected && walletInfo.address) {
      headers['X-Wallet-Address'] = walletInfo.address;
      headers['X-Wallet-Network'] = walletInfo.networkType || 'unknown';
    }

    return headers;
  }

  async execute(intent: string, options?: { demo?: boolean; debug?: boolean }) {
    const walletInfo = getWalletInfo();

    const body: any = { intent };

    // Include wallet info in body
    if (walletInfo.isConnected) {
      body.walletAddress = walletInfo.address;
      body.network = walletInfo.networkType;
    }

    // Include options
    if (options?.demo || options?.debug) {
      body.context = {
        demo: options.demo,
        debug: options.debug,
      };
    }

    const response = await fetch(`${this.baseUrl}/execute`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async getBalance() {
    const address = requireWalletAddress();

    const response = await fetch(`${this.baseUrl}/balance/${address}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.status}`);
    }

    return response.json();
  }
}

// Usage:
// const client = new WalletAwareAPIClient();
// const result = await client.execute('Swap 100 USDC');
