import { useEffect, useRef } from 'react';
import { useWalletStore } from '../store';

export function useAutoConnect() {
  const { connect, isConnected, walletType } = useWalletStore();
  const hasAttemptedReconnect = useRef(false);

  useEffect(() => {
    // Only attempt reconnection once on mount
    if (hasAttemptedReconnect.current) return;
    hasAttemptedReconnect.current = true;

    // Check if we should attempt to reconnect
    const shouldReconnect =
      typeof window !== 'undefined' &&
      localStorage.getItem('wallet_connected') === 'true' &&
      !isConnected;

    if (!shouldReconnect || !walletType) return;

    // Attempt silent reconnection
    const attemptReconnect = async () => {
      try {
        await connect(walletType);
      } catch (error) {
        // Silent fail - user can manually reconnect if needed
        console.debug('Auto-reconnect failed:', error);
      }
    };

    // Small delay to ensure providers are loaded
    const timeoutId = setTimeout(attemptReconnect, 500);

    return () => clearTimeout(timeoutId);
  }, [connect, isConnected, walletType]);
}
