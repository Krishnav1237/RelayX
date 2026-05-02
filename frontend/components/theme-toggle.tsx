'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-zinc-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/30 hover:bg-accent hover:text-foreground dark:text-zinc-300"
      aria-label="Toggle theme"
    >
      <Sun className="absolute h-[1.05rem] w-[1.05rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.05rem] w-[1.05rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  );
}
