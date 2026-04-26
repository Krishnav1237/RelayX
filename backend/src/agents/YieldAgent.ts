import { BaseAgent } from './BaseAgent';
import { AgentTrace, YieldOption, YieldThinkResult } from '../types';

interface ProtocolComparison {
  protocol: string;
  apy: number;
  riskLevel: string;
  tradeOff: string;
}

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export class YieldAgent extends BaseAgent {
  private readonly options: YieldOption[] = [
    { protocol: 'Aave', apy: 4.2, riskLevel: 'low' },
    { protocol: 'Morpho', apy: 4.6, riskLevel: 'medium' },
    { protocol: 'Compound', apy: 3.8, riskLevel: 'low' },
  ];

  constructor() {
    super('yield.relay.eth', 'yield.relay.eth');
  }

  think(intent: string, attempt: number, trace: AgentTrace[], timestamp: number): YieldThinkResult {
    let ts = timestamp;

    // Step: analyze intent
    trace.push(this.log('analyze', `Analyzing user intent: "${intent}"`, { attempt }, ts));
    ts += 10;

    // Sort by APY descending for deterministic selection
    const sortedOptions = [...this.options].sort((a, b) => b.apy - a.apy);

    // Build comparison narrative
    const comparisons: ProtocolComparison[] = sortedOptions.map(opt => ({
      protocol: opt.protocol,
      apy: opt.apy,
      riskLevel: opt.riskLevel ?? 'unknown',
      tradeOff: opt.riskLevel === 'low' 
        ? 'lower risk, stable yield' 
        : opt.riskLevel === 'medium' 
          ? 'moderate risk, higher yield potential'
          : 'higher risk, highest yield potential',
    }));

    // Select based on attempt number
    const selectedIndex = Math.min(attempt - 1, sortedOptions.length - 1);
    const selectedOption = sortedOptions[selectedIndex]!;

    // Calculate confidence based on APY gap and attempt
    const maxApy = sortedOptions[0]!.apy;
    const minApy = sortedOptions[sortedOptions.length - 1]!.apy;
    const apyGap = maxApy - minApy;
    
    // Higher confidence on retry due to safer selection
    let baseConfidence = 0.7 + (apyGap / 10);
    if (attempt > 1) {
      baseConfidence += 0.05; // Slight boost for safer retry choice
    }
    const confidence = normalizeConfidence(Math.min(0.95, baseConfidence));

    // Build detailed reasoning
    const protocolList = comparisons
      .map(c => `${c.protocol} (${c.apy}%, ${c.riskLevel} risk)`)
      .join(', ');

    const reasoning = attempt === 1
      ? `Compared ${protocolList}. Selected ${selectedOption.protocol} due to highest yield of ${selectedOption.apy}% APY, despite ${selectedOption.riskLevel ?? 'unknown'} risk profile.`
      : `Retry attempt ${attempt}: Selected ${selectedOption.protocol} (${selectedOption.apy}% APY, ${selectedOption.riskLevel ?? 'unknown'} risk) as a safer alternative after initial rejection.`;

    // Step: evaluate options
    trace.push(this.log('evaluate', `Evaluating yield strategies across ${sortedOptions.length} protocols`, {
      options: sortedOptions.map(o => ({ protocol: o.protocol, apy: o.apy, riskLevel: o.riskLevel })),
      comparisons,
      confidence,
    }, ts));
    ts += 10;

    // Step: selection decision
    trace.push(this.log('evaluate', reasoning, {
      selectedOption,
      attempt,
      confidence,
    }, ts));

    return {
      options: sortedOptions,
      selectedOption,
      reasoning,
      attempt,
    };
  }
}
