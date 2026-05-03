import { BaseAgent } from './BaseAgent.js';
import { AXLMessage, AgentTrace, ExecutionResult, UniswapQuoteResult, YieldOption } from '../types/index.js';
import { AXLAdapter } from '../adapters/AXLAdapter.js';
import { UniswapAdapter } from '../adapters/UniswapAdapter.js';
import { getAgentEnsName } from '../config/agents.js';
import { getQuoteChainId } from '../config/chain.js';

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

// Map protocol names to token pairs for Uniswap quoting
const PROTOCOL_TOKEN_MAP: Record<string, { tokenIn: string; tokenOut: string }> = {
  aave: { tokenIn: 'ETH', tokenOut: 'USDC' },
  compound: { tokenIn: 'ETH', tokenOut: 'USDC' },
  morpho: { tokenIn: 'ETH', tokenOut: 'USDC' },
  spark: { tokenIn: 'ETH', tokenOut: 'DAI' },
  lido: { tokenIn: 'ETH', tokenOut: 'USDC' },
};

export class ExecutorAgent extends BaseAgent {
  private axlAdapter = new AXLAdapter();
  private uniswapAdapter = new UniswapAdapter();

  constructor() {
    const agentName = getAgentEnsName('executor');
    super(agentName, agentName);
  }

  async quote(
    plan: YieldOption,
    trace: AgentTrace[],
    timestamp: number,
    externalMetadata?: Record<string, unknown>
  ): Promise<{ swapQuote: UniswapQuoteResult | null; nextTimestamp: number }> {
    let ts = timestamp;
    const tokenPair = this.getTokenPair(plan.protocol);

    trace.push(
      this.log(
        'quote',
        `Fetching swap route from Uniswap for ${tokenPair.tokenIn} -> ${tokenPair.tokenOut}`,
        {
          tokenIn: tokenPair.tokenIn,
          tokenOut: tokenPair.tokenOut,
          protocol: plan.protocol,
          chainId: getQuoteChainId(),
        },
        ts,
        externalMetadata
      )
    );
    ts += 10;

    let swapQuote: UniswapQuoteResult | null = null;
    try {
      swapQuote = await this.uniswapAdapter.getQuote({
        tokenIn: tokenPair.tokenIn,
        tokenOut: tokenPair.tokenOut,
        amount: '1000000000000000000', // 1 ETH in wei
        chainId: getQuoteChainId(),
      });
    } catch {
      swapQuote = null;
    }

      trace.push(
        this.log(
          'quote',
          swapQuote
            ? `Swap route found via ${swapQuote.source}: estimated ${swapQuote.amountOut} ${tokenPair.tokenOut} output (price impact: ${swapQuote.priceImpact.toFixed(2)}%)`
            : '[UNISWAP] Fallback used — on-chain quote unavailable, proceeding without swap pre-quote',
          swapQuote
            ? {
                amountOut: swapQuote.amountOut,
                priceImpact: swapQuote.priceImpact,
                gasEstimate: swapQuote.gasEstimate,
                route: swapQuote.route,
                source: swapQuote.source,
              }
            : { uniswapAvailable: false },
          ts,
          externalMetadata
        )
      );
      ts += 10;

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
    let baseExecConfidence = 0.85;
    if (attempt > 1) baseExecConfidence -= 0.1;
    if (plan.riskLevel === 'low') baseExecConfidence += 0.05;
    if (preparedSwapQuote) baseExecConfidence += 0.05;
    const confidence = normalizeConfidence(Math.min(0.95, Math.max(0, baseExecConfidence)));
    let ts = timestamp;
    const tokenPair = this.getTokenPair(plan.protocol);
    let swapQuote = preparedSwapQuote;

    if (swapQuote === undefined) {
      const quoteOutput = await this.quote(plan, trace, ts, externalMetadata);
      swapQuote = quoteOutput.swapQuote;
      ts = quoteOutput.nextTimestamp;
    } else if (swapQuote) {
      trace.push(
        this.log(
          'quote',
          `Using approved Uniswap route: ${swapQuote.route}`,
          {
            amountOut: swapQuote.amountOut,
            priceImpact: swapQuote.priceImpact,
            gasEstimate: swapQuote.gasEstimate,
            route: swapQuote.route,
            source: swapQuote.source,
          },
          ts,
          externalMetadata
        )
      );
      ts += 10;
    } else {
      trace.push(
        this.log(
          'quote',
          'No approved swap quote available - proceeding with deposit simulation',
          { uniswapAvailable: false },
          ts,
          externalMetadata
        )
      );
      ts += 10;
    }

    // Step 2: Execute deposit
    trace.push(
      this.log(
        'execute',
        `Executing deposit on ${plan.protocol} (${plan.apy}% APY)`,
        { protocol: plan.protocol, apy: plan.apy, action: 'deposit', attempt, confidence },
        ts,
        externalMetadata
      )
    );
    ts += 10;

    const result: ExecutionResult = {
      protocol: plan.protocol,
      apy: `${plan.apy}%`,
      action: 'deposit',
      status: 'success',
      attempt,
      swap: swapQuote ?? undefined,
      executionMode: 'prepared',
    };

    // Trace: clearly state what happened and that user signature is required
    const finalMsg = swapQuote
      ? `Prepared swap transaction via Uniswap (awaiting user signature) — estimated ${swapQuote.amountOut} ${tokenPair.tokenOut} via ${swapQuote.route}`
      : `Prepared deposit on ${plan.protocol} at ${plan.apy}% APY (no swap quote available — will use direct deposit)`;
    trace.push(
      this.log(
        'execute',
        finalMsg,
        {
          protocol: result.protocol,
          apy: result.apy,
          action: result.action,
          attempt,
          confidence,
          executionMode: 'prepared',
          hasSwapQuote: swapQuote !== null,
        },
        ts,
        externalMetadata
      )
    );
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
    trace.push(
      this.log(
        'execute',
        hasAXLPeers
          ? `AXL live peers: ${remoteResponses.length} peer(s) acknowledged execution signal`
          : 'AXL unavailable — proceeding with local decision (no network influence)',
        { peersContacted: remoteResponses.length },
        ts,
        externalMetadata
      )
    );

    return { result, confidence };
  }

  private getTokenPair(protocol: string): { tokenIn: string; tokenOut: string } {
    return PROTOCOL_TOKEN_MAP[protocol.toLowerCase()] ?? { tokenIn: 'ETH', tokenOut: 'USDC' };
  }
}
