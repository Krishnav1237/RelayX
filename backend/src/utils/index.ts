// Utility functions for RelayX

export function logger(module: string) {
  return {
    info: (message: string, ...args: unknown[]) => 
      console.log(`[${module}] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) => 
      console.error(`[${module}] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) => 
      console.warn(`[${module}] ${message}`, ...args),
  };
}
