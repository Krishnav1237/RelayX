import express, { Express, Request, Response } from 'express';
import { executeHandler } from './controllers/execute.controller';

const app: Express = express();
const PORT = 3001;

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/execute', executeHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
