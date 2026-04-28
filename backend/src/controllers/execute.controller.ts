import { Request, Response } from 'express';
import { ExecutionService } from '../orchestrator/ExecutionService';
import { ExecutionRequest } from '../types';

const executionService = new ExecutionService();

export async function executeHandler(
  req: Request,
  res: Response
): Promise<void> {
  const startedAt = Date.now();
  console.log('[CONTROLLER] Request received');

  try {
    const { intent, context } = req.body;

    // Validate intent
    if (typeof intent !== 'string' || intent.trim().length === 0) {
      res.status(400).json({
        error: 'Invalid input: intent must be a non-empty string',
      });
      return;
    }
    console.log(`[CONTROLLER] Intent validated: ${intent.trim()}`);

    // Build request
    const request: ExecutionRequest = {
      intent: intent.trim(),
      context,
    };

    console.log('[CONTROLLER] Calling ExecutionService');
    const result = await executionService.execute(request);
    res.json(result);
    console.log(`[CONTROLLER] Response sent (${Date.now() - startedAt}ms)`);
  } catch (error) {
    console.error('[CONTROLLER] Error while handling /execute');
    console.error(error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}
