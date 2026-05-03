export type WalletType = 'metamask' | 'phantom' | 'walletconnect';
export type NetworkType = 'ethereum' | 'solana';

export interface EIP1193RequestArguments {
  method: string;
  params?: readonly unknown[] | Record<string, unknown>;
}

export interface EIP1193Provider {
  request: (args: EIP1193RequestArguments) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface EIP6963ProviderDetail {
  provider: EIP1193Provider;
}

export interface EIP6963AnnounceProviderEvent extends Event {
  detail: EIP6963ProviderDetail;
}

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
