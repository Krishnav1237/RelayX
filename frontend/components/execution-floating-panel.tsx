"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Shield,
  X,
} from "lucide-react";
import {
  formatApy,
  formatRatio,
  type DecisionImpact,
  type ExecutionDebug,
  type ExecutionRequestContext,
  type ExecutionResponse,
  type UniswapQuoteResult,
} from "@/lib/execution";
import { cn } from "@/lib/utils";

export function ExecutionFloatingPanel({
  approvalCancelled,
  collapsed,
  isApproving = false,
  onApprove,
  onCancel,
  onDismiss,
  onToggleCollapsed,
  requestContext,
  response,
}: {
  approvalCancelled: boolean;
  collapsed: boolean;
  isApproving?: boolean;
  onApprove?: () => void;
  onCancel?: () => void;
  onDismiss: () => void;
  onToggleCollapsed: () => void;
  requestContext: ExecutionRequestContext;
  response: ExecutionResponse;
}) {
  const isPendingApproval = response.final_result.status === "pending_approval" && response.approval !== undefined;
  const canAct = Boolean(onApprove && onCancel);
  const title = isPendingApproval
    ? approvalCancelled ? "Execution Cancelled" : "Review & Approve"
    : "Execution Complete";
  const statusLabel = isPendingApproval
    ? approvalCancelled ? "cancelled" : "approval required"
    : response.final_result.status;
  const statusColor = isPendingApproval
    ? approvalCancelled ? "from-yellow-500 via-orange-400 to-cyan-400" : "from-cyan-500 via-emerald-400 to-cyan-400"
    : "from-emerald-500 via-cyan-400 to-emerald-400";
  const icon = isPendingApproval
    ? <Shield className={cn("h-5 w-5", approvalCancelled ? "text-yellow-500" : "text-cyan-500")} />
    : <CheckCircle2 className="h-5 w-5 text-emerald-500" />;

  return (
    <div className="pointer-events-none fixed bottom-4 right-3 z-40 w-[min(24rem,calc(100vw-1.5rem))] sm:right-4">
      <AnimatePresence>
        <motion.section
          layout
          initial={{ opacity: 0, x: 28, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, x: 28, y: 12, scale: 0.96 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={cn(
            "pointer-events-auto overflow-hidden rounded-xl border bg-card/95 shadow-2xl backdrop-blur-xl",
            isPendingApproval
              ? approvalCancelled ? "border-yellow-500/30 shadow-yellow-500/10" : "border-cyan-500/30 shadow-cyan-500/10"
              : "border-emerald-500/30 shadow-emerald-500/10"
          )}
        >
          <div className={cn("h-1 bg-gradient-to-r", statusColor)} />
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
            aria-expanded={!collapsed}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {icon}
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{title}</h3>
                <p className="truncate font-mono text-[11px] text-zinc-500">
                  {response.summary.finalProtocol || response.final_result.protocol || "strategy"} · {formatApy(response.final_result.apy)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="rounded-full border border-border bg-background/60 px-2 py-1 font-mono text-[10px] text-zinc-500">
                {statusLabel}
              </span>
              {collapsed ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="max-h-[min(32rem,calc(100vh-8rem))] overflow-y-auto px-4 pb-4">
                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-3 gap-2">
                      <MetricTile label="Protocol" value={response.summary.finalProtocol || response.final_result.protocol} />
                      <MetricTile label="APY" value={formatApy(response.final_result.apy)} tone="emerald" />
                      <MetricTile label="Confidence" value={`${(response.summary.confidence * 100).toFixed(0)}%`} tone="cyan" />
                    </div>

                    <div className="rounded-lg border border-border bg-accent/30 p-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      {approvalCancelled
                        ? "The strategy was reviewed but not executed. You can run a new request at any time."
                        : response.summary.explanation}
                    </div>

                    <DecisionImpactSummary impact={response.summary.decisionImpact} />

                    {response.final_result.swap && (
                      <SwapSummary swap={response.final_result.swap} />
                    )}

                    {response.debug && (
                      <DebugContextPanel debug={response.debug} requestContext={requestContext} />
                    )}

                    {response.summary.wasRetried && (
                      <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Pivoted from {response.summary.initialProtocol} due to risk constraints.</span>
                      </div>
                    )}

                    {isPendingApproval && !approvalCancelled && canAct && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={onCancel}
                          disabled={isApproving}
                          className="relay-button-secondary"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={onApprove}
                          disabled={isApproving}
                          className="relay-button-primary"
                        >
                          {isApproving && <Loader2 className="h-4 w-4 animate-spin" />}
                          Approve & Execute
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={onDismiss}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

function MetricTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "emerald" | "cyan" }) {
  const toneClass = {
    neutral: "text-foreground",
    emerald: "text-emerald-500",
    cyan: "text-cyan-500",
  }[tone];

  return (
    <div className="min-w-0 rounded-lg border border-border bg-background/55 p-2 transition-colors hover:border-emerald-500/20 hover:bg-background/80">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={cn("mt-1 truncate font-mono text-xs font-semibold", toneClass)}>{value || "n/a"}</div>
    </div>
  );
}

function DecisionImpactSummary({ impact }: { impact: DecisionImpact }) {
  if (!impact.ens && !impact.axl) return null;

  return (
    <div className="rounded-lg border border-border bg-accent/30 p-3 text-xs text-zinc-600 dark:text-zinc-400">
      <div className="mb-2 font-semibold text-foreground">Decision Impact</div>
      {impact.ens && <SummaryLine label="ENS" value={impact.ens} />}
      {impact.axl && <SummaryLine label="AXL" value={impact.axl} />}
    </div>
  );
}

function SwapSummary({ swap }: { swap: UniswapQuoteResult }) {
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-700 dark:text-cyan-300">
      <div className="mb-2 font-semibold text-foreground">Uniswap Swap</div>
      <SummaryLine label="Route" value={swap.route || "n/a"} />
      <SummaryLine label="Amount out" value={swap.amountOut || "n/a"} />
      <SummaryLine label="Price impact" value={`${swap.priceImpact}%`} />
      <SummaryLine label="Gas estimate" value={swap.gasEstimate || "n/a"} />
      <SummaryLine label="Source" value={swap.source} />
    </div>
  );
}

function DebugContextPanel({
  debug,
  requestContext,
}: {
  debug: ExecutionDebug;
  requestContext: ExecutionRequestContext;
}) {
  const confidenceEntries = debug.confidenceBreakdown ? Object.entries(debug.confidenceBreakdown) : [];

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-700 dark:text-cyan-300">
      <div className="mb-2 flex items-center justify-between gap-2 font-semibold text-foreground">
        <span>Backend Debug</span>
        <span className="font-mono text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
          {formatRequestContext(requestContext)}
        </span>
      </div>
      <SummaryLine label="Attempts" value={debug.attempts !== undefined ? String(debug.attempts) : "n/a"} />
      <SummaryLine label="Initial" value={formatPlan(debug.initialSelection)} />
      <SummaryLine label="Approved" value={formatPlan(debug.finalApprovedPlan)} />
      <SummaryLine label="Risk decision" value={debug.riskDecision ?? "n/a"} />
      <SummaryLine label="ENS score" value={debug.ensReputationScore !== undefined ? debug.ensReputationScore.toFixed(2) : "n/a"} />
      {debug.ensInfluence && (
        <SummaryLine
          label="ENS influence"
          value={`${debug.ensInfluence.tier}, ${debug.ensInfluence.effect}`}
        />
      )}
      {debug.axlInfluence && (
        <SummaryLine
          label="AXL influence"
          value={`${debug.axlInfluence.decisionImpact}, ${formatRatio(debug.axlInfluence.approvalRatio)} approval`}
        />
      )}
      {confidenceEntries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {confidenceEntries.map(([label, value]) => (
            <span key={label} className="rounded border border-cyan-500/20 bg-background/60 px-2 py-1 font-mono">
              {label}: {formatRatio(value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function formatPlan(plan: ExecutionDebug["initialSelection"]): string {
  if (!plan?.protocol) return "n/a";
  return `${plan.protocol}${plan.apy !== undefined ? ` (${plan.apy}% APY)` : ""}`;
}

function formatRequestContext(context: ExecutionRequestContext): string {
  const flags: string[] = [];
  if (context.demo) flags.push("demo");
  if (context.debug) flags.push("debug");
  return flags.length > 0 ? flags.join(" + ") : "standard";
}
