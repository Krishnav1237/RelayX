import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WalletStore, WalletType, NetworkType } from './types';
import { connectMetaMask } from './connectors/metamask';
import { connectPhantom } from './connectors/phantom';
import { connectWalletConnect } from './connectors/walletconnect';

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      // State
      isConnected: false,
      address: null,
      walletType: null,
      networkType: null,
      isConnecting: false,
      error: null,

      // Actions
      connect: async (walletType: WalletType) => {
        set({ isConnecting: true, error: null });

        try {
          let address: string;
          let networkType: NetworkType;

          switch (walletType) {
            case 'metamask':
              address = await connectMetaMask();
              networkType = 'ethereum';
              break;
            case 'phantom':
              address = await connectPhantom();
              networkType = 'solana';
              break;
            case 'walletconnect':
              address = await connectWalletConnect();
              networkType = 'ethereum';
              break;
            default:
              throw new Error('Unsupported wallet type');
          }

          set({
            isConnected: true,
            address,
            walletType,
            networkType,
            isConnecting: false,
            error: null,
          });

          // Store in localStorage for persistence
          if (typeof window !== 'undefined') {
            localStorage.setItem('wallet_connected', 'true');
            localStorage.setItem('wallet_type', walletType);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
          set({
            isConnecting: false,
            error: errorMessage,
            isConnected: false,
            address: null,
            walletType: null,
            networkType: null,
          });
          throw error;
        }
      },

      disconnect: () => {
        set({
          isConnected: false,
          address: null,
          walletType: null,
          networkType: null,
          error: null,
        });

        // Clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('wallet_connected');
          localStorage.removeItem('wallet_type');
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'wallet-storage',
      partialize: (state) => ({
        isConnected: state.isConnected,
        address: state.address,
        walletType: state.walletType,
        networkType: state.networkType,
      }),
    }
  )
);
