'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, Clock, Database, Filter, Terminal } from 'lucide-react';
import { AppBackground } from '@/components/app-background';
import { ExecutionFloatingPanel } from '@/components/execution-floating-panel';
import { Navbar } from '@/components/navbar';
import {
  formatApy,
  loadExecutionLog,
  loadExecutionSession,
  normalizeAgentName,
  normalizeExecutionResponse,
  saveExecutionSession,
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
  const [storedLog, setStoredLog] = useState<StoredExecutionLog | null>(null);
  const [storedSession, setStoredSession] = useState<StoredExecutionSession | null>(null);
  const [activeFilter, setActiveFilter] = useState<AgentFilter>('all');
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    const refreshLog = () => {
      const session = loadExecutionSession();
      setStoredSession(session);
      setStoredLog(loadCurrentExecutionLog(session));
    };
    const timeout = window.setTimeout(refreshLog, 0);

    window.addEventListener('storage', refreshLog);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('storage', refreshLog);
    };
  }, []);

  const traces = useMemo(() => {
    const rawTraces = storedLog?.response.trace ?? [];
    return [...rawTraces].sort((a, b) => a.timestamp - b.timestamp);
  }, [storedLog]);

  const filteredTraces = useMemo(() => {
    if (activeFilter === 'all') return traces;
    return traces.filter((trace) => normalizeAgentName(trace.agent) === activeFilter);
  }, [activeFilter, traces]);

  const response = storedLog?.response ?? null;
  const showFloatingPanel = Boolean(storedSession?.response && !storedSession.resultPanelDismissed);

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
      const nextSession: StoredExecutionSession = {
        ...storedSession,
        response,
        visibleTraces: response.trace,
        streamQueue: [],
        isStreaming: false,
        showSummary: true,
        approvalCancelled: false,
        resultPanelCollapsed: false,
        resultPanelDismissed: false,
        savedAt: Date.now(),
      };

      setStoredSession(nextSession);
      setStoredLog({ response, savedAt: nextSession.savedAt });
      saveExecutionSession(nextSession);
    } catch (error) {
      console.error(error);
    } finally {
      setIsApproving(false);
    }
  };

  const cancelApproval = () => {
    if (!storedSession) return;

    const nextSession: StoredExecutionSession = {
      ...storedSession,
      showSummary: true,
      approvalCancelled: true,
      resultPanelCollapsed: false,
      resultPanelDismissed: false,
      savedAt: Date.now(),
    };

    setStoredSession(nextSession);
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
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
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
                    {filteredTraces.map((trace, index) => (
                      <LogEntry
                        trace={trace}
                        index={index}
                        key={`${trace.timestamp}-${trace.agent}-${trace.step}-${index}`}
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
  if (session?.response) {
    return {
      response: session.response,
      savedAt: session.savedAt,
    };
  }

  return loadExecutionLog();
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

function LogEntry({ trace, index }: { trace: AgentTrace; index: number }) {
  const agent = normalizeAgentName(trace.agent);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.2) }}
      className={cn('relay-card p-3', agentBorderClass(agent))}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">
            [{new Date(trace.timestamp).toISOString().split('T')[1].slice(0, -1)}]
          </span>
          <span
            className={cn(
              'rounded border px-2 py-0.5 text-xs font-semibold',
              agentBadgeClass(agent)
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

      <details className="mt-3 rounded-md border border-border bg-black/[0.03] dark:bg-white/[0.03]">
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

function agentBadgeClass(agent: string) {
  if (agent === 'system.relay.eth')
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300';
  if (agent === 'yield.relay.eth')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (agent === 'risk.relay.eth')
    return 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300';
  if (agent === 'executor.relay.eth')
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300';
}

function agentBorderClass(agent: string) {
  if (agent === 'system.relay.eth') return 'border-cyan-500/20';
  if (agent === 'yield.relay.eth') return 'border-emerald-500/20';
  if (agent === 'risk.relay.eth') return 'border-teal-500/20';
  if (agent === 'executor.relay.eth') return 'border-sky-500/20';
  return 'border-border';
}
