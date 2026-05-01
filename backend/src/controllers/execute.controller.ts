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

    // Section 5: Debug metadata (lightweight — no duplicate execution)
    if (context?.debug === true) {
      console.log(`[DEBUG] protocol: ${result.summary.finalProtocol}, retried: ${result.summary.wasRetried}, confidence: ${result.summary.confidence}, steps: ${result.trace.length}`);
    }

    res.json(result);
    console.log(`[CONTROLLER] Response sent (${Date.now() - startedAt}ms)`);
  } catch (error) {
    console.error('[CONTROLLER] Error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function analyzeHandler(
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
    const result = await executionService.analyze(request);

    if (context?.debug === true) {
      console.log(`[DEBUG] analysis ready: ${result.summary.finalProtocol}, confidence: ${result.summary.confidence}, steps: ${result.trace.length}`);
    }

    res.json(result);
    console.log(`[CONTROLLER] Analysis response sent (${Date.now() - startedAt}ms)`);
  } catch (error) {
    console.error('[CONTROLLER] Analyze error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function confirmExecutionHandler(
  req: Request,
  res: Response
): Promise<void> {
  const startedAt = Date.now();

  try {
    const { approvalId } = req.body;

    if (typeof approvalId !== 'string' || approvalId.trim().length === 0) {
      res.status(400).json({ error: 'Invalid input: approvalId is required' });
      return;
    }

    const result = await executionService.confirmExecution(approvalId.trim());
    res.json(result);
    console.log(`[CONTROLLER] Approved execution response sent (${Date.now() - startedAt}ms)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[CONTROLLER] Confirm execution error:', message);
    res.status(message.includes('expired or not found') ? 404 : 500).json({ error: message });
  }
}
