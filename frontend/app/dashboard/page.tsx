"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Loader2, CheckCircle2, AlertTriangle, Play, Shield, Zap, Layers, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";

// Types matching backend response
interface AgentTrace {
  agent: string;
  step: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

interface ExecutionResult {
  protocol: string;
  apy: string;
  action: string;
  status: 'success' | 'failed';
  attempt?: number;
}

interface ExecutionSummary {
  selectedProtocol: string;
  initialProtocol: string;
  finalProtocol: string;
  wasRetried: boolean;
  reasonForRetry?: string;
  totalSteps: number;
  confidence: number;
  explanation: string;
}

interface ExecutionResponse {
  intent: string;
  trace: AgentTrace[];
  final_result: ExecutionResult;
  summary: ExecutionSummary;
  debug?: Record<string, unknown>;
}

// Dynamic Background Component
const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/10 via-background to-background dark:from-emerald-900/20"></div>
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.2)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_100%_100%_at_50%_0%,#000_80%,transparent_100%)]"></div>

      {/* Floating Orbs for Whitespace Filling */}
      <motion.div
        animate={{ y: [0, -60, 0], x: [0, 40, 0], scale: [1, 1.2, 1], opacity: [0.1, 0.4, 0.1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-[120px]"
      />
      <motion.div
        animate={{ y: [0, 60, 0], x: [0, -50, 0], scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-1/4 right-1/4 w-[45rem] h-[45rem] bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-[150px]"
      />
    </div>
  );
};

export default function Dashboard() {
  const terminalScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [intent, setIntent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<ExecutionResponse | null>(null);
  
  // For simulated streaming
  const [visibleTraces, setVisibleTraces] = useState<AgentTrace[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const isNearBottom = (element: HTMLDivElement) => {
    const threshold = 72;
    return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
  };

  const handleTerminalScroll = (event: React.UIEvent<HTMLDivElement>) => {
    shouldAutoScrollRef.current = isNearBottom(event.currentTarget);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent.trim() || isSubmitting) return;

    shouldAutoScrollRef.current = true;
    setIsSubmitting(true);
    setResponse(null);
    setVisibleTraces([]);
    setShowSummary(false);

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });

      if (!res.ok) {
        throw new Error("Execution failed");
      }

      const data: ExecutionResponse = await res.json();
      setResponse(data);
      setIsStreaming(true);
    } catch (error) {
      console.error(error);
      alert("An error occurred during execution.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simulate streaming traces
  useEffect(() => {
    if (!isStreaming || !response) return;

    let index = 0;
    const interval = setInterval(() => {
      if (index < response.trace.length) {
        setVisibleTraces((prev) => [...prev, response.trace[index]]);
        index++;
      } else {
        clearInterval(interval);
        setIsStreaming(false);
        setTimeout(() => setShowSummary(true), 500); // Show summary after slight delay
      }
    }, 800); // 800ms delay per trace to simulate real-time

    return () => clearInterval(interval);
  }, [isStreaming, response]);

  useEffect(() => {
    const terminal = terminalScrollRef.current;
    if (!terminal || !shouldAutoScrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      terminal.scrollTo({
        top: terminal.scrollHeight,
        behavior: visibleTraces.length > 1 ? "smooth" : "auto",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [visibleTraces.length, isStreaming, isSubmitting]);

  return (
    <div className="flex flex-col min-h-screen font-sans relative">
      <AnimatedBackground />
      <Navbar />
      
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 flex flex-col gap-8 relative z-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Execution Engine</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">Enter your financial intent. The orchestrator will handle the rest.</p>
        </header>

        {/* Input Area */}
        <div className="bg-card border border-border rounded-xl p-2 shadow-sm">
          <form onSubmit={handleSubmit} className="flex gap-2 relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
              <Terminal className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g. Find the safest yield for 1000 USDC"
              className="flex-1 bg-transparent border-none py-4 pl-12 pr-4 text-foreground focus:outline-none focus:ring-0 placeholder:text-zinc-500"
              disabled={isSubmitting || isStreaming}
            />
            <button
              type="submit"
              disabled={!intent.trim() || isSubmitting || isStreaming}
              className="m-1 inline-flex items-center justify-center rounded-lg bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Execute"}
            </button>
          </form>
        </div>

        {/* Dashboard Content */}
        <div className="grid lg:grid-cols-3 gap-6 flex-1">
          {/* Main Visualization Terminal */}
          <div className="lg:col-span-2 h-[28rem] sm:h-[32rem] lg:h-[36rem] bg-white dark:bg-[#0a0a0a] border border-border rounded-xl overflow-hidden shadow-xl flex flex-col relative z-10">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="ml-2 font-mono text-xs text-zinc-500">relay/orchestrator</span>
              </div>
              {(isStreaming || isSubmitting) && (
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
            
            <div
              ref={terminalScrollRef}
              onScroll={handleTerminalScroll}
              className="terminal-scroll flex-1 overflow-y-auto overscroll-contain p-4 font-mono text-sm space-y-4 scroll-smooth"
            >
              {!response && !isSubmitting && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
                  <Terminal className="h-12 w-12 mb-4 opacity-50" />
                  <p>Awaiting intent...</p>
                </div>
              )}

              <AnimatePresence>
                {visibleTraces.map((trace, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-1 text-zinc-700 dark:text-zinc-300"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 dark:text-zinc-500">[{new Date(trace.timestamp).toISOString().split('T')[1].slice(0, -1)}]</span>
                      <AgentBadge agent={trace.agent} />
                      <span className="text-emerald-600 dark:text-emerald-400">[{trace.step}]</span>
                    </div>
                    <div className="pl-[100px] text-zinc-600 dark:text-zinc-400">
                      {trace.message}
                    </div>
                    {trace.metadata && Object.keys(trace.metadata).length > 0 && (
                      <div className="pl-[100px] mt-1 text-xs text-zinc-500 dark:text-zinc-600">
                        {JSON.stringify(trace.metadata)}
                      </div>
                    )}
                  </motion.div>
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
            {/* Active Agents Overview */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" />
                Network Agents
              </h3>
              <div className="space-y-3">
                <AgentStatusItem agent="system.relay.eth" icon={<Play className="h-4 w-4" />} active={isStreaming} />
                <AgentStatusItem agent="yield.agent" icon={<Zap className="h-4 w-4 text-yellow-500" />} active={isStreaming && visibleTraces.some(t => t.agent === 'yield.agent')} />
                <AgentStatusItem agent="risk.agent" icon={<Shield className="h-4 w-4 text-green-500" />} active={isStreaming && visibleTraces.some(t => t.agent === 'risk.agent')} />
                <AgentStatusItem agent="executor.agent" icon={<Terminal className="h-4 w-4 text-purple-500" />} active={isStreaming && visibleTraces.some(t => t.agent === 'executor.agent')} />
              </div>
            </div>

            {/* Final Execution Summary */}
            <AnimatePresence>
              {showSummary && response?.summary && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="bg-card border border-green-500/30 rounded-xl overflow-hidden shadow-lg relative"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <h3 className="font-semibold text-lg">Execution Complete</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-border">
                        <span className="text-zinc-500 text-sm">Target Protocol</span>
                        <span className="font-medium">{response.summary.finalProtocol}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-border">
                        <span className="text-zinc-500 text-sm">Estimated APY</span>
                        <span className="font-mono text-green-500 font-medium">{response.final_result.apy}%</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-border">
                        <span className="text-zinc-500 text-sm">Confidence</span>
                        <span className="font-mono text-blue-500 font-medium">{(response.summary.confidence * 100).toFixed(0)}%</span>
                      </div>
                      
                      <div className="pt-2 bg-accent/30 rounded p-3 text-sm text-zinc-600 dark:text-zinc-400 border border-border">
                        {response.summary.explanation}
                      </div>

                      {response.summary.wasRetried && (
                        <div className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-500 bg-yellow-500/10 p-2 rounded">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>Pivoted from {response.summary.initialProtocol} due to risk constraints.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function AgentBadge({ agent }: { agent: string }) {
  let colorClass = "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-transparent";
  
  if (agent === "system.relay.eth") colorClass = "bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/30";
  if (agent === "yield.agent") colorClass = "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30";
  if (agent === "risk.agent") colorClass = "bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/30";
  if (agent === "executor.agent") colorClass = "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30";

  return (
    <span className={cn("px-2 py-0.5 rounded text-xs border font-medium", colorClass)}>
      {agent}
    </span>
  );
}

function AgentStatusItem({ agent, icon, active }: { agent: string, icon: React.ReactNode, active: boolean }) {
  return (
    <div className={cn("flex items-center justify-between p-2 rounded-lg border transition-colors", active ? "border-foreground/20 bg-accent/50" : "border-transparent")}>
      <div className="flex items-center gap-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", active ? "bg-background shadow-sm" : "bg-transparent text-zinc-500")}>
          {icon}
        </div>
        <span className={cn("text-sm font-medium", !active && "text-zinc-500")}>{agent}</span>
      </div>
      {active && <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>}
    </div>
  );
}
