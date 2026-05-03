import { Request, Response } from 'express';
import { ExecutionService } from '../orchestrator/ExecutionService.js';
import { ExecutionRequest } from '../types/index.js';
import { validateIntent } from '../config/security.js';

const executionService = new ExecutionService();

export async function executeHandler(req: Request, res: Response): Promise<void> {
  const startedAt = Date.now();

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const { intent, context } = body as Record<string, unknown>;
    const validatedIntent = validateIntent(intent);

    if (!validatedIntent.ok) {
      res.status(400).json({ error: validatedIntent.error });
      return;
    }

    const normalizedContext = normalizeContext(context);
    const request: ExecutionRequest = {
      intent: validatedIntent.intent,
      context: normalizedContext,
    };

    const result = await executionService.execute(request);

    // Section 5: Debug metadata (lightweight — no duplicate execution)
    if (normalizedContext?.debug === true) {
      console.log(
        `[DEBUG] protocol: ${result.summary.finalProtocol}, retried: ${result.summary.wasRetried}, confidence: ${result.summary.confidence}, steps: ${result.trace.length}`
      );
    }

    res.json(result);
    console.log(`[CONTROLLER] Response sent (${Date.now() - startedAt}ms)`);
  } catch (error) {
    console.error('[CONTROLLER] Error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function analyzeHandler(req: Request, res: Response): Promise<void> {
  const startedAt = Date.now();

  try {
    console.log('[CONTROLLER] Analyze request received');
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const { intent, context } = body as Record<string, unknown>;
    console.log('[CONTROLLER] Intent:', intent);
    console.log('[CONTROLLER] Context:', JSON.stringify(context));
    
    const validatedIntent = validateIntent(intent);

    if (!validatedIntent.ok) {
      console.log('[CONTROLLER] Intent validation failed:', validatedIntent.error);
      res.status(400).json({ error: validatedIntent.error });
      return;
    }

    const normalizedContext = normalizeContext(context);
    const request: ExecutionRequest = {
      intent: validatedIntent.intent,
      context: normalizedContext,
    };
    
    console.log('[CONTROLLER] Starting execution service analyze...');
    const result = await executionService.analyze(request);
    console.log('[CONTROLLER] Execution service analyze completed');

    if (normalizedContext?.debug === true) {
      console.log(
        `[DEBUG] analysis ready: ${result.summary.finalProtocol}, confidence: ${result.summary.confidence}, steps: ${result.trace.length}`
      );
    }

    res.json(result);
    console.log(`[CONTROLLER] Analysis response sent (${Date.now() - startedAt}ms)`);
  } catch (error) {
    console.error('[CONTROLLER] Analyze error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error('[CONTROLLER] Stack trace:', error.stack);
    }
    
    // Make sure we send a response even if there's an error
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

function normalizeContext(value: unknown): ExecutionRequest['context'] {
  if (typeof value !== 'object' || value === null) return undefined;
  const context = value as Record<string, unknown>;
  return {
    ens: typeof context.ens === 'string' ? context.ens : undefined,
    wallet: typeof context.wallet === 'string' ? context.wallet : undefined,
    demo: context.demo === true,
    debug: context.debug === true,
  };
}

export async function confirmExecutionHandler(req: Request, res: Response): Promise<void> {
  const startedAt = Date.now();

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const { approvalId } = body as Record<string, unknown>;

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
