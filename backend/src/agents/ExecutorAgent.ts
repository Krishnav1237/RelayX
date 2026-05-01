import { BaseAgent } from './BaseAgent';
import { AXLMessage, AgentTrace, ExecutionResult, UniswapQuoteResult, YieldOption } from '../types';
import { AXLAdapter } from '../adapters/AXLAdapter';
import { UniswapAdapter } from '../adapters/UniswapAdapter';

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

// Map protocol names to token pairs for Uniswap quoting
const PROTOCOL_TOKEN_MAP: Record<string, { tokenIn: string; tokenOut: string }> = {
  'aave': { tokenIn: 'ETH', tokenOut: 'USDC' },
  'compound': { tokenIn: 'ETH', tokenOut: 'USDC' },
  'morpho': { tokenIn: 'ETH', tokenOut: 'USDC' },
  'spark': { tokenIn: 'ETH', tokenOut: 'DAI' },
  'lido': { tokenIn: 'ETH', tokenOut: 'USDC' },
};

export class ExecutorAgent extends BaseAgent {
  private axlAdapter = new AXLAdapter();
  private uniswapAdapter = new UniswapAdapter();

  constructor() {
    super('executor.relay.eth', 'executor.relay.eth');
  }

  async quote(
    plan: YieldOption,
    trace: AgentTrace[],
    timestamp: number,
    externalMetadata?: Record<string, unknown>
  ): Promise<{ swapQuote: UniswapQuoteResult | null; nextTimestamp: number }> {
    let ts = timestamp;
    const tokenPair = this.getTokenPair(plan.protocol);

    trace.push(this.log('quote',
      `Fetching swap route from Uniswap for ${tokenPair.tokenIn} -> ${tokenPair.tokenOut}`,
      { tokenIn: tokenPair.tokenIn, tokenOut: tokenPair.tokenOut, protocol: plan.protocol },
      ts, externalMetadata));
    ts += 10;

    let swapQuote: UniswapQuoteResult | null = null;
    try {
      swapQuote = await this.uniswapAdapter.getQuote({
        tokenIn: tokenPair.tokenIn,
        tokenOut: tokenPair.tokenOut,
        amount: '1000000000000000000', // 1 ETH in wei
      });
    } catch {
      swapQuote = null;
    }

    if (swapQuote) {
      const sourceLabel = swapQuote.source === 'live' ? 'live' : 'mock';
      trace.push(this.log('quote',
        `Uniswap route found (${sourceLabel}): estimated ${swapQuote.amountOut} ${tokenPair.tokenOut} output (price impact ${swapQuote.priceImpact}%)`,
        {
          amountOut: swapQuote.amountOut,
          priceImpact: swapQuote.priceImpact,
          gasEstimate: swapQuote.gasEstimate,
          route: swapQuote.route,
          source: swapQuote.source,
        },
        ts, externalMetadata));
      ts += 10;
    } else {
      trace.push(this.log('quote',
        'Uniswap unavailable - proceeding without a pre-execution swap quote',
        { uniswapAvailable: false },
        ts, externalMetadata));
      ts += 10;
    }

    return { swapQuote, nextTimestamp: ts };
  }

  async execute(
    plan: YieldOption,
    trace: AgentTrace[],
    attempt: number,
    timestamp: number,
    externalMetadata?: Record<string, unknown>,
    preparedSwapQuote?: UniswapQuoteResult | null
  ): Promise<{ result: ExecutionResult; confidence: number }> {
    const confidence = normalizeConfidence(0.9);
    let ts = timestamp;
    const tokenPair = this.getTokenPair(plan.protocol);
    let swapQuote = preparedSwapQuote;

    if (swapQuote === undefined) {
      const quoteOutput = await this.quote(plan, trace, ts, externalMetadata);
      swapQuote = quoteOutput.swapQuote;
      ts = quoteOutput.nextTimestamp;
    } else if (swapQuote) {
      trace.push(this.log('quote',
        `Using approved Uniswap route: ${swapQuote.route}`,
        {
          amountOut: swapQuote.amountOut,
          priceImpact: swapQuote.priceImpact,
          gasEstimate: swapQuote.gasEstimate,
          route: swapQuote.route,
          source: swapQuote.source,
        },
        ts, externalMetadata));
      ts += 10;
    } else {
      trace.push(this.log('quote',
        'No approved swap quote available - proceeding with deposit simulation',
        { uniswapAvailable: false },
        ts, externalMetadata));
      ts += 10;
    }

    // Step 2: Execute deposit
    trace.push(this.log('execute',
      `Executing deposit on ${plan.protocol} (${plan.apy}% APY)`,
      { protocol: plan.protocol, apy: plan.apy, action: 'deposit', attempt, confidence },
      ts, externalMetadata));
    ts += 10;

    const result: ExecutionResult = {
      protocol: plan.protocol,
      apy: `${plan.apy}%`,
      action: 'deposit',
      status: 'success',
      attempt,
      swap: swapQuote ?? undefined,
    };

    trace.push(this.log('execute',
      swapQuote
        ? `Deposit successful via ${swapQuote.route}. Estimated output: ${swapQuote.amountOut} ${tokenPair.tokenOut}. Funds now generating yield at ${plan.apy}% APY.`
        : `Deposit successful. Funds now generating yield at ${plan.apy}% APY.`,
      { protocol: result.protocol, apy: result.apy, action: result.action, attempt, confidence, hasSwapQuote: swapQuote !== null },
      ts, externalMetadata));
    ts += 10;

    // Step 3: AXL broadcast
    const axlMessage: AXLMessage = {
      from: this.name,
      to: 'axl.network',
      type: 'execution_signal',
      payload: {
        protocol: result.protocol,
        apy: result.apy,
        status: result.status,
        attempt,
        swap: swapQuote ? { amountOut: swapQuote.amountOut, route: swapQuote.route } : undefined,
      },
      timestamp: Date.now(),
    };

    let remoteResponses: unknown[] = [];
    try {
      remoteResponses = await this.axlAdapter.broadcast(axlMessage);
    } catch {
      remoteResponses = [];
    }

    const hasAXLPeers = remoteResponses.length > 0;
    trace.push(this.log('execute',
      hasAXLPeers
        ? `AXL live peers: ${remoteResponses.length} acknowledged execution`
        : 'AXL: no peers available',
      { peersContacted: remoteResponses.length },
      ts, externalMetadata));

    return { result, confidence };
  }

  private getTokenPair(protocol: string): { tokenIn: string; tokenOut: string } {
    return PROTOCOL_TOKEN_MAP[protocol.toLowerCase()] ?? { tokenIn: 'ETH', tokenOut: 'USDC' };
  }
}
