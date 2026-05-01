import express, { Express, Request, Response } from 'express';
import { executeHandler } from './controllers/execute.controller';
import { ENSAdapter } from './adapters/ENSAdapter';
import { YieldDataAdapter } from './adapters/YieldDataAdapter';

const app: Express = express();
const PORT = 3001;
const AXL_BASE_URL = process.env.AXL_BASE_URL ?? 'http://localhost:3005';
const AXL_NODES = [AXL_BASE_URL, 'http://localhost:3006', 'http://localhost:3007'];
const HEALTH_TIMEOUT_MS = 2000;

app.use(express.json());

// --- Boot log (Section 1) ---
console.log('[BOOT] ENS RPC:', process.env.ALCHEMY_MAINNET_RPC_URL ? 'configured' : 'not set (using public fallback)');
console.log('[BOOT] AXL base:', AXL_BASE_URL);
console.log('[BOOT] LLM:', process.env.OPENAI_API_KEY ? 'enabled' : 'disabled');
console.log('[BOOT] Uniswap API:', process.env.UNISWAP_API_KEY ? 'enabled' : 'disabled (CoinGecko quote fallback active)');
console.log('[BOOT] 0G memory:', process.env.ZEROG_MEMORY_KV_URL && process.env.ZEROG_MEMORY_LOG_URL ? 'enabled' : 'disabled');

// --- Health endpoints (Section 2) ---

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/axl-health', async (_req: Request, res: Response) => {
  let nodesReachable = 0;
  await Promise.all(AXL_NODES.map(async (node) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      const r = await fetch(`${node}/health`, { signal: controller.signal });
      if (r.ok) nodesReachable++;
    } catch { /* ignore */ }
    finally { clearTimeout(timeout); }
  }));
  const status = nodesReachable > 0 ? 'ok' : 'down';
  res.status(nodesReachable > 0 ? 200 : 503).json({ status, nodesReachable });
});

app.get('/yield-health', async (_req: Request, res: Response) => {
  const adapter = new YieldDataAdapter();
  try {
    const options = await adapter.getYieldOptions('ETH');
    const hasLive = options.some(o => o.source === 'defillama');
    const hasCache = options.some(o => o.source === 'cache');
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
    console.log(`[ENS] health check: ${resolved ? 'resolved' : 'fallback'}`);
    res.json({ status: resolved ? 'ok' : 'fallback', addressResolved: resolved });
  } catch {
    console.log('[ENS] health check: fallback neutral');
    res.json({ status: 'fallback', addressResolved: false });
  }
});

app.post('/execute', executeHandler);

app.listen(PORT, () => {
  console.log(`[BOOT] Server running on port ${PORT}`);
});
