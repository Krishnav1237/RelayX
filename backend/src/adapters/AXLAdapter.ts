/**
 * AXLAdapter — Gensyn AXL Real P2P Node Integration
 *
 * Connects to the real Gensyn AXL binary (github.com/gensyn-ai/axl) via its local HTTP API.
 * Falls back to the simulation node if the real binary is not running.
 *
 * RELIABILITY RULES:
 *   - All external calls are bounded to AXL_TIMEOUT_MS (max 1500ms)
 *   - /recv is optional and non-blocking (single poll, no loops)
 *   - If no response → return neutral decision, never throw
 *   - AXL NEVER blocks execution flow
 *
 * Real AXL HTTP API (127.0.0.1:9002):
 *   GET  /topology                    - peer list, our IPv6, our public key
 *   POST /send + X-Destination-Peer-Id - fire-and-forget binary message
 *   GET  /recv                        - poll inbound messages (optional, single poll)
 *   POST /mcp/{peer_id}/{service}     - JSON-RPC to remote peer MCP service
 *   POST /a2a/{peer_id}               - A2A agent-to-agent JSON-RPC
 *
 * Sim node fallback (localhost:3005) - runs axl-sim-node.js
 */

import type { AXLMessage } from '../types/index.js';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Real AXL binary local HTTP API */
const AXL_NODE_URL = (process.env.AXL_NODE_URL ?? 'http://127.0.0.1:9002').replace(/\/$/, '');

/** Simulation/fallback node (axl-sim-node.js) */
const AXL_SIM_URL = (process.env.AXL_BASE_URL ?? 'http://localhost:3005').replace(/\/$/, '');

/**
 * Maximum timeout for any AXL call (1500ms).
 * Overridable via AXL_TIMEOUT_MS env var, but capped at 1500ms for safety.
 */
const AXL_TIMEOUT_MS = Math.min(
  Number(process.env.AXL_TIMEOUT_MS ?? '1500'),
  1500
);

/** Topology check timeout — faster than message timeout */
const AXL_CHECK_TIMEOUT_MS = Math.min(AXL_TIMEOUT_MS, 1000);

// ─── Neutral fallback ─────────────────────────────────────────────────────────

/** Returned when AXL has no peers or times out — never modifies execution */
export const AXL_NEUTRAL_RESPONSE = {
  peers: 0,
  decision: 'neutral' as const,
  confidenceImpact: 0,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AXLTopology {
  our_ipv6: string;
  our_public_key: string;
  peers: AXLPeer[];
  tree: unknown[];
}

interface AXLPeer {
  peer_id: string;       // hex-encoded ed25519 public key (64 chars)
  address?: string;
  latency_ms?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[AXL] ${label} timed out (${ms}ms)`)), ms)
    ),
  ]);
}

async function httpGet(url: string, timeoutMs = AXL_TIMEOUT_MS): Promise<Response> {
  return withTimeout(fetch(url), timeoutMs, `GET ${url}`);
}

async function httpPost(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs = AXL_TIMEOUT_MS
): Promise<Response> {
  return withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    timeoutMs,
    `POST ${url}`
  );
}

// ─── AXLAdapter ───────────────────────────────────────────────────────────────

export class AXLAdapter {
  private realNodeAvailable: boolean | null = null;
  private lastAvailabilityCheck = 0;
  private readonly availabilityTtlMs = 30_000; // re-check every 30s

  // ── Node availability ──────────────────────────────────────────────────────

  /**
   * Check if the real AXL binary node is reachable.
   * Caches the result for 30s. Never throws.
   */
  async isRealNodeAvailable(): Promise<boolean> {
    const now = Date.now();
    if (
      this.realNodeAvailable !== null &&
      now - this.lastAvailabilityCheck < this.availabilityTtlMs
    ) {
      return this.realNodeAvailable;
    }

    try {
      const res = await httpGet(`${AXL_NODE_URL}/topology`, AXL_CHECK_TIMEOUT_MS);
      this.realNodeAvailable = res.ok;
    } catch {
      this.realNodeAvailable = false;
    }

    this.lastAvailabilityCheck = Date.now();
    return this.realNodeAvailable;
  }

  // ── Real AXL API ───────────────────────────────────────────────────────────

  /**
   * Fetch network topology from the real AXL node.
   * Returns null on error or timeout.
   */
  async getTopology(): Promise<AXLTopology | null> {
    try {
      const res = await httpGet(`${AXL_NODE_URL}/topology`, AXL_CHECK_TIMEOUT_MS);
      if (!res.ok) return null;
      return (await res.json()) as AXLTopology;
    } catch {
      return null;
    }
  }

  /**
   * Send a binary/JSON message to a specific peer via the real AXL node.
   * Never throws — returns false on failure.
   */
  async sendToPeer(peerId: string, payload: unknown): Promise<boolean> {
    try {
      const res = await httpPost(
        `${AXL_NODE_URL}/send`,
        JSON.stringify(payload),
        { 'X-Destination-Peer-Id': peerId, 'Content-Type': 'application/octet-stream' }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Single, non-blocking poll of /recv for any inbound messages.
   * Returns null if queue is empty (204), times out, or errors.
   * NEVER awaits indefinitely.
   */
  async pollReceive(): Promise<{ from: string; payload: unknown } | null> {
    try {
      const res = await withTimeout(
        httpGet(`${AXL_NODE_URL}/recv`),
        AXL_CHECK_TIMEOUT_MS,
        '/recv poll'
      );
      if (res.status === 204) return null; // queue empty
      if (!res.ok) return null;

      const fromPeerId = res.headers.get('X-From-Peer-Id') ?? 'unknown';
      const text = await res.text();
      let payload: unknown = text;
      try {
        payload = JSON.parse(text);
      } catch {
        // keep as raw text
      }
      return { from: fromPeerId, payload };
    } catch {
      return null;
    }
  }

  /**
   * Send a JSON-RPC request to a remote peer's MCP service via the real AXL node.
   * Bounded by AXL_TIMEOUT_MS.
   */
  async mcpCall(peerId: string, service: string, method: string, params: unknown = {}): Promise<unknown> {
    const body = { jsonrpc: '2.0', method, id: Date.now(), params };
    try {
      const res = await httpPost(`${AXL_NODE_URL}/mcp/${peerId}/${service}`, body);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  /**
   * Send an A2A message to a remote peer via the real AXL node.
   * Bounded by AXL_TIMEOUT_MS.
   */
  async a2aCall(peerId: string, service: string, request: unknown): Promise<unknown> {
    const body = {
      jsonrpc: '2.0',
      method: 'SendMessage',
      id: Date.now(),
      params: {
        message: {
          role: 'ROLE_USER',
          parts: [{ text: JSON.stringify({ service, request }) }],
          messageId: `relayx-${Date.now()}`,
        },
      },
    };
    try {
      const res = await httpPost(`${AXL_NODE_URL}/a2a/${peerId}`, body);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  // ── Broadcast (main entry point used by agents) ────────────────────────────

  /**
   * Broadcast an AXL message to all available peers.
   *
   * RELIABILITY CONTRACT:
   * - Never throws, never blocks > AXL_TIMEOUT_MS
   * - If no peers respond → returns [] with log
   * - Real node: send to peers, single /recv poll (non-blocking)
   * - Sim node: POST /broadcast with timeout
   *
   * Strategy:
   * 1. Try real AXL node → get topology → send → single /recv poll
   * 2. If real node unavailable → fall back to simulation node
   * 3. If both fail → return [] immediately
   */
  async broadcast(message: AXLMessage): Promise<unknown[]> {
    try {
      const useReal = await this.isRealNodeAvailable();

      if (useReal) {
        return await withTimeout(
          this.broadcastViaRealNode(message),
          AXL_TIMEOUT_MS,
          'broadcast real node'
        );
      }

      return await withTimeout(
        this.broadcastViaSimNode(message),
        AXL_TIMEOUT_MS,
        'broadcast sim node'
      );
    } catch {
      console.log('[AXL] No peer response — proceeding with local decision');
      return [];
    }
  }

  private async broadcastViaRealNode(message: AXLMessage): Promise<unknown[]> {
    const topology = await this.getTopology();

    if (!topology || topology.peers.length === 0) {
      console.log('[AXL] No peer response — proceeding with local decision');
      return [];
    }

    const peers = topology.peers;
    console.log(`[AXLAdapter] Real node: broadcasting to ${peers.length} peer(s)`);

    // Send to all peers (fire-and-forget, no blocking)
    const sendPromises = peers.map((peer) => this.sendToPeer(peer.peer_id, message));
    await Promise.allSettled(sendPromises);

    // Single non-blocking /recv poll — no looping, no delay
    const recv = await this.pollReceive();
    if (recv && this.isValidAXLResponse(recv.payload, message.type)) {
      console.log('[AXLAdapter] Real node: 1 peer response received');
      return [recv.payload];
    }

    console.log('[AXL] No peer response — proceeding with local decision');
    return [];
  }

  private async broadcastViaSimNode(message: AXLMessage): Promise<unknown[]> {
    try {
      const res = await httpPost(`${AXL_SIM_URL}/broadcast`, message);
      if (!res.ok) {
        console.log('[AXL] No peer response — proceeding with local decision');
        return [];
      }

      const data = await res.json() as Record<string, unknown>;
      const arr = Array.isArray(data) ? data : Array.isArray(data?.responses) ? data.responses as unknown[] : [];

      const valid = arr.filter((r: unknown) => this.isValidAXLResponse(r, message.type));
      if (valid.length > 0) {
        console.log(`[AXLAdapter] Sim node: ${valid.length} peer response(s)`);
      } else {
        console.log('[AXL] No peer response — proceeding with local decision');
      }
      return valid;
    } catch {
      console.log('[AXL] No peer response — proceeding with local decision');
      return [];
    }
  }

  // ── Health & status ────────────────────────────────────────────────────────

  async getHealth(): Promise<{
    status: 'real' | 'sim' | 'offline';
    nodeUrl: string;
    peerCount: number;
    ourPublicKey?: string;
  }> {
    try {
      const useReal = await this.isRealNodeAvailable();

      if (useReal) {
        const topology = await this.getTopology();
        return {
          status: 'real',
          nodeUrl: AXL_NODE_URL,
          peerCount: topology?.peers.length ?? 0,
          ourPublicKey: topology?.our_public_key,
        };
      }

      // Check sim node
      const res = await httpGet(`${AXL_SIM_URL}/topology`, AXL_CHECK_TIMEOUT_MS);
      if (res.ok) {
        const data = await res.json() as AXLTopology;
        return {
          status: 'sim',
          nodeUrl: AXL_SIM_URL,
          peerCount: data.peers?.length ?? 0,
        };
      }
    } catch {
      // offline
    }

    return { status: 'offline', nodeUrl: AXL_SIM_URL, peerCount: 0 };
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  private isValidAXLResponse(response: unknown, messageType: string): boolean {
    if (!response || typeof response !== 'object') return false;
    const r = response as Record<string, unknown>;

    if (messageType === 'yield_request') {
      return typeof r.apy === 'number' && r.apy > 0 && r.apy < 100;
    }

    if (messageType === 'risk_request') {
      return r.decision === 'approve' || r.decision === 'reject';
    }

    if (messageType === 'execution_signal') {
      return typeof r.status === 'string';
    }

    return typeof r.status === 'string' || typeof r.decision === 'string';
  }
}
