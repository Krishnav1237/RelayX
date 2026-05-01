"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Layers, Network, Shield, Terminal, Zap } from "lucide-react";
import { AppBackground } from "@/components/app-background";
import { Navbar } from "@/components/navbar";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export default function Home() {
  return (
    <div className="relay-page">
      <AppBackground variant="landing" />
      <Navbar />

      <main className="relay-container flex flex-1 flex-col pt-28 sm:pt-32">
        <section id="intro" className="grid scroll-mt-28 items-center gap-10 pb-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="relay-eyebrow"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              RelayX Protocol
            </motion.div>

            <motion.h1
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.06, ease: "easeOut" }}
              className="mt-6 max-w-4xl text-4xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
            >
              Intent-driven DeFi execution with human approval.
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.14, ease: "easeOut" }}
              className="relay-muted mt-6 max-w-2xl text-base leading-7 sm:text-lg"
            >
              RelayX turns a financial goal into an agent-reviewed strategy, exposes the
              decision trail, and waits for approval before execution.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.22, ease: "easeOut" }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link href="/dashboard" className="relay-button-primary">
                Launch Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/logs" className="relay-button-secondary">
                View Logs
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: "easeOut" }}
            className="relay-panel overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-border bg-background/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="font-mono text-xs text-zinc-500">relay/preview</span>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <div className="mb-2 font-mono text-xs text-zinc-500">User Intent</div>
                <p className="text-sm font-medium text-foreground">
                  &quot;Find the safest yield for 1000 USDC&quot;
                </p>
              </div>

              <div className="grid gap-3">
                <AgentPreview icon={<Terminal />} agent="system.relay.eth" status="Analyzing" tone="cyan" />
                <AgentPreview icon={<Zap />} agent="yield.relay.eth" status="4.2% APY" tone="emerald" />
                <AgentPreview icon={<Shield />} agent="risk.relay.eth" status="Approved" tone="teal" />
                <AgentPreview icon={<Layers />} agent="executor.relay.eth" status="Awaiting approval" tone="cyan" />
              </div>
            </div>
          </motion.div>
        </section>

        <SectionDivider />

        <section id="capabilities" className="scroll-mt-28 py-20">
          <div className="mb-10 max-w-2xl">
            <div className="relay-eyebrow">Capabilities</div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">What RelayX can do</h2>
            <p className="relay-muted mt-3 leading-7">
              Convert high-level financial goals into comparable, risk-aware DeFi strategies.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FeatureCard
              icon={<Terminal className="h-5 w-5" />}
              agent="Yield Strategy"
              title="Find optimal yield"
              description="Identifies yield opportunities for crypto assets across supported DeFi protocols."
              delay={0}
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              agent="Protocol Review"
              title="Analyze protocol risk"
              description="Evaluates protocol safety signals before a strategy reaches execution."
              delay={0.08}
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              agent="Strategy Filtering"
              title="Compare and filter options"
              description="Ranks candidate protocols and removes unsafe or low-confidence paths."
              delay={0.16}
            />
            <FeatureCard
              icon={<Network className="h-5 w-5" />}
              agent="Decision Support"
              title="Explain and execute"
              description="Shows why a strategy was selected, then simulates or executes after approval."
              delay={0.24}
            />
          </div>
        </section>

        <SectionDivider />

        <section id="workflow" className="scroll-mt-28 py-20">
          <div className="mb-10 max-w-2xl">
            <div className="relay-eyebrow">Agent Workflow</div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Transparent from intent to execution</h2>
            <p className="relay-muted mt-3 leading-7">
              The same agent identities appear across the dashboard, approval panel, and logs page.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <WorkflowStep number="01" agent="Submit a natural language goal with asset and risk preferences." title="Intent input" />
            <WorkflowStep number="02" agent="Scan supported protocols and estimate viable yield paths." title="Yield analysis" />
            <WorkflowStep number="03" agent="Evaluate safety constraints and filter unsuitable strategies." title="Risk evaluation" />
            <WorkflowStep number="04" agent="Prepare the final action and wait for explicit user approval." title="Execution approval" />
            <WorkflowStep number="05" agent="Return the selected strategy, confidence, and decision rationale." title="Decision summary" />
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border bg-background/70 px-6 py-8 text-center text-sm text-zinc-500 backdrop-blur">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-500" />
          <span className="font-mono font-bold text-foreground">RelayX</span>
        </div>
        <p>&copy; {new Date().getFullYear()} RelayX Protocol. Autonomous execution layer.</p>
      </footer>
    </div>
  );
}

function AgentPreview({
  icon,
  agent,
  status,
  tone,
}: {
  icon: ReactNode;
  agent: string;
  status: string;
  tone: "cyan" | "emerald" | "teal";
}) {
  const toneClass = {
    cyan: "border-cyan-500/25 text-cyan-600 dark:text-cyan-300",
    emerald: "border-emerald-500/25 text-emerald-600 dark:text-emerald-300",
    teal: "border-teal-500/25 text-teal-600 dark:text-teal-300",
  }[tone];

  return (
    <div className="relay-card flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background/80 ${toneClass}`}>
          {icon}
        </div>
        <span className="truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">{agent}</span>
      </div>
      <span className="shrink-0 rounded-full border border-border bg-accent/50 px-2 py-1 font-mono text-[11px] text-zinc-500">
        {status}
      </span>
    </div>
  );
}

function FeatureCard({
  icon,
  agent,
  title,
  description,
  delay,
}: {
  icon: ReactNode;
  agent: string;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay }}
      className="relay-card p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-cyan-600 dark:text-cyan-300">{agent}</p>
          <h3 className="mt-1 text-lg font-semibold">{title}</h3>
        </div>
      </div>
      <p className="relay-muted text-sm leading-6">{description}</p>
    </motion.article>
  );
}

function WorkflowStep({ number, agent, title }: { number: string; agent: string; title: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
      className="relay-card flex items-center gap-4 p-4"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 font-mono text-xs font-bold text-cyan-600 dark:text-cyan-300">
        {number}
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 truncate font-mono text-xs text-zinc-500">{agent}</p>
      </div>
    </motion.article>
  );
}

function SectionDivider() {
  return (
    <div className="relative h-px w-full">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent" />
      <div className="absolute left-1/2 top-0 h-12 w-1/2 -translate-x-1/2 -translate-y-1/2 bg-cyan-500/5 blur-2xl" />
    </div>
  );
}
