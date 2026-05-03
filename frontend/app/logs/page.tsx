'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, Clock, Database, Filter, Terminal, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { AppBackground } from '@/components/app-background';
import { ExecutionFloatingPanel } from '@/components/execution-floating-panel';
import { Navbar } from '@/components/navbar';
import {
  formatApy,
  loadExecutionSession,
  normalizeAgentName,
  normalizeExecutionResponse,
  saveExecutionSession,
  initializeStorage,
  type AgentTrace,
  type CanonicalAgentName,
  type ExecutionResponse,
  type StoredExecutionLog,
  type StoredExecutionSession,
} from '@/lib/execution';
import { cn } from '@/lib/utils';

type AgentFilter = 'all' | CanonicalAgentName;

const AGENT_FILTERS: Array<{ label: string; value: AgentFilter }> = [
  { label: 'All agents', value: 'all' },
  { label: 'system.relay.eth', value: 'system.relay.eth' },
  { label: 'yield.relay.eth', value: 'yield.relay.eth' },
  { label: 'risk.relay.eth', value: 'risk.relay.eth' },
  { label: 'executor.relay.eth', value: 'executor.relay.eth' },
];

export default function LogsPage() {
  return (
    <Suspense fallback={null}>
      <LogsPageContent />
    </Suspense>
  );
}

function LogsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightTimestamp = searchParams.get('t');
  
  const [storedLog, setStoredLog] = useState<StoredExecutionLog | null>(null);
  const [storedSession, setStoredSession] = useState<StoredExecutionSession | null>(null);
  const [activeFilter, setActiveFilter] = useState<AgentFilter>('all');
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    // Clear state only once per browser tab session
    initializeStorage();

    const refreshLog = () => {
      const session = loadExecutionSession();
      console.log('[LOGS DEBUG] Loaded session:', {
        sessionId: session?.sessionId,
        hasResponse: !!session?.response,
        visibleTracesCount: session?.visibleTraces.length ?? 0,
        intent: session?.intent,
      });
      setStoredSession(session);
      const log = loadCurrentExecutionLog(session);
      console.log('[LOGS DEBUG] Loaded log:', {
        traceCount: log?.response.trace.length ?? 0,
        hasApproval: !!log?.response.approval,
        sessionId: log?.response.sessionId,
      });
      setStoredLog(log);
    };
    
    // Initial load
    const timeout = window.setTimeout(refreshLog, 0);

    // Listen for storage changes from other tabs
    window.addEventListener('storage', refreshLog);
    
    // Poll every 500ms to catch changes in the same tab
    // (storage event doesn't fire for same-tab changes)
    const pollInterval = window.setInterval(refreshLog, 500);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(pollInterval);
      window.removeEventListener('storage', refreshLog);
    };
  }, []);

  const traces = useMemo(() => {
    const rawTraces = storedLog?.response.trace ?? [];
    return [...rawTraces].sort((a, b) => a.timestamp - b.timestamp);
  }, [storedLog]);

  useEffect(() => {
    if (highlightTimestamp && traces.length > 0) {
      const element = document.getElementById(`trace-${highlightTimestamp}`);
      if (element) {
        // Only scroll once when the component mounts or traces change
        // Don't keep scrolling on every render
        window.setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, [highlightTimestamp, traces.length]); // Only depend on traces.length, not traces array

  const filteredTraces = useMemo(() => {
    if (activeFilter === 'all') return traces;
    return traces.filter((trace) => normalizeAgentName(trace.agent) === activeFilter);
  }, [activeFilter, traces]);

  const response = storedLog?.response ?? null;
  const isStaleOrIncomplete = !response || response.summary.explanation === 'Execution in progress or interrupted.';
  const showFloatingPanel = Boolean(
    storedSession?.response && 
    !storedSession.resultPanelDismissed && 
    !isStaleOrIncomplete &&
    storedSession.response.approval // Only show if there's an actual approval pending
  );

  const toggleFloatingPanel = () => {
    if (!storedSession) return;
    const nextSession: StoredExecutionSession = {
      ...storedSession,
      resultPanelCollapsed: !storedSession.resultPanelCollapsed,
      savedAt: Date.now(),
    };
    setStoredSession(nextSession);
    saveExecutionSession(nextSession);
  };

  const dismissFloatingPanel = () => {
    if (!storedSession) return;
    const nextSession: StoredExecutionSession = {
      ...storedSession,
      resultPanelDismissed: true,
      savedAt: Date.now(),
    };
    setStoredSession(nextSession);
    saveExecutionSession(nextSession);
  };

  const approveExecution = async () => {
    if (!storedSession?.response?.approval || isApproving) return;

    setIsApproving(true);

    try {
      const res = await fetch('/api/execute/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: storedSession.response.approval.id }),
      });

      if (!res.ok) {
        throw new Error(await getExecutionErrorMessage(res));
      }

      const response = normalizeExecutionResponse(await res.json());
      response.sessionId = storedSession.sessionId;

      const approveTrace: AgentTrace = {
        agent: 'system.relay.eth',
        step: 'approval_granted',
        message: 'Execution request was approved by the user.',
        metadata: {},
        timestamp: Date.now(),
      };
      
      const newTraces = [approveTrace, ...response.trace.slice(storedSession.response.trace.length)];
      const combinedResponse = {
        ...response,
        trace: [...storedSession.response.trace, ...newTraces],
      };

      const nextSession: StoredExecutionSession = {
        ...storedSession,
        response: combinedResponse,
        visibleTraces: combinedResponse.trace,
        streamQueue: [],
        isStreaming: false,
        showSummary: true,
        approvalCancelled: false,
        resultPanelCollapsed: false,
        resultPanelDismissed: false,
        savedAt: Date.now(),
      };

      setStoredSession(nextSession);
      setStoredLog({ response: combinedResponse, savedAt: nextSession.savedAt });
      saveExecutionSession(nextSession);
    } catch (error) {
      console.error(error);
    } finally {
      setIsApproving(false);
    }
  };

  const cancelApproval = () => {
    if (!storedSession) return;

    const cancelTrace: AgentTrace = {
      agent: 'system.relay.eth',
      step: 'approval_cancelled',
      message: 'Execution request was rejected by the user.',
      metadata: {},
      timestamp: Date.now(),
    };

    const nextResponse = storedSession.response ? {
      ...storedSession.response,
      trace: [...storedSession.response.trace, cancelTrace]
    } : null;

    const nextSession: StoredExecutionSession = {
      ...storedSession,
      response: nextResponse,
      visibleTraces: nextResponse ? nextResponse.trace : [],
      showSummary: true,
      approvalCancelled: true,
      resultPanelCollapsed: false,
      resultPanelDismissed: false,
      savedAt: Date.now(),
    };

    setStoredSession(nextSession);
    if (storedLog && nextResponse) {
      setStoredLog({ response: nextResponse, savedAt: nextSession.savedAt });
    }
    saveExecutionSession(nextSession);
  };

  return (
    <div className="relay-page">
      <AppBackground variant="logs" />
      <Navbar />

      <main className="relay-container flex flex-1 flex-col gap-6 pt-28 sm:pt-32">
        <header className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="relay-eyebrow mb-3">
              <Terminal className="h-3.5 w-3.5" />
              Execution Trace
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Agent Logs</h1>
            <p className="relay-muted mt-2 max-w-2xl text-sm">
              Full backend trace for the latest dashboard execution.
            </p>
            {highlightTimestamp && (
              <button
                onClick={() => router.push('/logs')}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                <X className="h-3 w-3" />
                Clear highlight
              </button>
            )}
          </div>

          <LogSnapshotMeta storedLog={storedLog} traceCount={traces.length} />
        </header>

        {response && (
          <LogResultSummary
            response={response}
            approvalCancelled={storedSession?.approvalCancelled === true}
          />
        )}

        <section className="relay-panel overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Filter className="h-4 w-4 text-emerald-500" />
                Filter by agent
              </div>
              <div className="flex flex-wrap gap-2">
                {AGENT_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5',
                      activeFilter === filter.value
                        ? agentFilterActiveClasses(filter.value)
                        : 'border-border bg-background/40 text-zinc-500 hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-[30rem] overflow-hidden bg-background/80 sm:h-[34rem]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border bg-background/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500/80" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                    <div className="h-3 w-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="ml-2 font-mono text-xs text-zinc-500">relay/logs</span>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  {filteredTraces.length}/{traces.length} entries
                </span>
              </div>

              <div className="terminal-scroll flex-1 overflow-y-auto overscroll-contain p-4 font-mono text-sm">
                {filteredTraces.length > 0 ? (
                  <div className="space-y-3">
                    {filteredTraces.map((trace, i) => (
                      <LogEntry
                        key={`${trace.timestamp}-${i}`}
                        trace={trace}
                        index={i}
                        initialOpen={highlightTimestamp === String(trace.timestamp)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyLogs hasAnyLogs={traces.length > 0} />
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      {showFloatingPanel && storedSession?.response && (
        <ExecutionFloatingPanel
          approvalCancelled={storedSession.approvalCancelled}
          collapsed={storedSession.resultPanelCollapsed}
          isApproving={isApproving}
          onApprove={approveExecution}
          onCancel={cancelApproval}
          onDismiss={dismissFloatingPanel}
          onToggleCollapsed={toggleFloatingPanel}
          requestContext={storedSession.requestContext}
          response={storedSession.response}
        />
      )}
    </div>
  );
}

async function getExecutionErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;
    if (isRecord(payload) && typeof payload.error === 'string') {
      return payload.error;
    }
  } catch {
    // Fall through to the status-code message.
  }

  return `Execution failed (${response.status})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function loadCurrentExecutionLog(session = loadExecutionSession()): StoredExecutionLog | null {
  // If there's no active session, show nothing
  // This prevents showing stale/old execution data
  if (!session) {
    return null;
  }

  // Priority 1: If session has a complete response, use it (most authoritative)
  if (session.response) {
    // Use visibleTraces from session as they're more up-to-date than response.trace
    const syncedResponse = {
      ...session.response,
      trace: session.visibleTraces.length > 0 ? session.visibleTraces : session.response.trace,
    };
    return {
      response: syncedResponse,
      savedAt: session.savedAt,
    };
  }

  // Priority 2: If we have a session with partial traces (execution in progress or stopped)
  if (session.visibleTraces.length > 0) {
    return {
      response: {
        sessionId: session.sessionId,
        intent: session.intent,
        trace: session.visibleTraces,
        summary: {
          selectedProtocol: '',
          initialProtocol: '',
          finalProtocol: '',
          wasRetried: false,
          totalSteps: session.visibleTraces.length,
          confidence: 0,
          explanation: 'Execution in progress or interrupted.',
          decisionImpact: { ens: '', axl: '', memory: '' },
        },
        final_result: {
          protocol: '',
          apy: '',
          action: '',
          status: 'failed',
        },
      },
      savedAt: session.savedAt,
    };
  }

  // Priority 3: Session exists but has no traces yet (just started)
  // Show empty state
  return null;
}

function LogResultSummary({
  approvalCancelled,
  response,
}: {
  approvalCancelled: boolean;
  response: ExecutionResponse;
}) {
  const status =
    response.final_result.status === 'pending_approval'
      ? approvalCancelled
        ? 'cancelled'
        : 'awaiting approval'
      : response.final_result.status;

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <ResultTile label="Status" value={status} tone={status === 'success' ? 'emerald' : 'cyan'} />
      <ResultTile
        label="Protocol"
        value={response.summary.finalProtocol || response.final_result.protocol || 'n/a'}
      />
      <ResultTile label="APY" value={formatApy(response.final_result.apy)} tone="emerald" />
    </section>
  );
}

function ResultTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'emerald' | 'cyan';
}) {
  const toneClass = {
    neutral: 'text-foreground',
    emerald: 'text-emerald-500',
    cyan: 'text-cyan-500',
  }[tone];

  return (
    <div className="relay-card p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={cn('mt-1 truncate font-mono text-sm font-semibold', toneClass)}>{value}</div>
    </div>
  );
}

function LogSnapshotMeta({
  storedLog,
  traceCount,
}: {
  storedLog: StoredExecutionLog | null;
  traceCount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-72">
      <div className="relay-card p-3">
        <div className="mb-1 flex items-center gap-1.5 text-zinc-500">
          <Clock className="h-3.5 w-3.5" />
          Captured
        </div>
        <div className="font-mono text-foreground">
          {storedLog ? new Date(storedLog.savedAt).toLocaleTimeString() : 'n/a'}
        </div>
      </div>
      <div className="relay-card p-3">
        <div className="mb-1 flex items-center gap-1.5 text-zinc-500">
          <Database className="h-3.5 w-3.5" />
          Entries
        </div>
        <div className="font-mono text-foreground">{traceCount}</div>
      </div>
    </div>
  );
}

function LogEntry({
  trace,
  index,
  initialOpen,
}: {
  trace: AgentTrace;
  index: number;
  initialOpen?: boolean;
}) {
  const agent = normalizeAgentName(trace.agent);

  return (
    <motion.article
      id={`trace-${trace.timestamp}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.2) }}
      className={cn('relay-card p-3', agentBorderClass(agent, trace.message))}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">
            [{new Date(trace.timestamp).toISOString().split('T')[1].slice(0, -1)}]
          </span>
          <span
            className={cn(
              'rounded border px-2 py-0.5 text-xs font-semibold',
              agentBadgeClass(agent, trace.message)
            )}
          >
            {agent}
          </span>
          <span className="rounded border border-border bg-accent/40 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {trace.step || 'unknown'}
          </span>
        </div>
        <span className="text-xs text-zinc-500">#{index + 1}</span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {trace.message || 'No message provided.'}
      </p>

      <details
        open={initialOpen}
        className={cn(
          'mt-3 rounded-md border border-border bg-black/[0.03] transition-all dark:bg-white/[0.03]',
          initialOpen && 'border-emerald-500/30 bg-emerald-500/5 ring-1 ring-emerald-500/20'
        )}
      >
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:text-foreground">
          metadata / details
        </summary>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap border-t border-border p-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {formatMetadata(trace.metadata)}
        </pre>
      </details>
    </motion.article>
  );
}

function EmptyLogs({ hasAnyLogs }: { hasAnyLogs: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-zinc-500">
      <Activity className="mb-4 h-10 w-10 text-zinc-400" />
      <h2 className="text-base font-semibold text-foreground">
        {hasAnyLogs ? 'No logs match this filter' : 'No execution logs yet'}
      </h2>
      <p className="mt-2 max-w-md text-sm">
        {hasAnyLogs
          ? 'Choose a different agent filter to inspect the captured trace.'
          : 'Run an execution from the dashboard, then return here to inspect the full backend trace.'}
      </p>
      {!hasAnyLogs && (
        <Link href="/dashboard" className="relay-button-primary mt-5">
          Open Dashboard
        </Link>
      )}
    </div>
  );
}

function formatMetadata(metadata?: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return '{}';

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function agentBadgeClass(agent: string, message?: string) {
  if (agent === 'system.relay.eth')
    return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300';
  if (agent === 'yield.relay.eth')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (agent === 'risk.relay.eth') {
    if (message) {
      const msg = message.toLowerCase();
      if (msg.includes('reject') || msg.includes('fail') || msg.includes('high risk')) {
        return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300';
      } else if (msg.includes('medium risk') || msg.includes('weak') || msg.includes('approaching')) {
        return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300';
      }
    }
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (agent === 'executor.relay.eth')
    return 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300';
  return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300';
}

function agentBorderClass(agent: string, message?: string) {
  if (agent === 'system.relay.eth') return 'border-indigo-500/20';
  if (agent === 'yield.relay.eth') return 'border-emerald-500/20';
  if (agent === 'risk.relay.eth') {
    if (message) {
      const msg = message.toLowerCase();
      if (msg.includes('reject') || msg.includes('fail') || msg.includes('high risk')) {
        return 'border-red-500/20';
      } else if (msg.includes('medium risk') || msg.includes('weak') || msg.includes('approaching')) {
        return 'border-yellow-500/20';
      }
    }
    return 'border-amber-500/20';
  }
  if (agent === 'executor.relay.eth') return 'border-fuchsia-500/20';
  return 'border-border';
}

function agentFilterActiveClasses(agent: string) {
  if (agent === 'all') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (agent === 'system.relay.eth') return 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300';
  if (agent === 'yield.relay.eth') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (agent === 'risk.relay.eth') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (agent === 'executor.relay.eth') return 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300';
  return 'border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300';
}
