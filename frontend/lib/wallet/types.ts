export type WalletType = 'metamask' | 'phantom' | 'walletconnect';
export type NetworkType = 'ethereum' | 'solana';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletType: WalletType | null;
  networkType: NetworkType | null;
  isConnecting: boolean;
  error: string | null;
}

export interface WalletActions {
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

export interface WalletStore extends WalletState, WalletActions {}
