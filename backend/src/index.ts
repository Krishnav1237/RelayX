import express, { Express, Request, Response } from 'express';
import { executeHandler } from './controllers/execute.controller';
import { ENSAdapter } from './adapters/ENSAdapter';

const app: Express = express();
const PORT = 3001;
const AXL_BASE_URL = process.env.AXL_BASE_URL ?? 'http://localhost:3005';
const AXL_HEALTH_TIMEOUT_MS = 2000;

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

async function checkAXLHealth(): Promise<{
  status: 'ok' | 'error';
  axlBaseUrl: string;
  details?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AXL_HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${AXL_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: 'error',
        axlBaseUrl: AXL_BASE_URL,
        details: `AXL health returned HTTP ${response.status}`,
      };
    }

    return {
      status: 'ok',
      axlBaseUrl: AXL_BASE_URL,
    };
  } catch (error) {
    return {
      status: 'error',
      axlBaseUrl: AXL_BASE_URL,
      details: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/axl-health', async (_req: Request, res: Response) => {
  const result = await checkAXLHealth();
  const statusCode = result.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(result);
});

app.post('/execute', executeHandler);

async function runStartupENSSmokeTest(): Promise<void> {
  const ensAdapter = new ENSAdapter();
  const ensName = 'vitalik.eth';
  const key = 'description';

  console.log('[ENS STARTUP SMOKE] starting');
  try {
    const address = await ensAdapter.resolveName(ensName);
    console.log('[ENS STARTUP SMOKE] address:', ensName, address);

    const records = await ensAdapter.getTextRecords(ensName);
    const description = records[key] ?? null;
    console.log('[ENS STARTUP SMOKE] text:', ensName, key, description);
  } catch (error) {
    console.error('[ENS STARTUP SMOKE] error');
    console.error(error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  void runStartupENSSmokeTest();
});
