"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { AppBackground } from "@/components/app-background";
import { ExecutionFloatingPanel } from "@/components/execution-floating-panel";
import { Navbar } from "@/components/navbar";
import { useWalletStore } from "@/lib/wallet";
import {
  buildTerminalStatusEvents,
  loadExecutionSession,
  normalizeAgentName,
  normalizeExecutionResponse,
  saveExecutionSession,
  saveExecutionLog,
  type AgentTrace,
  type ExecutionRequest,
  type ExecutionRequestContext,
  type ExecutionResponse,
  type ExecutionSessionSnapshot,
  type TerminalStatusEvent,
} from "@/lib/execution";
import { cn } from "@/lib/utils";

interface DashboardError {
  id: string;
  title: string;
  message: string;
  details?: string;
  expanded: boolean;
  createdAt: number;
}

export default function Dashboard() {
  const { isConnected, address, networkType } = useWalletStore();
  const terminalScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const hasRestoredSessionRef = useRef(false);
  const [intent, setIntent] = useState("");
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

  // Defensive check for visibleTraces content
  const terminalEvents = useMemo(() => {
    try {
      return buildTerminalStatusEvents(visibleTraces.filter(Boolean));
    } catch (e) {
      console.error("Failed to build terminal events:", e);
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
      current.map((error) =>
        error.id === id ? { ...error, expanded: !error.expanded } : error
      )
    );
  };

  const getSessionSnapshot = useCallback((
    overrides: Partial<ExecutionSessionSnapshot> = {}
  ): ExecutionSessionSnapshot => ({
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
  }), [
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
  ]);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedSession = loadExecutionSession();

      if (savedSession) {
        const shouldResumeStreaming = savedSession.isStreaming && savedSession.streamQueue.length > 0;
        const shouldShowSummary = savedSession.showSummary
          || Boolean(savedSession.response && !shouldResumeStreaming && savedSession.visibleTraces.length > 0);

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
    if (!intent.trim() || isSubmitting || isStreaming || isApproving) return;

    shouldAutoScrollRef.current = true;
    setIsSubmitting(true);
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
    setLastRequestContext(context);

    const body: ExecutionRequest = Object.keys(context).length > 0
      ? { intent: intent.trim(), context }
      : { intent: intent.trim() };

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(await getExecutionErrorMessage(res));
      }

      const data = normalizeExecutionResponse(await res.json());
      setResponse(data);
      setStreamQueue(data.trace);
      saveExecutionLog(data);
      saveExecutionSession(getSessionSnapshot({
        intent: body.intent,
        demoMode,
        debugMode,
        requestContext: context,
        response: data,
        visibleTraces: [],
        streamQueue: data.trace,
        isStreaming: true,
        showSummary: false,
        approvalCancelled: false,
        resultPanelCollapsed: false,
        resultPanelDismissed: false,
      }));
      setIsStreaming(true);
    } catch (error) {
      console.error(error);
      setIsStreaming(false);
      pushError(error);
    } finally {
      setIsSubmitting(false);
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
      const res = await fetch("/api/execute/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId: response.approval.id }),
      });

      if (!res.ok) {
        throw new Error(await getExecutionErrorMessage(res));
      }

      const data = normalizeExecutionResponse(await res.json());
      const newTraces = data.trace.slice(visibleTraces.length);
      setResponse(data);
      setStreamQueue(newTraces.length > 0 ? newTraces : data.trace);
      saveExecutionLog(data);
      saveExecutionSession(getSessionSnapshot({
        response: data,
        streamQueue: newTraces.length > 0 ? newTraces : data.trace,
        isStreaming: true,
        showSummary: false,
        approvalCancelled: false,
        resultPanelCollapsed: false,
        resultPanelDismissed: false,
      }));
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
    saveExecutionSession(getSessionSnapshot({
      approvalCancelled: true,
      showSummary: true,
      resultPanelCollapsed: false,
      resultPanelDismissed: false,
    }));
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
      }, 500);
      return () => window.clearTimeout(summaryTimer);
    }

    const streamTimer = window.setTimeout(() => {
      const [nextTrace, ...remainingTraces] = streamQueue;
      if (nextTrace) {
        setVisibleTraces((prev) => [...prev, nextTrace]);
      }
      setStreamQueue(remainingTraces);
    }, 800);

    return () => window.clearTimeout(streamTimer);
  }, [isStreaming, streamQueue]);

  useEffect(() => {
    const terminal = terminalScrollRef.current;
    if (!terminal || !shouldAutoScrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      terminal.scrollTo({
        top: terminal.scrollHeight,
        behavior: terminalEvents.length > 1 ? "smooth" : "auto",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [terminalEvents.length, isStreaming, isSubmitting]);

  const hasVisibleAgent = (agent: string) => visibleTraces.some((trace) => trace && normalizeAgentName(trace.agent) === agent);
  const isSubmitDisabled = !intent.trim() || isSubmitting || isStreaming || isApproving;

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
              Enter your financial intent, review the agent recommendation, then approve final execution.
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
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="relay-button-primary min-h-12 px-6 sm:m-1"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Execute"}
              </button>
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
                  <span>{isApproving ? "Executing..." : "Processing..."}</span>
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
                {terminalEvents.map((event, idx) => (
                  <TerminalStatusRow event={event} key={`${event.timestamp}-${idx}`} />
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
                <div className="space-y-2">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Network: {networkType === 'ethereum' ? 'Ethereum' : 'Solana'}
                    </div>
                    <div className="font-mono text-sm text-foreground break-all">
                      {address}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Your wallet is ready for execution
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
                <AgentStatusItem agent="system.relay.eth" icon={<Play className="h-4 w-4 text-cyan-500" />} active={isSubmitting || isStreaming || hasVisibleAgent("system.relay.eth")} />
                <AgentStatusItem agent="yield.relay.eth" icon={<Zap className="h-4 w-4 text-emerald-500" />} active={isStreaming && hasVisibleAgent("yield.relay.eth")} />
                <AgentStatusItem agent="risk.relay.eth" icon={<Shield className="h-4 w-4 text-teal-500" />} active={isStreaming && hasVisibleAgent("risk.relay.eth")} />
                <AgentStatusItem agent="executor.relay.eth" icon={<Terminal className="h-4 w-4 text-sky-500" />} active={(isStreaming || isApproving) && hasVisibleAgent("executor.relay.eth")} />
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
      <ErrorStack
        errors={errors}
        onDismiss={dismissError}
        onToggleDetails={toggleErrorDetails}
      />
    </div>
  );
}

function TerminalStatusRow({ event }: { event: TerminalStatusEvent }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex flex-col gap-1 rounded-lg border border-transparent p-2 text-zinc-700 transition-colors hover:border-emerald-500/10 hover:bg-emerald-500/5 dark:text-zinc-300"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">
          [{new Date(event.timestamp).toISOString().split("T")[1].slice(0, -1)}]
        </span>
        <AgentBadge agent={event.agent} />
      </div>
      <div className="pl-0 sm:pl-[100px] text-zinc-600 dark:text-zinc-400">
        {event.message}
      </div>
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
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleDetails(error.id);
              }
            }}
            initial={{ opacity: 0, x: 28, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 28, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
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
                      <h4 className="truncate text-sm font-semibold text-foreground">{error.title}</h4>
                      <p className={cn(
                        "mt-0.5 text-sm text-zinc-600 dark:text-zinc-400",
                        !error.expanded && "truncate"
                      )}>
                        {error.message}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-zinc-500">
                        {error.expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
                      {error.expanded ? "Click to collapse" : "Click to expand"}
                    </span>
                  </div>

                  <AnimatePresence>
                    {error.expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
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

function AgentBadge({ agent }: { agent: string }) {
  const normalizedAgent = normalizeAgentName(agent);
  let colorClass = "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-transparent";
  
  if (normalizedAgent === "system.relay.eth") colorClass = "bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/30";
  if (normalizedAgent === "yield.relay.eth") colorClass = "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30";
  if (normalizedAgent === "risk.relay.eth") colorClass = "bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/30";
  if (normalizedAgent === "executor.relay.eth") colorClass = "bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30";

  return (
    <span className={cn("px-2 py-0.5 rounded text-xs border font-medium", colorClass)}>
      {normalizedAgent}
    </span>
  );
}

function AgentStatusItem({ agent, icon, active }: { agent: string, icon: React.ReactNode, active: boolean }) {
  return (
    <div className={cn("flex items-center justify-between rounded-lg border p-2 transition-all duration-200 hover:border-emerald-500/20 hover:bg-accent/40", active ? "border-emerald-500/20 bg-emerald-500/10" : "border-transparent")}>
      <div className="flex items-center gap-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", active ? "bg-background shadow-sm" : "bg-transparent text-zinc-500")}>
          {icon}
        </div>
        <span className={cn("text-sm font-medium", !active && "text-zinc-500")}>{agent}</span>
      </div>
      {active && <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>}
    </div>
  );
}

function createDashboardError(error: unknown): DashboardError {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "Execution Failed",
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

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "The execution request could not be completed. You can keep using the dashboard.";
}

function getDashboardErrorDetails(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack && error.stack !== error.message ? error.stack : undefined;
  }

  if (typeof error === "string") {
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
    const payload = await response.json() as unknown;
    if (isRecord(payload) && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    // Ignore malformed error responses and fall back to the status code.
  }

  return `Execution failed (${response.status})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
