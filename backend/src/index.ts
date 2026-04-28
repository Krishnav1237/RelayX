import express, { Express, Request, Response } from 'express';
import { executeHandler } from './controllers/execute.controller';
import { ENSAdapter } from './adapters/ENSAdapter';

const app: Express = express();
const PORT = 3001;

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
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
