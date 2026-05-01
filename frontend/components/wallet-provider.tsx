"use client";

import { useAutoConnect } from "@/lib/wallet/hooks/useAutoConnect";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  useAutoConnect();
  return <>{children}</>;
}
