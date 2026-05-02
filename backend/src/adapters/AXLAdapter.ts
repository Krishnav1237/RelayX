import { AXLMessage } from '../types';

const AXL_NODES = [
  process.env.AXL_BASE_URL ?? 'http://localhost:3005',
  'http://localhost:3006',
  'http://localhost:3007',
];
const AXL_NODE_TIMEOUT_MS = 1500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type BroadcastPayload = Record<string, unknown> | AXLMessage;

export class AXLAdapter {
  async sendMessage(
    target: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const body = { target, payload };
    try {
      const response = await this.postJson(AXL_NODES[0]!, '/message', body);
      if (isRecord(response)) return response;
      return { acknowledged: false };
    } catch (error) {
      console.error(
        '[AXLAdapter] sendMessage failed:',
        error instanceof Error ? error.message : error
      );
      return { acknowledged: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async broadcast(payload: BroadcastPayload): Promise<unknown[]> {
    // Broadcast to ALL nodes in parallel
    const results = await Promise.allSettled(
      AXL_NODES.map((node) => this.postJson(node, '/broadcast', { payload }))
    );

    const allResponses: unknown[] = [];
    let peersContacted = 0;

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        peersContacted++;
        const extracted = this.extractResponses(result.value);
        for (const r of extracted) {
          if (this.isValidResponse(r)) allResponses.push(r);
        }
      }
    }

    if (allResponses.length > 0) {
      console.log(
        `[AXLAdapter] broadcast: ${peersContacted} nodes responded, ${allResponses.length} valid responses`
      );
    } else {
      console.warn('[AXLAdapter] broadcast: no peers available');
    }

    return allResponses;
  }

  private async postJson(
    baseUrl: string,
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AXL_NODE_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`AXL HTTP ${response.status} for ${baseUrl}${path}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractResponses(response: unknown): unknown[] {
    if (Array.isArray(response)) return response;
    if (isRecord(response)) {
      if (Array.isArray(response.responses)) return response.responses as unknown[];
      if (Array.isArray(response.data)) return response.data as unknown[];
    }
    return [];
  }

  // Phase 4: Strict response validation
  private isValidResponse(value: unknown): boolean {
    if (!isRecord(value)) return false;

    // Yield response: must have option with protocol + apy
    if (isRecord(value.option)) {
      const opt = value.option;
      if (typeof opt.protocol !== 'string' || typeof opt.apy !== 'number') return false;
      if (opt.apy <= 0 || opt.apy > 50) return false;
    }

    // Risk response: must have valid decision
    if (typeof value.decision === 'string') {
      if (value.decision !== 'approve' && value.decision !== 'reject') return false;
    }

    // Execution ack: must have acknowledged field
    if ('acknowledged' in value) {
      if (typeof value.acknowledged !== 'boolean') return false;
    }

    return true;
  }
}
