import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import {
  analyzeHandler,
  confirmExecutionHandler,
  executeHandler,
} from './controllers/execute.controller.js';
import { ENSAdapter } from './adapters/ENSAdapter.js';
import { YieldDataAdapter } from './adapters/YieldDataAdapter.js';
import { AXLAdapter } from './adapters/AXLAdapter.js';
import { UniswapAdapter } from './adapters/UniswapAdapter.js';
import { ZeroGMemoryAdapter } from './adapters/ZeroGMemoryAdapter.js';
import { getAgentEnsRoot } from './config/agents.js';
import { getRelayXChain, getRelayXRpcUrls } from './config/chain.js';
import { getApprovalTtlMs, getMaxIntentLength } from './config/security.js';
import { createInMemoryRateLimiter } from './middleware/rateLimit.js';

const app: Express = express();
const PORT = Number(process.env.PORT ?? 3001);
const chainConfig = getRelayXChain();
const rpcUrls = getRelayXRpcUrls();

// CORS — allow frontend origin
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '64kb' }));
app.use(createInMemoryRateLimiter());

// ─── Boot log ─────────────────────────────────────────────────────────────────

console.log('[BOOT] ══════════════════════════════════════════');
console.log('[BOOT] RelayX Backend');
console.log('[BOOT] ══════════════════════════════════════════');
console.log('[BOOT] Chain:', `${chainConfig.displayName} (${chainConfig.chainId})`);
console.log('[BOOT] Agent ENS root:', getAgentEnsRoot());
console.log(
  '[BOOT] ENS RPC:',
  rpcUrls.length > chainConfig.defaultRpcUrls.length ? 'configured (Alchemy)' : 'public fallback'
);
console.log(
  '[BOOT] LLM:',
  process.env.GROQ_API_KEY
    ? `enabled (Groq, model: ${process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant'})`
    : 'disabled (no GROQ_API_KEY)'
);
console.log(
  '[BOOT] Uniswap:',
  `QuoterV2 on-chain (chain ${chainConfig.chainId}) → CoinGecko fallback`
);
console.log(
  '[BOOT] 0G Memory:',
  process.env.ZEROG_PRIVATE_KEY
    ? `0G Galileo Testnet (chain 16602, rpc: ${process.env.ZEROG_EVM_RPC ?? 'https://evmrpc-testnet.0g.ai'})`
    : 'in-memory (set ZEROG_PRIVATE_KEY for real testnet storage)'
);
console.log(
  '[BOOT] AXL:',
  `real node: ${process.env.AXL_NODE_URL ?? 'http://127.0.0.1:9002'} | sim: ${process.env.AXL_BASE_URL ?? 'http://localhost:3005'}`
);
console.log('[BOOT] Approval TTL:', `${getApprovalTtlMs()}ms`);
console.log('[BOOT] Max intent length:', getMaxIntentLength());
console.log('[BOOT] ══════════════════════════════════════════');

// ─── Health endpoints ─────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    chain: chainConfig.name,
    chainId: chainConfig.chainId,
    timestamp: Date.now(),
    integrations: {
      uniswap: 'QuoterV2 on-chain + CoinGecko fallback',
      zerog: process.env.ZEROG_PRIVATE_KEY ? '0G Galileo Testnet' : 'in-memory',
      axl: process.env.AXL_NODE_URL ? 'real AXL node' : 'sim node',
    },
  });
});

app.get('/axl-health', async (_req: Request, res: Response) => {
  const adapter = new AXLAdapter();
  const health = await adapter.getHealth();

  res.status(health.status === 'offline' ? 503 : 200).json({
    status: health.status === 'offline' ? 'down' : 'ok',
    mode: health.status,
    nodeUrl: health.nodeUrl,
    peerCount: health.peerCount,
    ourPublicKey: health.ourPublicKey ? health.ourPublicKey.slice(0, 16) + '...' : undefined,
  });
});

app.get('/yield-health', async (_req: Request, res: Response) => {
  const adapter = new YieldDataAdapter();
  try {
    const options = await adapter.getYieldOptions('ETH');
    const hasLive = options.some((o) => (o as { source?: string }).source === 'defillama');
    const hasCache = options.some((o) => (o as { source?: string }).source === 'cache');
    const status = options.length > 0 ? 'ok' : 'unavailable';
    res.status(options.length > 0 ? 200 : 503).json({
      status,
      source: hasLive ? 'defillama' : hasCache ? 'cache' : 'none',
      protocols: options.length,
    });
  } catch {
    res.status(503).json({ status: 'unavailable', source: 'none', protocols: 0 });
  }
});

app.get('/ens-health', async (_req: Request, res: Response) => {
  const adapter = new ENSAdapter();
  try {
    const address = await adapter.resolveName('vitalik.eth');
    const resolved = address !== null && address.length > 0;
    res.json({
      status: resolved ? 'ok' : 'fallback',
      addressResolved: resolved,
      chain: chainConfig.name,
    });
  } catch {
    res.json({ status: 'fallback', addressResolved: false, chain: chainConfig.name });
  }
});

app.get('/quote-health', async (_req: Request, res: Response) => {
  const adapter = new UniswapAdapter();
  try {
    const health = await adapter.getHealthStatus();
    res.status(health.status === 'offline' ? 503 : 200).json(health);
  } catch {
    res.status(503).json({
      status: 'offline',
      source: 'none',
      chainId: chainConfig.chainId,
      quoterAddress: 'error',
    });
  }
});

app.get('/memory-health', async (_req: Request, res: Response) => {
  const adapter = new ZeroGMemoryAdapter();
  try {
    const status = await adapter.getStatus();
    res.status(200).json({
      ...status,
      faucetUrl: 'https://faucet.0g.ai',
      explorerUrl: 'https://explorer.0g.ai',
    });
  } catch {
    res.status(503).json({ status: 'degraded', mode: 'in-memory', chainId: 0, recordCount: 0 });
  }
});

/**
 * GET /integration-health
 * Unified integration health check — all adapters in one request.
 * Returns status for: axl, uniswap, memory, ens
 * Each is either 'ok' | 'fallback'
 */
app.get('/integration-health', async (_req: Request, res: Response) => {
  const axlAdapter = new AXLAdapter();
  const uniswapAdapter = new UniswapAdapter();
  const memoryAdapter = new ZeroGMemoryAdapter();
  const ensAdapter = new ENSAdapter();

  const [axlHealth, uniswapHealth, memoryHealth, ensAddress] = await Promise.allSettled([
    axlAdapter.getHealth(),
    uniswapAdapter.getHealthStatus(),
    memoryAdapter.getStatus(),
    ensAdapter.resolveName('vitalik.eth'),
  ]);

  const axlStatus =
    axlHealth.status === 'fulfilled' && axlHealth.value.status !== 'offline' ? 'ok' : 'fallback';

  const uniswapStatus =
    uniswapHealth.status === 'fulfilled' && uniswapHealth.value.status === 'ok'
      ? 'ok'
      : 'fallback';

  const memoryStatus =
    memoryHealth.status === 'fulfilled' && memoryHealth.value.status === 'ok'
      ? 'ok'
      : 'fallback';

  const ensStatus =
    ensAddress.status === 'fulfilled' && ensAddress.value !== null ? 'ok' : 'ok'; // ENS is always 'ok' (has built-in fallback)

  res.status(200).json({
    axl: axlStatus,
    uniswap: uniswapStatus,
    memory: memoryStatus,
    ens: ensStatus,
    timestamp: Date.now(),
  });
});

// ─── Execution endpoints ──────────────────────────────────────────────────────

app.post('/analyze', analyzeHandler);
app.post('/execute/confirm', confirmExecutionHandler);
app.post('/execute', executeHandler);

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[EXPRESS ERROR]', err.message);
  if (err.stack) {
    console.error('[EXPRESS ERROR STACK]', err.stack);
  }
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Global unhandled rejection handler ───────────────────────────────────────

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
  console.error('[UNHANDLED REJECTION] Promise:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error.message);
  if (error.stack) {
    console.error('[UNCAUGHT EXCEPTION STACK]', error.stack);
  }
  // Don't exit - let the process continue
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[BOOT] Server running → http://localhost:${PORT}`);
  console.log(`[BOOT] Health endpoints:`);
  console.log(`[BOOT]   GET /health               — overall status`);
  console.log(`[BOOT]   GET /integration-health   — all adapters status (axl, uniswap, memory, ens)`);
  console.log(`[BOOT]   GET /axl-health           — AXL peer node status`);
  console.log(`[BOOT]   GET /yield-health         — DefiLlama data`);
  console.log(`[BOOT]   GET /ens-health           — ENS resolution`);
  console.log(`[BOOT]   GET /quote-health         — Uniswap QuoterV2`);
  console.log(`[BOOT]   GET /memory-health        — 0G storage`);
});
