import { Request, Response } from 'express';
import { ExecutionService } from '../orchestrator/ExecutionService';
import { ExecutionRequest } from '../types';

const executionService = new ExecutionService();

export async function executeHandler(
  req: Request,
  res: Response
): Promise<void> {
  const startedAt = Date.now();

  try {
    const { intent, context } = req.body;

    if (typeof intent !== 'string' || intent.trim().length === 0) {
      res.status(400).json({ error: 'Invalid input: intent must be a non-empty string' });
      return;
    }

    const request: ExecutionRequest = { intent: intent.trim(), context };

    const result = await executionService.execute(request);

    // Section 5: Determinism check
    if (context?.debug === true) {
      const result2 = await executionService.execute(request);
      const consistent = result.summary.finalProtocol === result2.summary.finalProtocol
        && result.summary.wasRetried === result2.summary.wasRetried;
      console.log(`[DETERMINISM] ${consistent ? 'consistent' : 'INCONSISTENT'} — protocol: ${result.summary.finalProtocol} vs ${result2.summary.finalProtocol}`);
    }

    res.json(result);
    console.log(`[CONTROLLER] Response sent (${Date.now() - startedAt}ms)`);
  } catch (error) {
    console.error('[CONTROLLER] Error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
