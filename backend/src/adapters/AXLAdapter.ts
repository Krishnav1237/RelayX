import { AXLMessage } from '../types';

const AXL_BASE_URL = process.env.AXL_BASE_URL ?? 'http://localhost:3005';
const AXL_TIMEOUT_MS = 2500;

type BroadcastPayload = Record<string, unknown> | AXLMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class AXLAdapter {
  async sendMessage(target: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body = { target, payload };

    try {
      const response = await this.postJson('/message', body);
      if (isRecord(response)) {
        return response;
      }
      return { acknowledged: false, simulatedPeer: true };
    } catch (error) {
      console.error('[AXLAdapter] sendMessage failed');
      console.error(error);
      return {
        acknowledged: false,
        simulatedPeer: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async broadcast(payload: BroadcastPayload): Promise<unknown[]> {
    try {
      const response = await this.postJson('/broadcast', { payload });
      const responses = this.extractResponses(response);
      if (responses.length > 0) {
        return responses;
      }
    } catch (error) {
      console.error('[AXLAdapter] broadcast failed');
      console.error(error);
    }

    const simulated = this.simulateResponses(payload);
    const messageType = this.getMessageType(payload);
    console.warn(`[AXLAdapter] No live AXL responses for ${messageType}; using simulated peers.`);
    return simulated;
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AXL_TIMEOUT_MS);

    try {
      const response = await fetch(`${AXL_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AXL HTTP ${response.status} for ${path}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractResponses(response: unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (isRecord(response)) {
      if (Array.isArray(response.responses)) {
        return response.responses as unknown[];
      }
      if (Array.isArray(response.data)) {
        return response.data as unknown[];
      }
    }

    return [];
  }

  private getMessageType(payload: unknown): AXLMessage['type'] {
    if (isRecord(payload) && typeof payload.type === 'string') {
      if (payload.type === 'yield_request' || payload.type === 'risk_request' || payload.type === 'execution_signal') {
        return payload.type;
      }
    }

    return 'execution_signal';
  }

  private simulateResponses(payload: unknown): Record<string, unknown>[] {
    const type = this.getMessageType(payload);

    if (type === 'yield_request') {
      return [
        {
          peer: 'simulated-peer-1',
          simulatedPeer: true,
          option: { protocol: 'Spark', apy: 4.15, riskLevel: 'low' },
        },
        {
          peer: 'simulated-peer-2',
          simulatedPeer: true,
          option: { protocol: 'Yearn', apy: 3.9, riskLevel: 'low' },
        },
      ];
    }

    if (type === 'risk_request') {
      const message = isRecord(payload) && isRecord(payload.payload) ? payload.payload : {};
      const riskLevel = typeof message.riskLevel === 'string' ? message.riskLevel : 'unknown';
      const apy = typeof message.apy === 'number' ? message.apy : 0;
      const rejectMajority = riskLevel === 'high' || (riskLevel === 'medium' && apy > 4.5);

      return rejectMajority
        ? [
          { peer: 'simulated-peer-1', simulatedPeer: true, decision: 'reject', confidence: 0.76 },
          { peer: 'simulated-peer-2', simulatedPeer: true, decision: 'reject', confidence: 0.72 },
          { peer: 'simulated-peer-3', simulatedPeer: true, decision: 'approve', confidence: 0.58 },
        ]
        : [
          { peer: 'simulated-peer-1', simulatedPeer: true, decision: 'approve', confidence: 0.79 },
          { peer: 'simulated-peer-2', simulatedPeer: true, decision: 'approve', confidence: 0.74 },
          { peer: 'simulated-peer-3', simulatedPeer: true, decision: 'reject', confidence: 0.57 },
        ];
    }

    return [
      { peer: 'simulated-peer-1', simulatedPeer: true, acknowledged: true },
      { peer: 'simulated-peer-2', simulatedPeer: true, acknowledged: true },
    ];
  }
}
