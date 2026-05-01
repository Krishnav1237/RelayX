const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.AXL_PORT ?? 3005);
const PEER_URLS = (process.env.AXL_PEER_URLS ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter((url) => url.length > 0);
const PEER_TIMEOUT_MS = Number(process.env.AXL_PEER_TIMEOUT_MS ?? 1500);

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

async function postJson(baseUrl, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PEER_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, peer: baseUrl, status: response.status };
    }
    return { ok: true, peer: baseUrl, body: await response.json() };
  } catch (error) {
    return { ok: false, peer: baseUrl, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function forwardToPeers(path, body) {
  if (PEER_URLS.length === 0) return [];
  return Promise.all(PEER_URLS.map((peerUrl) => postJson(peerUrl, path, body)));
}

function extractPeerResponses(results) {
  const responses = [];
  for (const result of results) {
    if (!result.ok || result.body === undefined) continue;
    if (Array.isArray(result.body)) {
      responses.push(...result.body);
    } else if (Array.isArray(result.body.responses)) {
      responses.push(...result.body.responses);
    } else if (Array.isArray(result.body.data)) {
      responses.push(...result.body.data);
    } else {
      responses.push(result.body);
    }
  }
  return responses;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok', service: 'axl-dev-node', peersConfigured: PEER_URLS.length });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/message') {
    try {
      const body = await readJson(req);
      const peerResults = await forwardToPeers('/message', body);
      sendJson(res, 200, {
        acknowledged: peerResults.some((result) => result.ok),
        responder: 'axl-dev-node',
        peersConfigured: PEER_URLS.length,
        peerResults,
      });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/broadcast') {
    try {
      const body = await readJson(req);
      const peerResults = await forwardToPeers('/broadcast', body);
      sendJson(res, 200, {
        responses: extractPeerResponses(peerResults),
        responder: 'axl-dev-node',
        peersConfigured: PEER_URLS.length,
      });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[AXL DEV NODE] running on http://localhost:${PORT}`);
  console.log(`[AXL DEV NODE] peers configured: ${PEER_URLS.length}`);
  console.log('[AXL DEV NODE] routes: GET /health, POST /message, POST /broadcast');
});
