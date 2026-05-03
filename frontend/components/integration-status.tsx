'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Wifi, WifiOff, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'down' | 'loading' | 'unknown';
  label: string;
  detail?: string;
  link?: string;
}

interface HealthData {
  axl: ServiceStatus;
  zerog: ServiceStatus;
  uniswap: ServiceStatus;
  yield: ServiceStatus;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';
const POLL_INTERVAL_MS = 30_000;

// ─── Status dot component ─────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceStatus['status'] }) {
  const colors: Record<ServiceStatus['status'], string> = {
    ok: 'bg-emerald-400 shadow-emerald-400/60',
    degraded: 'bg-yellow-400 shadow-yellow-400/60',
    down: 'bg-red-400 shadow-red-400/60',
    loading: 'bg-zinc-400 shadow-zinc-400/20',
    unknown: 'bg-zinc-500 shadow-zinc-500/20',
  };

  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full shadow-md ${colors[status]} ${
        status === 'ok' ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''
      }`}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntegrationStatus() {
  const [health, setHealth] = useState<HealthData>({
    axl: { status: 'loading', label: 'AXL' },
    zerog: { status: 'loading', label: '0G Storage' },
    uniswap: { status: 'loading', label: 'Uniswap' },
    yield: { status: 'loading', label: 'Yield' },
  });
  const [expanded, setExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    // Use unified /integration-health endpoint (single request)
    const integrationResult = await Promise.allSettled([
      fetch(`${API_BASE}/integration-health`, { signal: AbortSignal.timeout(6000) }).then((r) => r.json()),
    ]);

    const integrated = integrationResult[0];

    if (integrated.status === 'fulfilled') {
      const d = integrated.value as Record<string, string>;
      setHealth({
        axl: {
          status: d.axl === 'ok' ? 'ok' : 'degraded',
          label: 'AXL',
          detail: d.axl === 'ok' ? 'P2P mesh reachable' : 'no peers — local decision',
        },
        zerog: {
          status: d.memory === 'ok' ? 'ok' : 'degraded',
          label: '0G Storage',
          detail: d.memory === 'ok' ? 'Galileo chain 16602' : 'in-memory fallback',
          link: d.memory === 'ok' ? 'https://explorer.0g.ai' : undefined,
        },
        uniswap: {
          status: d.uniswap === 'ok' ? 'ok' : 'degraded',
          label: 'Uniswap',
          detail: d.uniswap === 'ok' ? 'QuoterV2 on-chain' : 'CoinGecko fallback',
        },
        yield: {
          status: d.ens === 'ok' ? 'ok' : 'degraded',
          label: 'ENS',
          detail: d.ens === 'ok' ? 'ENS resolving' : 'fallback',
        },
      });
    } else {
      // Full fallback — all degraded
      setHealth({
        axl: { status: 'down', label: 'AXL', detail: 'unreachable' },
        zerog: { status: 'down', label: '0G Storage', detail: 'unreachable' },
        uniswap: { status: 'down', label: 'Uniswap', detail: 'unreachable' },
        yield: { status: 'down', label: 'Yield', detail: 'unreachable' },
      });
    }

    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(fetchHealth, 0);
    const interval = setInterval(fetchHealth, POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchHealth]);

  const allOk = Object.values(health).every((s) => s.status === 'ok' || s.status === 'loading');
  const anyDown = Object.values(health).some((s) => s.status === 'down');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-health-dropdown]')) {
        setExpanded(false);
      }
    };

    if (expanded) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [expanded]);

  return (
    <div className="relative" data-health-dropdown>
      {/* Compact pill trigger */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 backdrop-blur-sm transition-all hover:border-border hover:bg-background/80"
        title="Integration health status"
      >
        {anyDown ? (
          <WifiOff className="h-3 w-3 text-red-400" />
        ) : allOk ? (
          <Activity className="h-3 w-3 text-emerald-400" />
        ) : (
          <Wifi className="h-3 w-3 text-yellow-400" />
        )}

        <span className="text-[10px] font-medium text-zinc-400">
          {anyDown ? 'Issues detected' : allOk ? 'All systems live' : 'Partial'}
        </span>

        <div className="flex gap-0.5">
          {Object.values(health).map((s, i) => (
            <StatusDot key={i} status={s.status} />
          ))}
        </div>

        {expanded ? (
          <ChevronUp className="h-3 w-3 text-zinc-500" />
        ) : (
          <ChevronDown className="h-3 w-3 text-zinc-500" />
        )}
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-background/95 p-3 shadow-2xl shadow-black/20 backdrop-blur-xl"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Integration Health</span>
              {lastChecked && (
                <span className="text-[9px] text-zinc-500">
                  {lastChecked.toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {/* AXL */}
              <ServiceRow
                name="Gensyn AXL"
                badge="P2P Mesh"
                service={health.axl}
                detail={health.axl.detail}
                docLink="https://github.com/gensyn-ai/axl"
              />

              {/* 0G */}
              <ServiceRow
                name="0G Galileo"
                badge="Chain 16602"
                service={health.zerog}
                detail={health.zerog.detail}
                docLink="https://explorer.0g.ai"
              />

              {/* Uniswap */}
              <ServiceRow
                name="Uniswap QuoterV2"
                badge="On-chain"
                service={health.uniswap}
                detail={health.uniswap.detail}
                docLink="https://app.uniswap.org"
              />

              {/* Yield */}
              <ServiceRow
                name="DefiLlama"
                badge="Yield Data"
                service={health.yield}
                detail={health.yield.detail}
                docLink="https://defillama.com"
              />
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center gap-3 border-t border-border pt-2">
              <LegendItem color="bg-emerald-400" label="live" />
              <LegendItem color="bg-yellow-400" label="fallback" />
              <LegendItem color="bg-red-400" label="offline" />
              <button
                onClick={fetchHealth}
                className="ml-auto text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Refresh
              </button>
            </div>

            {/* Testnet info */}
            <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2 text-[9px] text-cyan-600 dark:text-cyan-400">
              Testnets: Sepolia (Uniswap quotes) + 0G Galileo chain 16602 (storage, backend-only).
              Get 0G tokens at{' '}
              <a
                href="https://faucet.0g.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-cyan-300"
              >
                faucet.0g.ai
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Service row ───────────────────────────────────────────────────────────────

function ServiceRow({
  name,
  badge,
  service,
  detail,
  docLink,
}: {
  name: string;
  badge: string;
  service: ServiceStatus;
  detail?: string;
  docLink?: string;
}) {
  const statusText: Record<ServiceStatus['status'], string> = {
    ok: 'live',
    degraded: 'fallback',
    down: 'offline',
    loading: 'checking...',
    unknown: 'unknown',
  };

  const statusColor: Record<ServiceStatus['status'], string> = {
    ok: 'text-emerald-400',
    degraded: 'text-yellow-400',
    down: 'text-red-400',
    loading: 'text-zinc-500',
    unknown: 'text-zinc-500',
  };

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-accent/20 px-2.5 py-2">
      <div className="mt-0.5">
        {service.status === 'loading' ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-zinc-500" />
        ) : (
          <StatusDot status={service.status} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-foreground">{name}</span>
          <span className="rounded border border-border/40 px-1 text-[8px] text-zinc-500">
            {badge}
          </span>
          {docLink && (
            <a
              href={docLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-zinc-600 hover:text-zinc-400"
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
        <div className={`text-[10px] ${statusColor[service.status]}`}>
          {statusText[service.status]}
          {detail && <span className="ml-1 text-zinc-500">· {detail}</span>}
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="text-[9px] text-zinc-500">{label}</span>
    </div>
  );
}

// ─── Health parsers ───────────────────────────────────────────────────────────

