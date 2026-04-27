"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ThemeToggle } from "./theme-toggle";
import { Terminal } from "lucide-react";

export function Navbar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4 pointer-events-none">
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto w-full max-w-3xl rounded-full border border-zinc-200/20 bg-background/60 backdrop-blur-xl shadow-lg shadow-emerald-500/5 dark:shadow-emerald-500/5"
      >
        <div className="flex h-14 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <Terminal className="h-5 w-5 text-emerald-500 transition-transform group-hover:scale-110" />
            <span className="font-mono text-base font-bold tracking-tight">RelayX</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <Link href="/#features" className="hover:text-foreground transition-all duration-300 hover:scale-105">Capabilities</Link>
            <Link href="/#workflow" className="hover:text-foreground transition-all duration-300 hover:scale-105">Agent Workflow</Link>
          </nav>

          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </motion.header>
    </div>
  );
}
