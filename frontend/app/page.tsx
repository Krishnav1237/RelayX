"use client";

import { motion } from "framer-motion";
import { ArrowRight, Terminal, Shield, Zap, Layers, Network, Lock } from "lucide-react";
import { Navbar } from "@/components/navbar";
import Link from "next/link";

// Dynamic Background Component
const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/10 via-background to-background dark:from-emerald-900/20"></div>
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.2)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_100%_100%_at_50%_0%,#000_80%,transparent_100%)]"></div>

      {/* Floating Orbs for Whitespace Filling */}
      <motion.div
        animate={{
          y: [0, -60, 0],
          x: [0, 40, 0],
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.4, 0.1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-[120px]"
      />
      <motion.div
        animate={{
          y: [0, 60, 0],
          x: [0, -50, 0],
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.3, 0.1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-1/4 right-1/4 w-[45rem] h-[45rem] bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-[150px]"
      />
      <motion.div
        animate={{
          y: [0, 40, 0],
          x: [0, 30, 0],
          scale: [1, 1.1, 1],
          opacity: [0.05, 0.2, 0.05],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute top-1/3 right-1/3 w-[30rem] h-[30rem] bg-teal-500/10 dark:bg-teal-500/20 rounded-full blur-[100px]"
      />

      {/* Network lines simulation (SVG) */}
      <svg className="absolute inset-0 w-full h-full opacity-30 dark:opacity-40">
        <motion.path
          d="M-100 200 Q 300 50, 700 300 T 1500 200"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-emerald-500"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={{ duration: 8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
        <motion.path
          d="M-100 500 Q 400 300, 800 600 T 1500 500"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-cyan-500"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.4 }}
          transition={{ duration: 10, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 1 }}
        />
      </svg>
      
      {/* Floating Web3 Nodes */}
      <FloatingNode icon={<Layers size={28} />} x="10%" y="20%" delay={0} duration={8} />
      <FloatingNode icon={<Network size={28} />} x="85%" y="25%" delay={2} duration={10} />
      <FloatingNode icon={<Lock size={28} />} x="75%" y="65%" delay={4} duration={9} />
      <FloatingNode icon={<Zap size={28} />} x="15%" y="70%" delay={1} duration={11} />
      <FloatingNode icon={<Terminal size={28} />} x="50%" y="15%" delay={3} duration={12} />
      <FloatingNode icon={<Shield size={28} />} x="90%" y="50%" delay={5} duration={14} />
    </div>
  );
};

type FloatingNodeProps = {
  icon: React.ReactNode;
  x: string;
  y: string;
  delay: number;
  duration: number;
};

const FloatingNode = ({ icon, x, y, delay, duration }: FloatingNodeProps) => (
  <motion.div
    initial={{ left: x, top: y, opacity: 0 }}
    animate={{ 
      top: [`calc(${y} - 25px)`, `calc(${y} + 25px)`, `calc(${y} - 25px)`],
      opacity: [0.5, 1, 0.5] 
    }}
    transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
    className="absolute hidden md:flex items-center justify-center w-16 h-16 rounded-2xl bg-white/90 dark:bg-black/90 backdrop-blur-md border border-zinc-300 dark:border-zinc-700 shadow-xl shadow-emerald-500/20 text-emerald-600 dark:text-emerald-400"
  >
    {icon}
  </motion.div>
);

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen font-sans selection:bg-emerald-500/30 relative">
      <AnimatedBackground />
      <Navbar />
      
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-20 flex flex-col items-center mt-14 relative z-10">
        {/* Hero Section */}
        <section className="w-full pt-16 pb-24 flex flex-col items-center text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 backdrop-blur-md mb-8 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
            RelayX Protocol
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-balance max-w-5xl leading-tight"
          >
            The intent-centric <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 via-cyan-500 to-teal-500 dark:from-emerald-400 dark:via-cyan-400 dark:to-teal-400">execution layer</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-8 text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl text-balance leading-relaxed"
          >
            Express your financial intent. Our multi-agent neural network autonomously discovers yields, evaluates smart contract risk, and executes on-chain seamlessly.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-12 flex flex-col sm:flex-row gap-6 items-center"
          >
            <Link href="/dashboard" className="group relative inline-flex h-14 items-center justify-center rounded-xl bg-foreground px-8 text-base font-medium text-background transition-all hover:bg-foreground/90 hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.1)] dark:shadow-[0_0_40px_rgba(255,255,255,0.05)] overflow-hidden">
              <span className="relative z-10 flex items-center">
                Launch Dashboard
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </motion.div>
        </section>

        {/* Conceptual Visualizer */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="w-full max-w-4xl relative z-10 mb-32"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl -z-10"></div>
          <div className="rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-black/60 backdrop-blur-xl p-1.5 shadow-2xl dark:shadow-[0_0_50px_rgba(16,185,129,0.1)]">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-900 bg-zinc-50/90 dark:bg-zinc-950/90 p-6 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 space-y-4 w-full md:w-auto">
                <div className="font-mono text-sm text-zinc-500 mb-2">User Intent</div>
                <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium shadow-sm">
                  &quot;Find the safest yield for 1000 USDC&quot;
                </div>
              </div>
              <div className="text-zinc-400 dark:text-zinc-600 hidden md:block">
                <ArrowRight size={24} className="animate-pulse" />
              </div>
              <div className="flex-1 space-y-4 w-full">
                <div className="font-mono text-sm text-zinc-500 mb-2 text-left md:text-right">Autonomous Resolution</div>
                <div className="space-y-2">
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-sm flex items-center justify-between shadow-sm">
                    <span className="flex items-center gap-2"><Terminal size={14} /> system.relay.eth</span>
                    <span className="font-mono text-xs opacity-80">Orchestrating</span>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center justify-between shadow-sm">
                    <span className="flex items-center gap-2"><Zap size={14} /> yield.agent</span>
                    <span className="font-mono text-xs opacity-80">Aave v3 (4.2%)</span>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 border border-teal-200 dark:border-teal-500/20 text-teal-600 dark:text-teal-400 text-sm flex items-center justify-between shadow-sm">
                    <span className="flex items-center gap-2"><Shield size={14} /> risk.agent</span>
                    <span className="font-mono text-xs opacity-80">Approved</span>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center justify-between shadow-sm">
                    <span className="flex items-center gap-2"><Layers size={14} /> executor.agent</span>
                    <span className="font-mono text-xs opacity-80">Executing TX</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Features / Capabilities */}
        <section id="features" className="w-full py-24 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Unprecedented DeFi capabilities</h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto text-lg">Stop interacting with fragmented protocols. Talk to an intelligent network that acts on your behalf.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Terminal className="h-6 w-6 text-foreground" />}
              title="Intent Translation"
              description="Simply state your financial goal. RelayX parses natural language into precise, parameter-driven on-chain execution requests."
              delay={0.1}
            />
            <FeatureCard 
              icon={<Zap className="h-6 w-6 text-foreground" />}
              title="Dynamic Yield Discovery"
              description="Continuous scanning of liquidity pools, lending protocols, and staking contracts to secure the most optimized returns."
              delay={0.2}
            />
            <FeatureCard 
              icon={<Shield className="h-6 w-6 text-foreground" />}
              title="Automated Risk Guardrails"
              description="Every strategy is subjected to real-time risk evaluation. High-risk protocols are rejected, forcing fallback selections."
              delay={0.3}
            />
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="w-full py-24 relative z-10 border-t border-zinc-200 dark:border-zinc-200/10">
          <div className="max-w-3xl mx-auto">
            <div className="mb-12">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Multi-Agent Workflow</h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-lg">A synchronized architecture of specialized agents working in tandem.</p>
            </div>

            <div className="space-y-8">
              <WorkflowStep 
                number="01"
                agent="system.relay.eth"
                title="Orchestration"
                desc="Receives user intent, sanitizes input, and initializes the execution environment."
              />
              <WorkflowStep 
                number="02"
                agent="yield.agent"
                title="Strategy Formulation"
                desc="Queries the broader DeFi ecosystem to calculate projected APYs and selects the highest-yielding viable protocol."
              />
              <WorkflowStep 
                number="03"
                agent="risk.agent"
                title="Risk Constraint Review"
                desc="Analyzes the proposed strategy. If the protocol's risk score exceeds safe thresholds, it rejects the plan and forces the Yield Agent to pivot."
              />
              <WorkflowStep 
                number="04"
                agent="executor.agent"
                title="On-Chain Execution"
                desc="Takes the final approved plan, generates the required transaction payloads, and executes the deposit securely."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-200/10 w-full py-12 text-center text-sm text-zinc-500 relative z-10 bg-white/50 dark:bg-background/50 backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-70 dark:opacity-50">
          <Terminal size={16} />
          <span className="font-mono font-bold">RelayX</span>
        </div>
        <p>© {new Date().getFullYear()} RelayX Protocol. Autonomous execution layer.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-200/10 bg-white/80 dark:bg-zinc-900/20 backdrop-blur-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group shadow-sm dark:shadow-none"
    >
      <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-background border border-zinc-200 dark:border-zinc-200/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
        {description}
      </p>
    </motion.div>
  );
}

function WorkflowStep({ number, agent, title, desc }: { number: string, agent: string, title: string, desc: string }) {
  return (
    <div className="flex gap-6 group">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 font-mono text-sm font-bold group-hover:bg-emerald-500 group-hover:text-white transition-colors">
          {number}
        </div>
        <div className="w-px h-full bg-gradient-to-b from-emerald-500/30 to-transparent my-2 group-last:hidden"></div>
      </div>
      <div className="pb-8">
        <div className="inline-block px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 text-xs font-mono text-zinc-700 dark:text-zinc-400 mb-2">
          {agent}
        </div>
        <h4 className="text-xl font-semibold mb-2">{title}</h4>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
