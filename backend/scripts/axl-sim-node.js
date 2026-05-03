#!/usr/bin/env node
/**
 * axl-sim-node.js — AXL Simulation Node
 *
 * Simulates the Gensyn AXL binary HTTP API locally for development.
 * Run this if you don't have the real AXL binary compiled from:
 *   https://github.com/gensyn-ai/axl
 *
 * Implements the real AXL HTTP API shape:
 *   GET  /topology                      — peers + our public key
 *   POST /send + X-Destination-Peer-Id  — fire-and-forget message
 *   GET  /recv                          — poll inbound messages
 *   POST /mcp/{peer_id}/{service}       — MCP JSON-RPC (proxied)
 *   POST /a2a/{peer_id}                 — A2A agent-to-agent
 *
 *   POST /broadcast                     — legacy RelayX broadcast (kept for compat)
 *
 * Usage:
 *   node scripts/axl-sim-node.js
 *   AXL_SIM_PORT=3005 node scripts/axl-sim-node.js
 */

const http = require('http');
const crypto = require('crypto');

const PORT = parseInt(process.env.AXL_SIM_PORT ?? process.env.AXL_PORT ?? '3005', 10);

// ─── Simulated node identity ─────────────────────────────────────────────────

const OUR_KEY = crypto.randomBytes(32).toString('hex'); // 64-char hex sim of ed25519 pubkey
const OUR_IPV6 = `200:${crypto.randomBytes(8).toString('hex').replace(/../g, (b) => b + ':').slice(0, -1)}`;

// ─── Simulated peers ─────────────────────────────────────────────────────────

const SIM_PEERS = [
  {
    peer_id: crypto.randomBytes(32).toString('hex'),
    address: 'tls://sim-peer-1.relayx.local:9001',
    latency_ms: 12,
  },
  {
    peer_id: crypto.randomBytes(32).toString('hex'),
    address: 'tls://sim-peer-2.relayx.local:9001',
    latency_ms: 28,
  },
];

// ─── Message queue (simulates /recv) ─────────────────────────────────────────

const inboundQueue = [];

// ─── Sim response generators ─────────────────────────────────────────────────

function simYieldResponse() {
  const protocols = ['aave', 'compound', 'lido', 'morpho', 'spark'];
  const protocol = protocols[Math.floor(Math.random() * protocols.length)];
  return {
    protocol,
    apy: +(4 + Math.random() * 8).toFixed(2),
    confidence: +(0.7 + Math.random() * 0.25).toFixed(2),
    source: 'axl-sim-peer',
    timestamp: Date.now(),
  };
}

function simRiskResponse(payload) {
  const apy = payload?.apy ?? 5;
  const riskLevel = payload?.riskLevel ?? 'low';
  const decision = apy > 12 || riskLevel === 'high' ? 'reject' : 'approve';
  return {
    decision,
    confidence: +(0.75 + Math.random() * 0.2).toFixed(2),
    source: 'axl-sim-peer',
    timestamp: Date.now(),
  };
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Destination-Peer-Id');
}

function json(res, code, data) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ── OPTIONS preflight ───────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // ── GET /topology ───────────────────────────────────────────────────────
  if (req.method === 'GET' && path === '/topology') {
    return json(res, 200, {
      our_ipv6: OUR_IPV6,
      our_public_key: OUR_KEY,
      peers: SIM_PEERS,
      tree: SIM_PEERS.map((p) => ({ key: p.peer_id, latency_ms: p.latency_ms })),
    });
  }

  // ── POST /send ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && path === '/send') {
    const destPeerId = req.headers['x-destination-peer-id'] ?? 'broadcast';
    const body = await readBody(req);

    // Simulate: queue an inbound response based on message type
    const msgType = body?.type ?? 'unknown';
    let responsePayload;
    if (msgType === 'yield_request') responsePayload = simYieldResponse();
    else if (msgType === 'risk_request') responsePayload = simRiskResponse(body?.payload);
    else responsePayload = { status: 'acknowledged', source: 'axl-sim-peer', timestamp: Date.now() };

    const fromPeer = SIM_PEERS[Math.floor(Math.random() * SIM_PEERS.length)];
    inboundQueue.push({ from: fromPeer.peer_id, payload: responsePayload });

    cors(res);
    res.writeHead(200, { 'X-Sent-Bytes': JSON.stringify(body).length.toString() });
    res.end();
    return;
  }

  // ── GET /recv ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && path === '/recv') {
    const msg = inboundQueue.shift();
    if (!msg) {
      cors(res);
      res.writeHead(204); // queue empty
      res.end();
      return;
    }
    cors(res);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-From-Peer-Id': msg.from,
    });
    res.end(JSON.stringify(msg.payload));
    return;
  }

  // ── POST /mcp/{peer_id}/{service} ───────────────────────────────────────
  if (req.method === 'POST' && path.startsWith('/mcp/')) {
    const parts = path.split('/').filter(Boolean);
    const service = parts[2] ?? 'unknown';
    const body = await readBody(req);
    return json(res, 200, {
      jsonrpc: '2.0',
      id: body?.id ?? 1,
      result: {
        service,
        status: 'ok',
        source: 'axl-sim-peer',
        timestamp: Date.now(),
      },
    });
  }

  // ── POST /a2a/{peer_id} ─────────────────────────────────────────────────
  if (req.method === 'POST' && path.startsWith('/a2a/')) {
    const body = await readBody(req);
    return json(res, 200, {
      jsonrpc: '2.0',
      id: body?.id ?? 1,
      result: {
        status: 'ok',
        message: 'A2A message received by sim node',
        timestamp: Date.now(),
      },
    });
  }

  // ── POST /broadcast (legacy RelayX compat) ──────────────────────────────
  if (req.method === 'POST' && path === '/broadcast') {
    const body = await readBody(req);
    const msgType = body?.type ?? 'unknown';

    const responses = SIM_PEERS.map((peer) => {
      if (msgType === 'yield_request') return simYieldResponse();
      if (msgType === 'risk_request') return simRiskResponse(body?.payload);
      return { status: 'acknowledged', source: 'axl-sim-peer', peerFrom: peer.peer_id, timestamp: Date.now() };
    });

    return json(res, 200, responses);
  }

  // ── Health ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && (path === '/health' || path === '/')) {
    return json(res, 200, {
      status: 'ok',
      mode: 'simulation',
      port: PORT,
      peers: SIM_PEERS.length,
      our_public_key: OUR_KEY.slice(0, 16) + '...',
    });
  }

  // 404
  json(res, 404, { error: 'not found', path });
});

server.listen(PORT, () => {
  console.log(`[AXL-SIM] Simulation node running on http://localhost:${PORT}`);
  console.log(`[AXL-SIM] Mode: solo simulation (${SIM_PEERS.length} simulated peers)`);
  console.log(`[AXL-SIM] API endpoints: /topology, /send, /recv, /mcp/{peer_id}/{service}, /a2a/{peer_id}`);
  console.log(`[AXL-SIM] For real P2P: build the AXL binary from https://github.com/gensyn-ai/axl`);
  console.log(`[AXL-SIM] Real AXL listens on 127.0.0.1:9002 by default`);
});

server.on('error', (err) => {
  console.error('[AXL-SIM] Server error:', err.message);
  process.exit(1);
});
