const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.AXL_PORT ?? 3005);

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_error) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function buildBroadcastResponses(axlMessage) {
  const type = axlMessage?.type;
  const payload = axlMessage?.payload ?? {};

  if (type === 'yield_request') {
    return [
      {
        peer: 'peer.alpha.axl',
        simulatedPeer: true,
        option: { protocol: 'Aave', apy: 4.25, riskLevel: 'low' },
      },
      {
        peer: 'peer.beta.axl',
        simulatedPeer: true,
        option: { protocol: 'Spark', apy: 4.15, riskLevel: 'low' },
      },
    ];
  }

  if (type === 'risk_request') {
    const apy = typeof payload.apy === 'number' ? payload.apy : 0;
    const riskLevel = typeof payload.riskLevel === 'string' ? payload.riskLevel : 'unknown';
    const rejectMajority = riskLevel === 'high' || (riskLevel === 'medium' && apy > 4.5);

    if (rejectMajority) {
      return [
        { peer: 'peer.alpha.axl', simulatedPeer: true, decision: 'reject', confidence: 0.77 },
        { peer: 'peer.beta.axl', simulatedPeer: true, decision: 'reject', confidence: 0.73 },
        { peer: 'peer.gamma.axl', simulatedPeer: true, decision: 'approve', confidence: 0.58 },
      ];
    }

    return [
      { peer: 'peer.alpha.axl', simulatedPeer: true, decision: 'approve', confidence: 0.78 },
      { peer: 'peer.beta.axl', simulatedPeer: true, decision: 'approve', confidence: 0.74 },
      { peer: 'peer.gamma.axl', simulatedPeer: true, decision: 'reject', confidence: 0.57 },
    ];
  }

  if (type === 'execution_signal') {
    return [
      { peer: 'peer.alpha.axl', simulatedPeer: true, acknowledged: true },
      { peer: 'peer.beta.axl', simulatedPeer: true, acknowledged: true },
    ];
  }

  return [];
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok', service: 'axl-mock-node' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/message') {
    try {
      const body = await readJson(req);
      sendJson(res, 200, {
        acknowledged: true,
        responder: 'axl-mock-node',
        received: body,
      });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/broadcast') {
    try {
      const body = await readJson(req);
      const axlMessage = body?.payload ?? {};
      const responses = buildBroadcastResponses(axlMessage);
      sendJson(res, 200, {
        responses,
        responder: 'axl-mock-node',
        type: axlMessage?.type ?? null,
      });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[AXL MOCK] running on http://localhost:${PORT}`);
  console.log('[AXL MOCK] routes: GET /health, POST /message, POST /broadcast');
});
