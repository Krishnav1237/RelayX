'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Terminal,
  Loader2,
  AlertTriangle,
  Play,
  Shield,
  Zap,
  Layers,
  RefreshCw,
  X,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppBackground } from '@/components/app-background';
import { ExecutionFloatingPanel } from '@/components/execution-floating-panel';
import { Navbar } from '@/components/navbar';
import { useWalletStore } from '@/lib/wallet';
import { switchToSepolia, formatAddress, submitSwapTransaction, getCurrentChainId } from '@/lib/wallet-actions';
import {
  buildTerminalStatusEvents,
  loadExecutionSession,
  normalizeAgentName,
  normalizeExecutionResponse,
  saveExecutionSession,
  saveExecutionLog,
  initializeStorage,
  generateSessionId,
  type AgentTrace,
  type ExecutionRequest,
  type ExecutionRequestContext,
  type ExecutionResponse,
  type ExecutionSessionSnapshot,
  type TerminalStatusEvent,
} from '@/lib/execution';
import { cn } from '@/lib/utils';

interface DashboardError {
  id: string;
  title: string;
  message: string;
  details?: string;
  expanded: boolean;
  createdAt: number;
}

/**
 * Dashboard page for intent input and execution visualization
 */

export default function Dashboard() {
  const router = useRouter();
  const { isConnected, address, networkType } = useWalletStore();
  const terminalScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const hasRestoredSessionRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isStoppingRef = useRef(false);
  const [sessionId, setSessionId] = useState(generateSessionId());
  const [intent, setIntent] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [lastRequestContext, setLastRequestContext] = useState<ExecutionRequestContext>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<ExecutionResponse | null>(null);
  const [errors, setErrors] = useState<DashboardError[]>([]);
  const [streamQueue, setStreamQueue] = useState<AgentTrace[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalCancelled, setApprovalCancelled] = useState(false);

  // For simulated streaming
  const [visibleTraces, setVisibleTraces] = useState<AgentTrace[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [resultPanelCollapsed, setResultPanelCollapsed] = useState(false);
  const [resultPanelDismissed, setResultPanelDismissed] = useState(false);

  // Track current chain ID for network status
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);

  // Check chain ID when wallet is connected
  useEffect(() => {
    if (!isConnected || !address) {
      setCurrentChainId(null);
      return;
    }

    const checkChainId = async () => {
      try {
        const chainId = await getCurrentChainId();
        setCurrentChainId(chainId);
      } catch {
        setCurrentChainId(null);
      }
    };

    checkChainId();

    // Listen for chain changes
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleChainChanged = (chainIdHex: string) => {
        setCurrentChainId(parseInt(chainIdHex, 16));
      };
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [isConnected, address]);

  // Defensive check for visibleTraces content
  const terminalEvents = useMemo(() => {
    try {
      return buildTerminalStatusEvents(visibleTraces.filter(Boolean));
    } catch (e) {
      console.error('Failed to build terminal events:', e);
      return [];
    }
  }, [visibleTraces]);

  const isNearBottom = (element: HTMLDivElement) => {
    const threshold = 72;
    return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
  };

  const handleTerminalScroll = (event: React.UIEvent<HTMLDivElement>) => {
    shouldAutoScrollRef.current = isNearBottom(event.currentTarget);
  };

  const pushError = (error: unknown) => {
    const dashboardError = createDashboardError(error);
    setErrors((current) => [dashboardError, ...current].slice(0, 4));
  };

  const dismissError = (id: string) => {
    setErrors((current) => current.filter((error) => error.id !== id));
  };

  const toggleErrorDetails = (id: string) => {
    setErrors((current) =>
      current.map((error) => (error.id === id ? { ...error, expanded: !error.expanded } : error))
    );
  };

  const getSessionSnapshot = useCallback(
    (overrides: Partial<ExecutionSessionSnapshot> = {}): ExecutionSessionSnapshot => ({
      sessionId,
      intent,
      demoMode,
      debugMode,
      requestContext: lastRequestContext,
      response,
      visibleTraces,
      streamQueue,
      isStreaming,
      showSummary,
      approvalCancelled,
      resultPanelCollapsed,
      resultPanelDismissed,
      ...overrides,
    }),
    [
      sessionId, // CRITICAL: Must include sessionId in dependencies
      intent,
      demoMode,
      debugMode,
      lastRequestContext,
      response,
      visibleTraces,
      streamQueue,
      isStreaming,
      showSummary,
      approvalCancelled,
      resultPanelCollapsed,
      resultPanelDismissed,
    ]
  );

  useEffect(() => {
    // Clear state only once per browser tab session
    initializeStorage();

    const restoreTimer = window.setTimeout(() => {
      const savedSession = loadExecutionSession();

      if (savedSession) {
        const shouldResumeStreaming =
          savedSession.isStreaming && savedSession.streamQueue.length > 0;
        const shouldShowSummary =
          savedSession.showSummary ||
          Boolean(
            savedSession.response && !shouldResumeStreaming && savedSession.visibleTraces.length > 0
          );

        setSessionId(savedSession.sessionId);
        setIntent(savedSession.intent);
        setDemoMode(savedSession.demoMode);
        setDebugMode(savedSession.debugMode);
        setLastRequestContext(savedSession.requestContext);
        setResponse(savedSession.response);
        setVisibleTraces(savedSession.visibleTraces);
        setStreamQueue(savedSession.streamQueue);
        setIsStreaming(shouldResumeStreaming);
        setShowSummary(shouldShowSummary);
        setApprovalCancelled(savedSession.approvalCancelled);
        setResultPanelCollapsed(savedSession.resultPanelCollapsed);
        setResultPanelDismissed(savedSession.resultPanelDismissed);
        shouldAutoScrollRef.current = true;
      }

      hasRestoredSessionRef.current = true;
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!hasRestoredSessionRef.current) return;

    saveExecutionSession(getSessionSnapshot());
  }, [getSessionSnapshot]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent.trim() || isSubmitting || isStreaming || isApproving || isStoppingRef.current) return;

    shouldAutoScrollRef.current = true;
    setIsSubmitting(true);
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setResponse(null);
    setVisibleTraces([]);
    setStreamQueue([]);
    setShowSummary(false);
    setApprovalCancelled(false);
    setResultPanelCollapsed(false);
    setResultPanelDismissed(false);

    const context: ExecutionRequestContext = {};
    if (demoMode) context.demo = true;
    if (debugMode) context.debug = true;
    if (address) context.wallet = address;
    setLastRequestContext(context);

    // Clear old logs and save initial session state BEFORE making the request
    // This ensures logs page shows the new session immediately
    const initialSession: ExecutionSessionSnapshot = {
      sessionId: newSessionId,
      intent: intent.trim(),
      demoMode,
      debugMode,
      requestContext: context,
      response: null,
      visibleTraces: [],
      streamQueue: [],
      isStreaming: false,
      showSummary: false,
      approvalCancelled: false,
      resultPanelCollapsed: false,
      resultPanelDismissed: false,
    };
    console.log('[DASHBOARD DEBUG] Saving initial session:', {
      sessionId: newSessionId,
      intent: intent.trim(),
    });
    saveExecutionSession(initialSession);

    const body: ExecutionRequest =
      Object.keys(context).length > 0
        ? { intent: intent.trim(), context }
        : { intent: intent.trim() };

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(await getExecutionErrorMessage(res));
      }

      const data = normalizeExecutionResponse(await res.json());
      data.sessionId = newSessionId; // Use the NEW session ID, not the old one
      setResponse(data);
      setStreamQueue(data.trace);
      saveExecutionLog(data);
      saveExecutionSession({
        ...initialSession,
        response: data,
        streamQueue: data.trace,
        isStreaming: true,
        savedAt: Date.now(),
      });
      setIsStreaming(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Handled by handleStop
      }
      console.error(error);
      setIsStreaming(false);
      pushError(error);
    } finally {
      setIsSubmitting(false);
      abortControllerRef.current = null;
    }
  };

  const handleApproveExecution = async () => {
    if (!response?.approval || isApproving || isStreaming) return;

    setIsApproving(true);
    setShowSummary(false);
    setApprovalCancelled(false);
    setResultPanelCollapsed(false);
    setResultPanelDismissed(false);

    try {
      // 1. If we have real calldata from Uniswap, execute the transaction first via MetaMask
      const synthTraces: AgentTrace[] = [];

      // Log the user's approval
      synthTraces.push({
        agent: 'system.relay.eth',
        step: 'approval_granted',
        message: 'Execution request was approved by the user.',
        metadata: {},
        timestamp: Date.now(),
      });

      // 1. Submit on-chain via wallet if calldata exists
      if (response.final_result.swap?.calldata && address) {
        console.log('[DASHBOARD] Submitting transaction to MetaMask...', {
          hasCalldata: !!response.final_result.swap.calldata,
          wallet: address,
        });

        // Fetch the actual live chainId from MetaMask instead of guessing
        let chainId = 11155111; // default to Sepolia
        try {
          chainId = await getCurrentChainId();
          console.log('[DASHBOARD] Current chain ID:', chainId);
        } catch {
          // keep Sepolia default if provider unavailable
        }

        // Network Guard: Force Sepolia if we have real calldata
        if (chainId !== 11155111) {
          console.log('[DASHBOARD] Wrong network, switching to Sepolia...');
          try {
            await switchToSepolia();
            chainId = 11155111;
            console.log('[DASHBOARD] Switched to Sepolia successfully');
          } catch (err) {
            throw new Error('Please switch to Sepolia to execute this transaction.');
          }
        }

        // Add trace to show transaction is being submitted
        synthTraces.push({
          agent: 'executor.relay.eth',
          step: 'transaction_submit',
          message: 'Submitting swap transaction to MetaMask for signature...',
          metadata: { chainId, router: response.final_result.swap.calldata.to },
          timestamp: Date.now(),
        });

        // Update UI to show transaction is being submitted
        setVisibleTraces((prev) => [...prev, ...synthTraces]);

        try {
          console.log('[DASHBOARD] Calling submitSwapTransaction...');
          const swapResult = await submitSwapTransaction(
            response.final_result.swap.calldata,
            address,
            chainId
          );
          console.log('[DASHBOARD] Transaction submitted successfully!', swapResult);
          
          // Record synthetic trace — we'll merge it with backend traces below
          synthTraces.push({
            agent: 'executor.relay.eth',
            step: 'execute',
            message: `✓ Transaction broadcasted on-chain! Hash: ${swapResult.txHash}`,
            metadata: { 
              txHash: swapResult.txHash, 
              explorerUrl: swapResult.explorerUrl, 
              chainId,
              success: true,
            },
            timestamp: Date.now(),
          });
        } catch (err) {
          console.error('[DASHBOARD] Transaction failed:', err);
          // User rejected or transaction failed — abort entirely
          throw new Error(`Transaction failed or rejected: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        console.log('[DASHBOARD] No calldata or wallet address, skipping on-chain execution', {
          hasCalldata: !!response.final_result.swap?.calldata,
          hasWallet: !!address,
        });
      }

      // 2. Confirm execution on backend to store history on 0G Galileo
      const res = await fetch('/api/execute/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: response.approval.id }),
      });

      if (!res.ok) {
        throw new Error(await getExecutionErrorMessage(res));
      }

      const data = normalizeExecutionResponse(await res.json());
      // Merge synthetic MetaMask traces with backend traces so they aren't overwritten
      const backendNewTraces = data.trace.slice(visibleTraces.length);
      const mergedNewTraces = [...synthTraces, ...backendNewTraces];
      const combinedTrace = [...visibleTraces, ...mergedNewTraces];
      const finalResponse = { ...data, trace: combinedTrace };
      
      setResponse(finalResponse);
      setStreamQueue(mergedNewTraces);
      saveExecutionLog(finalResponse);
      saveExecutionSession(
        getSessionSnapshot({
          response: finalResponse,
          streamQueue: mergedNewTraces,
          isStreaming: true,
          showSummary: false,
          approvalCancelled: false,
          resultPanelCollapsed: false,
          resultPanelDismissed: false,
        })
      );
      setIsStreaming(true);
    } catch (error) {
      console.error(error);
      setIsStreaming(false);
      setShowSummary(true);
      pushError(error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleCancelApproval = () => {
    setApprovalCancelled(true);
    setShowSummary(true);

    const cancelTrace: AgentTrace = {
      agent: 'system.relay.eth',
      step: 'approval_cancelled',
      message: 'Execution request was rejected by the user.',
      metadata: {},
      timestamp: Date.now(),
    };

    const nextTraces = [...visibleTraces, cancelTrace];
    setVisibleTraces(nextTraces);

    if (response) {
      const updatedResponse = { ...response, trace: nextTraces };
      setResponse(updatedResponse);
      saveExecutionLog(updatedResponse);
    }

    saveExecutionSession(
      getSessionSnapshot({
        approvalCancelled: true,
        showSummary: true,
        resultPanelCollapsed: false,
        resultPanelDismissed: false,
        visibleTraces: nextTraces,
      })
    );
  };

  const toggleResultPanelCollapsed = () => {
    const nextCollapsed = !resultPanelCollapsed;
    setResultPanelCollapsed(nextCollapsed);
    saveExecutionSession(getSessionSnapshot({ resultPanelCollapsed: nextCollapsed }));
  };

  const dismissResultPanel = () => {
    setResultPanelDismissed(true);
    saveExecutionSession(getSessionSnapshot({ resultPanelDismissed: true }));
  };

  // Simulate streaming traces
  useEffect(() => {
    if (!isStreaming) return;

    if (streamQueue.length === 0) {
      const summaryTimer = window.setTimeout(() => {
        setIsStreaming(false);
        setShowSummary(true);
        // Save final state when streaming completes
        saveExecutionSession(getSessionSnapshot({ isStreaming: false, showSummary: true }));
      }, 500);
      return () => window.clearTimeout(summaryTimer);
    }

    const streamTimer = window.setTimeout(() => {
      const [nextTrace, ...remainingTraces] = streamQueue;
      if (nextTrace) {
        setVisibleTraces((prev) => {
          const nextTraces = [...prev, nextTrace];
          // Save session after each trace is added to keep dashboard and logs in sync
          saveExecutionSession(
            getSessionSnapshot({
              visibleTraces: nextTraces,
              streamQueue: remainingTraces,
            })
          );
          return nextTraces;
        });
      }
      setStreamQueue(remainingTraces);
    }, 800);

    return () => window.clearTimeout(streamTimer);
  }, [isStreaming, streamQueue, getSessionSnapshot]);

  useEffect(() => {
    const terminal = terminalScrollRef.current;
    if (!terminal || !shouldAutoScrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      terminal.scrollTo({
        top: terminal.scrollHeight,
        behavior: terminalEvents.length > 1 ? 'smooth' : 'auto',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [terminalEvents.length, isStreaming, isSubmitting]);

  const hasVisibleAgent = (agent: string) =>
    visibleTraces.some((trace) => trace && normalizeAgentName(trace.agent) === agent);
  const isSubmitDisabled = !intent.trim() || isSubmitting || isStreaming || isApproving;

  const handleStop = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    isStoppingRef.current = true;
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 500);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsSubmitting(false);
    setIsStreaming(false);
    setStreamQueue([]);
    
    const stopTrace: AgentTrace = {
      agent: 'system.relay.eth',
      step: 'interrupted',
      message: 'Execution stopped by user.',
      metadata: {},
      timestamp: Date.now(),
    };
    
    setVisibleTraces((prev) => {
      const nextTraces = [...prev, stopTrace];
      
      console.log('[DASHBOARD DEBUG] Stopping execution:', {
        sessionId,
        traceCount: nextTraces.length,
        hasResponse: !!response,
      });
      
      // Update response with new traces and ensure sessionId is set
      const updatedResponse = response ? {
        ...response,
        sessionId,
        trace: nextTraces,
      } : null;
      
      if (updatedResponse) {
        setResponse(updatedResponse);
        saveExecutionLog(updatedResponse);
      }
      
      saveExecutionSession(
        getSessionSnapshot({
          isStreaming: false,
          streamQueue: [],
          visibleTraces: nextTraces,
          response: updatedResponse,
        })
      );
      return nextTraces;
    });
  };

  return (
    <div className="relay-page">
      <AppBackground variant="dashboard" />
      <Navbar />

      <main className="relay-container flex flex-1 flex-col gap-7 pt-28 sm:pt-32">
        <header className="flex flex-col gap-3">
          <div className="relay-eyebrow w-fit">
            <Terminal className="h-3.5 w-3.5" />
            Dashboard
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Execution Engine</h1>
            <p className="relay-muted mt-2 max-w-2xl">
              Enter your financial intent, review the agent recommendation, then approve final
              execution.
            </p>
          </div>
        </header>

        {/* Input Area */}
        <div className="relay-panel p-2">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="relative flex flex-col gap-2 sm:flex-row">
              <div className="absolute left-4 top-5 text-zinc-400 sm:top-1/2 sm:-translate-y-1/2">
                <Terminal className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="e.g. Find the safest yield for 1000 USDC"
                className="min-h-14 flex-1 rounded-lg border border-transparent bg-background/30 py-4 pl-12 pr-4 text-foreground transition-colors placeholder:text-zinc-500 focus:border-emerald-500/30 focus:bg-background/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                disabled={isSubmitting || isStreaming || isApproving}
              />
              {isSubmitting || isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="relay-button-secondary min-h-12 px-6 sm:m-1 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="mr-2 h-4 w-4" />
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="relay-button-primary min-h-12 px-6 sm:m-1"
                >
                  Execute
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 px-3 pb-2 text-xs text-zinc-500 dark:text-zinc-400">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-transparent px-2 py-1 transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/10">
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(event) => setDemoMode(event.target.checked)}
                  disabled={isSubmitting || isStreaming || isApproving}
                  className="h-4 w-4 accent-emerald-500"
                />
                Demo retry path
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-transparent px-2 py-1 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/10">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(event) => setDebugMode(event.target.checked)}
                  disabled={isSubmitting || isStreaming || isApproving}
                  className="h-4 w-4 accent-cyan-500"
                />
                Backend debug check
              </label>
            </div>
          </form>
        </div>

        {/* Dashboard Content */}
        <div className="grid flex-1 gap-6 lg:grid-cols-3">
          {/* Main Visualization Terminal */}
          <div className="relay-panel relative z-10 flex h-[20rem] flex-col overflow-hidden sm:h-[22rem] lg:col-span-2 lg:h-[calc(100vh-24rem)] lg:min-h-[18rem] lg:max-h-[24rem]">
            <div className="flex items-center justify-between border-b border-border bg-background/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="ml-2 font-mono text-xs text-zinc-500">relay/orchestrator</span>
              </div>
              {(isStreaming || isSubmitting || isApproving) && (
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>{isApproving ? 'Executing...' : 'Processing...'}</span>
                </div>
              )}
            </div>

            <div
              ref={terminalScrollRef}
              onScroll={handleTerminalScroll}
              className="terminal-scroll flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 font-mono text-sm scroll-smooth"
            >
              {!response && !isSubmitting && !isApproving && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
                  <Terminal className="h-12 w-12 mb-4 opacity-50" />
                  <p>Awaiting intent...</p>
                </div>
              )}

              <AnimatePresence>
                {terminalEvents.map((event, i) => (
                  <TerminalStatusRow
                    key={`${event.agent}-${event.timestamp}-${i}`}
                    event={event}
                    onClick={() => router.push(`/logs?t=${event.timestamp}`)}
                  />
                ))}

                {isStreaming && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="pl-[100px] flex gap-1 items-center h-6 text-zinc-400 dark:text-zinc-500"
                  >
                    <span className="animate-pulse">_</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Sidebar - Status & Summary */}
          <div className="flex flex-col gap-6">
            {/* Wallet Status */}
            {isConnected && address && (
              <div className="relay-panel p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-500" />
                  Connected Wallet
                </h3>
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Network: {networkType === 'ethereum' ? 'Ethereum' : 'Solana'}
                    </div>
                    <div className="font-mono text-xs text-foreground break-all">
                      {formatAddress(address, 6)}
                    </div>
                  </div>

                  {/* Switch to Sepolia for Uniswap quotes */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Required Network</p>
                    <button
                      onClick={async () => { 
                        if (currentChainId === 11155111) return; // Already on Sepolia
                        try { 
                          await switchToSepolia(); 
                          const newChainId = await getCurrentChainId();
                          setCurrentChainId(newChainId);
                        } catch (e) { 
                          console.error(e); 
                        } 
                      }}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors",
                        currentChainId === 11155111
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default"
                          : "border-border bg-accent/30 text-zinc-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400"
                      )}
                    >
                      {currentChainId === 11155111 ? (
                        <span className="flex items-center gap-2">
                          <span className="text-emerald-400">✓</span>
                          Connected to Sepolia
                        </span>
                      ) : (
                        <span>⬡ Switch to Sepolia — Uniswap quotes &amp; signing</span>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Ready for on-chain execution. 0G storage is handled server-side.
                  </p>
                </div>
              </div>
            )}

            {/* Active Agents Overview */}
            <div className="relay-panel p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-500" />
                Network Agents
              </h3>
              <div className="space-y-3">
                <AgentStatusItem
                  agent="system.relay.eth"
                  icon={<Play className="h-4 w-4 text-indigo-500" />}
                  active={isSubmitting || isStreaming || hasVisibleAgent('system.relay.eth')}
                />
                <AgentStatusItem
                  agent="yield.relay.eth"
                  icon={<Zap className="h-4 w-4 text-emerald-500" />}
                  active={isStreaming && hasVisibleAgent('yield.relay.eth')}
                />
                <AgentStatusItem
                  agent="risk.relay.eth"
                  icon={<Shield className="h-4 w-4 text-amber-500" />}
                  active={isStreaming && hasVisibleAgent('risk.relay.eth')}
                />
                <AgentStatusItem
                  agent="executor.relay.eth"
                  icon={<Terminal className="h-4 w-4 text-fuchsia-500" />}
                  active={(isStreaming || isApproving) && hasVisibleAgent('executor.relay.eth')}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      {showSummary && response?.summary && !resultPanelDismissed && (
        <ExecutionFloatingPanel
          approvalCancelled={approvalCancelled}
          collapsed={resultPanelCollapsed}
          isApproving={isApproving}
          onApprove={handleApproveExecution}
          onCancel={handleCancelApproval}
          onDismiss={dismissResultPanel}
          onToggleCollapsed={toggleResultPanelCollapsed}
          requestContext={lastRequestContext}
          response={response}
        />
      )}
      <ErrorStack errors={errors} onDismiss={dismissError} onToggleDetails={toggleErrorDetails} />
    </div>
  );
}

function TerminalStatusRow({ event, onClick }: { event: TerminalStatusEvent; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onClick={onClick}
      className="flex cursor-pointer flex-col gap-1 rounded-lg border border-transparent p-2 text-zinc-700 transition-colors hover:border-emerald-500/10 hover:bg-emerald-500/5 dark:text-zinc-300"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">
          [{new Date(event.timestamp).toISOString().split('T')[1].slice(0, -1)}]
        </span>
        <AgentBadge agent={event.agent} message={event.message} />
      </div>
      <div className="pl-0 sm:pl-[100px] text-zinc-600 dark:text-zinc-400">{event.message}</div>
    </motion.div>
  );
}

function ErrorStack({
  errors,
  onDismiss,
  onToggleDetails,
}: {
  errors: DashboardError[];
  onDismiss: (id: string) => void;
  onToggleDetails: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-3 z-50 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-2 sm:right-4 sm:w-96"
    >
      <AnimatePresence>
        {errors.map((error) => (
          <motion.div
            key={error.id}
            layout
            role="button"
            tabIndex={0}
            onClick={() => onToggleDetails(error.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onToggleDetails(error.id);
              }
            }}
            initial={{ opacity: 0, x: 28, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 28, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto cursor-pointer overflow-hidden rounded-lg border border-red-500/25 bg-card/95 shadow-xl shadow-red-500/10 outline-none backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-400/40 hover:shadow-orange-500/10 focus-visible:ring-2 focus-visible:ring-orange-400/50"
          >
            <div className="h-0.5 bg-gradient-to-r from-red-500 via-orange-400 to-cyan-400" />
            <div className="p-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-red-500/20 bg-red-500/10 text-red-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-foreground">
                        {error.title}
                      </h4>
                      <p
                        className={cn(
                          'mt-0.5 text-sm text-zinc-600 dark:text-zinc-400',
                          !error.expanded && 'truncate'
                        )}
                      >
                        {error.message}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-zinc-500">
                        {error.expanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDismiss(error.id);
                        }}
                        className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Dismiss error"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-500">
                      {new Date(error.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-500">
                      {error.expanded ? 'Click to collapse' : 'Click to expand'}
                    </span>
                  </div>

                  <AnimatePresence>
                    {error.expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        {error.details && (
                          <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-md border border-red-500/15 bg-black/5 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
                            {error.details}
                          </pre>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function AgentBadge({ agent, message }: { agent: string; message?: string }) {
  const normalizedAgent = normalizeAgentName(agent);
  let colorClass =
    'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-transparent';

  if (normalizedAgent === 'system.relay.eth')
    colorClass =
      'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30';
  
  if (normalizedAgent === 'yield.relay.eth')
    colorClass =
      'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30';
  
  if (normalizedAgent === 'risk.relay.eth') {
    colorClass = 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
    if (message) {
      const msg = message.toLowerCase();
      if (msg.includes('reject') || msg.includes('fail') || msg.includes('high risk')) {
        colorClass = 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30';
      } else if (msg.includes('medium risk') || msg.includes('weak') || msg.includes('approaching')) {
        colorClass = 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30';
      }
    }
  }

  if (normalizedAgent === 'executor.relay.eth')
    colorClass =
      'bg-fuchsia-50 dark:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-500/30';

  return (
    <span className={cn('px-2 py-0.5 rounded text-xs border font-medium', colorClass)}>
      {normalizedAgent}
    </span>
  );
}

function AgentStatusItem({
  agent,
  icon,
  active,
}: {
  agent: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-2 transition-all duration-200 hover:border-emerald-500/20 hover:bg-accent/40',
        active ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-transparent'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md',
            active ? 'bg-background shadow-sm' : 'bg-transparent text-zinc-500'
          )}
        >
          {icon}
        </div>
        <span className={cn('text-sm font-medium', !active && 'text-zinc-500')}>{agent}</span>
      </div>
      {active && <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>}
    </div>
  );
}

function createDashboardError(error: unknown): DashboardError {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: 'Execution Failed',
    message: getDashboardErrorMessage(error),
    details: getDashboardErrorDetails(error),
    expanded: false,
    createdAt: Date.now(),
  };
}

function getDashboardErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return 'The execution request could not be completed. You can keep using the dashboard.';
}

function getDashboardErrorDetails(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack && error.stack !== error.message ? error.stack : undefined;
  }

  if (typeof error === 'string') {
    return undefined;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

async function getExecutionErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;
    if (isRecord(payload) && typeof payload.error === 'string') {
      return payload.error;
    }
  } catch {
    // Ignore malformed error responses and fall back to the status code.
  }

  return `Execution failed (${response.status})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
