import { Request, Response } from 'express';
import { ExecutionService } from '../orchestrator/ExecutionService';

const executionService = new ExecutionService();

export async function executeHandler(
  req: Request, 
  res: Response
): Promise<void> {
  const result = await executionService.execute(req.body);
  res.json(result);
}
