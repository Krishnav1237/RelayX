import { Request, Response } from 'express';
import { ExecutionService } from '../orchestrator/ExecutionService';
import { ExecutionRequest } from '../types';

const executionService = new ExecutionService();

export async function executeHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { intent, context } = req.body;

    // Validate intent
    if (typeof intent !== 'string' || intent.trim().length === 0) {
      res.status(400).json({
        error: 'Invalid input: intent must be a non-empty string',
      });
      return;
    }

    // Build request
    const request: ExecutionRequest = {
      intent: intent.trim(),
      context,
    };

    const result = await executionService.execute(request);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}
