'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Copy, LogOut, Check, ChevronDown } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet/store';
import { WalletConnectModal } from './wallet-connect-modal';
import { shortenAddress, copyToClipboard, getNetworkName, getWalletIcon } from '@/lib/wallet/utils';

export function WalletButton() {
  const { isConnected, address, disconnect, networkType, walletType } = useWalletStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyAddress = async () => {
    if (!address) return;

    try {
      await copyToClipboard(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-wallet-dropdown]')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Prevent hydration mismatch
  if (!mounted) {
    return <div className="h-9 w-32 animate-pulse rounded-full bg-accent" />;
  }

  if (!isConnected || !address) {
    return (
      <>
        <motion.button
          onClick={() => setIsModalOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 shadow-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/20 dark:text-emerald-400"
        >
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">Connect Wallet</span>
        </motion.button>

        <WalletConnectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  return (
    <div className="relative" data-wallet-dropdown>
      {/* Connected Wallet Button */}
      <motion.button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 shadow-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/20 dark:text-emerald-400"
      >
        <span className="text-base">{getWalletIcon(walletType)}</span>
        <span className="font-mono">{shortenAddress(address)}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
        />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-background p-2 shadow-2xl shadow-emerald-500/10"
          >
            {/* Wallet Info */}
            <div className="border-b border-border px-3 py-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{getWalletIcon(walletType)}</span>
                <span>{getNetworkName(networkType)}</span>
              </div>
              <div className="font-mono text-sm text-foreground">{shortenAddress(address, 6)}</div>
            </div>

            {/* Actions */}
            <div className="space-y-1 py-1">
              {/* Copy Address */}
              <button
                onClick={handleCopyAddress}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Address</span>
                  </>
                )}
              </button>

              {/* Disconnect */}
              <button
                onClick={handleDisconnect}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
