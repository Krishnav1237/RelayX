/**
 * UniswapAdapter — Real On-Chain QuoterV2 Integration
 *
 * Uses Uniswap v3 QuoterV2 contract directly via viem (no API key required).
 * Falls back to CoinGecko spot prices if on-chain call fails.
 *
 * Chain support:
 *   mainnet  (chainId 1)     → QuoterV2: 0x61fFE014bA17989E743c5F6cB21bF9697530B21e
 *   sepolia  (chainId 11155111) → QuoterV2: 0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3
 *
 * Quote sources (in priority order):
 *   1. Uniswap v3 QuoterV2 on-chain  ← primary, no API key needed
 *   2. CoinGecko spot price           ← free fallback
 *   3. Cached last result             ← last resort
 */

import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type { UniswapQuoteResult, SwapCalldata } from '../types/index.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const CHAIN_ID = Number(process.env.RELAYX_CHAIN_ID ?? (process.env.RELAYX_CHAIN === 'sepolia' ? 11155111 : 1));
const IS_SEPOLIA = CHAIN_ID === 11155111;

// Uniswap v3 QuoterV2 addresses (official deployments)
const QUOTER_V2_ADDRESS: Record<number, `0x${string}`> = {
  1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  11155111: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
};

// Uniswap v3 SwapRouter02 addresses
const SWAP_ROUTER_ADDRESS: Record<number, `0x${string}`> = {
  1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  11155111: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
};

// Well-known ERC-20 token addresses
const TOKENS: Record<string, Record<number, `0x${string}`>> = {
  WETH: {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    11155111: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
  },
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
  },
  USDT: {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    11155111: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Sepolia USDT
  },
  DAI: {
    1: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    11155111: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', // Sepolia DAI
  },
};

// Fee tiers to try (0.05%, 0.3%, 1%)
const FEE_TIERS = [500, 3000, 10000] as const;

// CoinGecko token IDs for fallback
const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'weth',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  WBTC: 'wrapped-bitcoin',
  STETH: 'staked-ether',
};

// QuoterV2 ABI — quoteExactInputSingle only
const QUOTER_V2_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

// ─── Quote params ─────────────────────────────────────────────────────────────

export interface QuoteParams {
  tokenIn: string;   // symbol e.g. 'ETH', 'WETH', 'USDC'
  tokenOut: string;
  amount: string;    // raw integer string (wei/units)
  chainId?: number;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CachedQuote {
  result: UniswapQuoteResult;
  expiresAt: number;
}

// ─── UniswapAdapter ───────────────────────────────────────────────────────────

export class UniswapAdapter {
  private cache = new Map<string, CachedQuote>();
  private readonly cacheTtlMs = 30_000;
  private viemClient: ReturnType<typeof createPublicClient> | null = null;
  private lastQuoteSource: 'uniswap-v3-quoter' | 'coingecko' | 'cache' | null = null;

  constructor() {
    // Lazy init — don't create client until first use (after dotenv loads)
  }

  private getViemClient(): ReturnType<typeof createPublicClient> | null {
    if (this.viemClient) return this.viemClient;
    try {
      const rpcUrl = IS_SEPOLIA
        ? (process.env.ALCHEMY_SEPOLIA_RPC_URL ?? process.env.RELAYX_RPC_URL ?? '')
        : (process.env.ALCHEMY_MAINNET_RPC_URL ?? process.env.RELAYX_RPC_URL ?? '');

      const chain = IS_SEPOLIA ? sepolia : mainnet;
      const transport = rpcUrl ? http(rpcUrl, { timeout: 5000 }) : http(undefined, { timeout: 5000 });

      this.viemClient = createPublicClient({ chain, transport });
      console.log(`[UniswapAdapter] Initialized viem client: ${rpcUrl ? 'Alchemy' : 'public'} (chain ${chain.id})`);
      return this.viemClient;
    } catch (err) {
      console.warn('[UniswapAdapter] Failed to initialize viem client:', err);
      return null;
    }
  }

  // ── Token resolution ──────────────────────────────────────────────────────

  private resolveTokenAddress(symbol: string, chainId: number): `0x${string}` | null {
    const normalized = symbol.toUpperCase().replace(/^ETH$/, 'WETH');
    return TOKENS[normalized]?.[chainId] ?? null;
  }

  private getTokenDecimals(symbol: string): number {
    const sym = symbol.toUpperCase();
    if (sym === 'USDC' || sym === 'USDT') return 6;
    if (sym === 'WBTC') return 8;
    return 18; // ETH, WETH, DAI, STETH, etc.
  }

  // ── On-chain QuoterV2 ─────────────────────────────────────────────────────

  private async fetchOnChainQuote(params: QuoteParams): Promise<UniswapQuoteResult | null> {
    const chainId = params.chainId ?? CHAIN_ID;
    const quoterAddress = process.env.UNISWAP_QUOTER_V2_ADDRESS as `0x${string}` | undefined
      ?? QUOTER_V2_ADDRESS[chainId];

    if (!quoterAddress) {
      console.log(`[UniswapAdapter] No QuoterV2 address for chainId ${chainId}`);
      return null;
    }

    if (!this.getViemClient()) {
      console.log('[UniswapAdapter] viem client not initialized');
      return null;
    }

    const tokenInAddr = this.resolveTokenAddress(params.tokenIn, chainId);
    const tokenOutAddr = this.resolveTokenAddress(params.tokenOut, chainId);

    if (!tokenInAddr || !tokenOutAddr) {
      console.log(`[UniswapAdapter] Unknown token: ${params.tokenIn} or ${params.tokenOut}`);
      return null;
    }

    const decimalsIn = this.getTokenDecimals(params.tokenIn);
    const amountIn = BigInt(params.amount);

    // Try each fee tier in parallel, return the best successful quote
    const quotePromises = FEE_TIERS.map(async (fee) => {
      try {
        const rawResult = await this.getViemClient()!.readContract({
          address: quoterAddress,
          abi: QUOTER_V2_ABI,
          functionName: 'quoteExactInputSingle',
          args: [
            {
              tokenIn: tokenInAddr,
              tokenOut: tokenOutAddr,
              amountIn,
              fee,
              sqrtPriceLimitX96: BigInt(0),
            },
          ],
        });

        const result = rawResult as [bigint, bigint, number, bigint];
        const [amountOut, , , gasEstimate] = result;

        if (amountOut > BigInt(0)) {
          const decimalsOut = this.getTokenDecimals(params.tokenOut);
          const amountOutFormatted = formatUnits(amountOut, decimalsOut);
          const amountInFormatted = formatUnits(amountIn, decimalsIn);
          const rate = Number(amountOutFormatted) / Number(amountInFormatted);
          const priceImpact = Math.max(0, Math.min(99, 0.1));
          const tokenInSym = params.tokenIn.toUpperCase().replace('WETH', 'ETH');
          const tokenOutSym = params.tokenOut.toUpperCase();
          const feePct = fee / 10000;

          return {
            amountOut: `${Number(amountOutFormatted).toFixed(6)} ${tokenOutSym}`,
            priceImpact,
            gasEstimate: gasEstimate.toString(),
            route: `${tokenInSym} → [V3 ${feePct}%] → ${tokenOutSym}`,
            source: 'uniswap-v3-quoter' as const,
            rawAmountOut: amountOut.toString(),
            chainId,
            fee,
            rate,
            amountOutRaw: amountOut,
          };
        }
      } catch {
        return null;
      }
      return null;
    });

    const results = (await Promise.all(quotePromises)).filter((r): r is NonNullable<typeof r> => r !== null);
    
    if (results.length > 0) {
      // Sort by best amount out
      const bestResult = results.sort((a, b) => (b.amountOutRaw > a.amountOutRaw ? 1 : -1))[0]!;
      const { amountOutRaw: _, ...finalResult } = bestResult;
      
      console.log(`[UniswapAdapter] Best QuoterV2 quote found: ${finalResult.amountOut} (fee: ${finalResult.fee / 10000}%)`);
      return finalResult;
    }

    console.log(`[UniswapAdapter] No V3 pool found for ${params.tokenIn}/${params.tokenOut} on chain ${chainId}`);
    return null;
  }

  // ── CoinGecko fallback ────────────────────────────────────────────────────

  private async fetchCoinGeckoQuote(params: QuoteParams): Promise<UniswapQuoteResult | null> {
    const tokenInKey = params.tokenIn.toUpperCase().replace('WETH', 'ETH');
    const tokenOutKey = params.tokenOut.toUpperCase().replace('WETH', 'ETH');

    const inId = COINGECKO_IDS[tokenInKey];
    const outId = COINGECKO_IDS[tokenOutKey];

    if (!inId || !outId) return null;

    try {
      const apiKey = process.env.COINGECKO_API_KEY;
      const baseUrl = apiKey
        ? `https://pro-api.coingecko.com/api/v3`
        : `https://api.coingecko.com/api/v3`;
      const headers: Record<string, string> = apiKey ? { 'x-cg-pro-api-key': apiKey } : {};

      const ids = [...new Set([inId, outId])].join(',');
      const url = `${baseUrl}/simple/price?ids=${ids}&vs_currencies=usd`;

      const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;

      const data = await res.json() as Record<string, { usd: number }>;

      const priceIn = data[inId]?.usd;
      const priceOut = data[outId]?.usd;

      if (!priceIn || !priceOut) return null;

      const decimalsIn = this.getTokenDecimals(params.tokenIn);
      const decimalsOut = this.getTokenDecimals(params.tokenOut);
      const amountIn = Number(formatUnits(BigInt(params.amount), decimalsIn));
      const amountOut = (amountIn * priceIn) / priceOut;

      // priceImpact from CoinGecko spot: always 0 (no slippage info), bounded 0-100
      const priceImpact = Math.max(0, Math.min(100, 0));
      const amountOutStr = `${amountOut.toFixed(6)} ${tokenOutKey}`;

      console.log(`[UNISWAP] Fallback used — CoinGecko spot price (on-chain QuoterV2 unavailable)`);

      return {
        amountOut: amountOutStr || `0 ${tokenOutKey}`,  // always defined
        priceImpact,
        gasEstimate: '150000',
        route: `${tokenInKey} → [CoinGecko spot] → ${tokenOutKey}`,
        source: 'coingecko',
        rawAmountOut: String(Math.floor(amountOut * 10 ** decimalsOut)),
        chainId: params.chainId ?? CHAIN_ID,
        rate: amountOut / amountIn,
      };
    } catch {
      return null;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async getQuote(params: QuoteParams): Promise<UniswapQuoteResult | null> {
    const cacheKey = `${params.tokenIn}:${params.tokenOut}:${params.amount}:${params.chainId ?? CHAIN_ID}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.lastQuoteSource = 'cache';
      return cached.result;
    }

    // 1. Try real on-chain QuoterV2
    let result = await this.fetchOnChainQuote(params);
    if (result) {
      this.lastQuoteSource = 'uniswap-v3-quoter';
    }

    // 2. Fallback to CoinGecko — log clearly
    if (!result) {
      console.log('[UNISWAP] Fallback used — QuoterV2 unavailable or no pool, trying CoinGecko');
      result = await this.fetchCoinGeckoQuote(params);
      if (result) this.lastQuoteSource = 'coingecko';
    }

    if (!result) {
      // Return cached even if expired as last resort
      if (cached) {
        this.lastQuoteSource = 'cache';
        console.log('[UNISWAP] Fallback used — serving stale cache entry');
        return cached.result;
      }
      return null;
    }

    // Ensure priceImpact is always bounded
    result = { ...result, priceImpact: Math.max(0, Math.min(100, result.priceImpact ?? 0)) };

    this.cache.set(cacheKey, { result, expiresAt: Date.now() + this.cacheTtlMs });
    return result;
  }

  /**
   * Build SwapRouter02 calldata for a swap.
   * Uses multicall(deadline, data[]) pattern required by SwapRouter02.
   * Returns a pre-built transaction the frontend can send to MetaMask.
   */
  async getSwapCalldata(
    params: QuoteParams,
    recipient: string,
    slippageBps = 50, // 0.5% default slippage
    existingQuote?: UniswapQuoteResult | null
  ): Promise<SwapCalldata | null> {
    const chainId = params.chainId ?? CHAIN_ID;
    const routerAddress = SWAP_ROUTER_ADDRESS[chainId];
    if (!routerAddress) return null;

    // Use existing quote if provided, otherwise fetch new one
    const quote = existingQuote ?? await this.getQuote(params);
    if (!quote || !quote.rawAmountOut) return null;

    const tokenInAddr = this.resolveTokenAddress(params.tokenIn, chainId);
    const tokenOutAddr = this.resolveTokenAddress(params.tokenOut, chainId);
    if (!tokenInAddr || !tokenOutAddr) return null;

    const amountOutMin = BigInt(quote.rawAmountOut) * BigInt(10000 - slippageBps) / BigInt(10000);
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 min
    const fee = quote.fee ?? 3000;

    // SwapRouter02 uses multicall(uint256 deadline, bytes[] data)
    // Inner call: exactInputSingle((tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96))
    const innerCalldata = encodeExactInputSingleV2({
      tokenIn: tokenInAddr,
      tokenOut: tokenOutAddr,
      fee,
      recipient: recipient as `0x${string}`,
      amountIn: BigInt(params.amount),
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: BigInt(0),
    });

    // Wrap in multicall(uint256 deadline, bytes[] data)
    const finalCalldata = encodeMulticall(deadline, [innerCalldata]);

    const isETHInput = params.tokenIn.toUpperCase() === 'ETH' || params.tokenIn.toUpperCase() === 'WETH';

    return {
      to: routerAddress,
      data: finalCalldata,
      value: isETHInput ? params.amount : '0',
      gasEstimate: quote.gasEstimate ?? '200000',
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountOut: quote.amountOut,
      router: routerAddress,
      deadline,
    };
  }

  getLastQuoteSource(): string | null {
    return this.lastQuoteSource;
  }

  async getHealthStatus(): Promise<{
    status: 'ok' | 'degraded' | 'offline';
    source: 'uniswap-v3-quoter' | 'coingecko' | 'none';
    chainId: number;
    quoterAddress: string;
  }> {
    const chainId = CHAIN_ID;
    const quoterAddress = QUOTER_V2_ADDRESS[chainId] ?? 'not-configured';

    // Quick health check: try a simple ETH→USDC quote
    const testQuote = await this.getQuote({
      tokenIn: 'ETH',
      tokenOut: 'USDC',
      amount: parseUnits('1', 18).toString(),
      chainId,
    });

    if (!testQuote) {
      return { status: 'offline', source: 'none', chainId, quoterAddress };
    }

    const source = (testQuote as { source?: string }).source === 'uniswap-v3-quoter'
      ? ('uniswap-v3-quoter' as const)
      : ('coingecko' as const);

    return {
      status: source === 'uniswap-v3-quoter' ? 'ok' : 'degraded',
      source,
      chainId,
      quoterAddress,
    };
  }
}

// ─── ABI encoding helpers ──────────────────────────────────────────────────────

function padHex(value: string, bytes = 32): string {
  return value.replace('0x', '').padStart(bytes * 2, '0');
}

function addressToHex(addr: string): string {
  return padHex(addr.replace('0x', '').toLowerCase());
}

function uintToHex(value: bigint): string {
  return padHex(value.toString(16));
}

/**
 * Encodes SwapRouter02 exactInputSingle.
 * Selector: 0x04e45aaf
 * Struct: (tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96)
 * NOTE: SwapRouter02 does NOT include deadline in the struct — deadline goes in multicall wrapper.
 */
function encodeExactInputSingleV2(params: {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  fee: number;
  recipient: `0x${string}`;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96: bigint;
}): `0x${string}` {
  // keccak256('exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))')
  const selector = '0x04e45aaf';

  const encoded = [
    addressToHex(params.tokenIn),
    addressToHex(params.tokenOut),
    uintToHex(BigInt(params.fee)),
    addressToHex(params.recipient),
    uintToHex(params.amountIn),
    uintToHex(params.amountOutMinimum),
    uintToHex(params.sqrtPriceLimitX96),
  ].join('');

  return `${selector}${encoded}` as `0x${string}`;
}

/**
 * Encodes SwapRouter02 multicall(uint256 deadline, bytes[] data).
 * Selector: 0x5ae401dc
 * This wraps inner swap calls with a deadline.
 */
function encodeMulticall(deadline: number, calls: `0x${string}`[]): `0x${string}` {
  // keccak256('multicall(uint256,bytes[])')
  const selector = '0x5ae401dc';

  // ABI encode: (uint256 deadline, bytes[] data)
  // deadline
  const deadlineHex = uintToHex(BigInt(deadline));

  // offset to bytes[] (always 64 = 0x40 for two params)
  const offsetHex = uintToHex(BigInt(64));

  // bytes[] length
  const arrayLenHex = uintToHex(BigInt(calls.length));

  // For each call: offset, then length + padded data
  const callOffsets: string[] = [];
  const callDatas: string[] = [];

  let currentOffset = calls.length * 32; // initial offset past the offset array
  for (const call of calls) {
    callOffsets.push(uintToHex(BigInt(currentOffset)));
    const rawBytes = call.replace('0x', '');
    const byteLen = rawBytes.length / 2;
    const lenHex = uintToHex(BigInt(byteLen));
    const paddedData = rawBytes.padEnd(Math.ceil(rawBytes.length / 64) * 64, '0');
    callDatas.push(lenHex + paddedData);
    currentOffset += 32 + Math.ceil(byteLen / 32) * 32;
  }

  const encoded = deadlineHex + offsetHex + arrayLenHex + callOffsets.join('') + callDatas.join('');
  return `${selector}${encoded}` as `0x${string}`;
}
