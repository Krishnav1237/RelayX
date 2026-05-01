import { vi } from 'vitest';

const DEFILLAMA_FIXTURE = {
  data: [
    { pool: 'ethereum-morpho-weth', symbol: 'WETH', chain: 'Ethereum', project: 'morpho', apy: 4.68, tvlUsd: 82_000_000 },
    { pool: 'ethereum-aave-v3-weth', symbol: 'WETH', chain: 'Ethereum', project: 'aave-v3', apy: 4.12, tvlUsd: 420_000_000 },
    { pool: 'ethereum-compound-v3-weth', symbol: 'WETH', chain: 'Ethereum', project: 'compound-v3', apy: 3.76, tvlUsd: 210_000_000 },
    { pool: 'ethereum-lido-steth', symbol: 'STETH', chain: 'Ethereum', project: 'lido', apy: 2.93, tvlUsd: 9_500_000_000 },
    { pool: 'ethereum-morpho-usdc', symbol: 'USDC', chain: 'Ethereum', project: 'morpho', apy: 5.1, tvlUsd: 120_000_000 },
    { pool: 'ethereum-aave-v3-usdc', symbol: 'USDC', chain: 'Ethereum', project: 'aave-v3', apy: 4.41, tvlUsd: 610_000_000 },
    { pool: 'ethereum-compound-v3-usdc', symbol: 'USDC', chain: 'Ethereum', project: 'compound-v3', apy: 4.08, tvlUsd: 330_000_000 },
    { pool: 'ethereum-spark-dai', symbol: 'DAI', chain: 'Ethereum', project: 'spark', apy: 4.22, tvlUsd: 180_000_000 },
    { pool: 'ethereum-aave-v3-dai', symbol: 'DAI', chain: 'Ethereum', project: 'aave-v3', apy: 3.91, tvlUsd: 90_000_000 },
    { pool: 'ethereum-aave-v3-wbtc', symbol: 'WBTC', chain: 'Ethereum', project: 'aave-v3', apy: 1.42, tvlUsd: 75_000_000 },
    { pool: 'ethereum-compound-v3-wbtc', symbol: 'WBTC', chain: 'Ethereum', project: 'compound-v3', apy: 1.18, tvlUsd: 58_000_000 },
  ],
};

const COINGECKO_FIXTURE = {
  ethereum: { usd: 3200, last_updated_at: 1_714_000_000 },
  weth: { usd: 3200, last_updated_at: 1_714_000_000 },
  'usd-coin': { usd: 1, last_updated_at: 1_714_000_000 },
  tether: { usd: 1, last_updated_at: 1_714_000_000 },
  dai: { usd: 1, last_updated_at: 1_714_000_000 },
  'wrapped-bitcoin': { usd: 62_000, last_updated_at: 1_714_000_000 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function inputToUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

vi.stubGlobal('fetch', async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
  const url = inputToUrl(input);

  if (url.startsWith('https://yields.llama.fi/pools')) {
    return jsonResponse(DEFILLAMA_FIXTURE);
  }

  if (url.startsWith('https://api.coingecko.com/api/v3/simple/price')) {
    return jsonResponse(COINGECKO_FIXTURE);
  }

  return jsonResponse({ error: 'fixture not configured' }, 503);
});
