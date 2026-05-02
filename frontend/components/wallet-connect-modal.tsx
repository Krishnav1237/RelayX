'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet/store';
import type { WalletType } from '@/lib/wallet/types';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WalletOption {
  type: WalletType;
  name: string;
  icon: string;
  description: string;
  installUrl?: string;
}

const walletOptions: WalletOption[] = [
  {
    type: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    description: 'Connect with MetaMask wallet',
    installUrl: 'https://metamask.io/download/',
  },
  {
    type: 'phantom',
    name: 'Phantom',
    icon: '👻',
    description: 'Connect with Phantom wallet',
    installUrl: 'https://phantom.app/download',
  },
  {
    type: 'walletconnect',
    name: 'WalletConnect',
    icon: '🔗',
    description: 'Connect with any Web3 wallet',
  },
];

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { connect, isConnecting, error, clearError } = useWalletStore();
  const [connectingWallet, setConnectingWallet] = useState<WalletType | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering portal
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = async (walletType: WalletType) => {
    setConnectingWallet(walletType);
    clearError();

    try {
      await connect(walletType);
      onClose();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      // Error is already set in the store
    } finally {
      setConnectingWallet(null);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      clearError();
      onClose();
    }
  };

  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isConnecting) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isConnecting]);

  // Don't render until mounted (prevents SSR issues)
  if (!mounted) {
    return null;
  }

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal Container - centered with proper constraints */}
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-y-auto"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-2xl shadow-emerald-500/20 my-auto"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-modal-title"
            >
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <h2 id="wallet-modal-title" className="text-xl font-bold text-foreground">
                  Connect Wallet
                </h2>
                <button
                  onClick={handleClose}
                  disabled={isConnecting}
                  className="rounded-lg p-1.5 text-zinc-500 transition-all hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Error Message */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="flex-1">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Wallet Options */}
              <div className="space-y-2.5">
                {walletOptions.map((wallet) => {
                  const isThisWalletConnecting = connectingWallet === wallet.type;

                  return (
                    <motion.button
                      key={wallet.type}
                      onClick={() => handleConnect(wallet.type)}
                      disabled={isConnecting}
                      whileHover={{ scale: isConnecting ? 1 : 1.02 }}
                      whileTap={{ scale: isConnecting ? 1 : 0.98 }}
                      className="group relative w-full rounded-xl border border-border bg-accent/50 p-3.5 text-left transition-all hover:border-emerald-500/30 hover:bg-accent hover:shadow-lg hover:shadow-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                    >
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-xl shadow-sm ring-1 ring-border">
                          {wallet.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-sm mb-0.5">
                            {wallet.name}
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {wallet.description}
                          </p>
                        </div>

                        {/* Loading Indicator */}
                        {isThisWalletConnecting && (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-500" />
                        )}
                      </div>

                      {/* Hover Effect */}
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-cyan-500/0 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
                    </motion.button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                <p>By connecting, you agree to our Terms of Service</p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  // Render modal using portal to escape navbar DOM hierarchy
  return createPortal(modalContent, document.body);
}
