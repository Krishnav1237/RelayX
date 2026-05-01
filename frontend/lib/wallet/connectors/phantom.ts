declare global {
  interface Window {
    solana?: any;
    phantom?: {
      solana?: any;
    };
  }
}

export async function connectPhantom(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Phantom can only be used in browser environment');
  }

  const provider = getPhantomProvider();

  if (!provider) {
    throw new Error('Phantom wallet is not installed. Please install Phantom extension.');
  }

  try {
    // Request connection
    const response = await provider.connect();
    const address = response.publicKey.toString();

    // Setup disconnect listener
    provider.on('disconnect', () => {
      window.location.reload();
    });

    // Setup account change listener
    provider.on('accountChanged', (publicKey: any) => {
      if (publicKey) {
        window.location.reload();
      } else {
        // Disconnected
        window.location.reload();
      }
    });

    return address;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('User rejected')) {
        throw new Error('Connection request rejected by user');
      }
      throw error;
    }
    throw new Error('Failed to connect to Phantom wallet');
  }
}

function getPhantomProvider() {
  if (typeof window === 'undefined') return null;

  if ('phantom' in window) {
    const phantomWindow = window.phantom;
    if (phantomWindow?.solana?.isPhantom) {
      return phantomWindow.solana;
    }
  }

  if ('solana' in window) {
    const solanaWindow = window.solana;
    if (solanaWindow?.isPhantom) {
      return solanaWindow;
    }
  }

  return null;
}

export function isPhantomInstalled(): boolean {
  return getPhantomProvider() !== null;
}
