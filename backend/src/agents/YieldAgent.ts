import { BaseAgent } from './BaseAgent';
import { AXLMessage, AgentTrace, YieldOption, YieldThinkResult } from '../types';
import { AXLAdapter } from '../adapters/AXLAdapter';

interface ProtocolComparison {
  protocol: string;
  apy: number;
  riskLevel: string;
  tradeOff: string;
}

function normalizeConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class YieldAgent extends BaseAgent {
  private readonly options: YieldOption[] = [
    { protocol: 'Aave', apy: 4.2, riskLevel: 'low' },
    { protocol: 'Morpho', apy: 4.6, riskLevel: 'medium' },
    { protocol: 'Compound', apy: 3.8, riskLevel: 'low' },
  ];
  private axlAdapter = new AXLAdapter();

  constructor() {
    super('yield.relay.eth', 'yield.relay.eth');
  }

  async think(
    intent: string,
    attempt: number,
    trace: AgentTrace[],
    timestamp: number,
    externalMetadata?: Record<string, unknown>
  ): Promise<YieldThinkResult & { confidence: number }> {
    let ts = timestamp;

    // Step: analyze intent
    trace.push(this.log('analyze', `Analyzing user intent: "${intent}"`, { attempt }, ts, externalMetadata));
    ts += 10;

    // Sort local options by APY descending
    const sortedLocalOptions = [...this.options].sort((a, b) => {
      if (b.apy !== a.apy) return b.apy - a.apy;
      return a.protocol.localeCompare(b.protocol);
    });

    const axlMessage: AXLMessage = {
      from: this.name,
      to: 'axl.network',
      type: 'yield_request',
      payload: { intent },
      timestamp: Date.now(),
    };

    trace.push(this.log('analyze', 'Broadcasting yield request to AXL network', {
      requestType: axlMessage.type,
    }, ts, externalMetadata));
    ts += 10;

    let remoteResponses: unknown[] = [];
    try {
      remoteResponses = await this.axlAdapter.broadcast(axlMessage);
    } catch (error) {
      console.error('[YieldAgent] AXL broadcast failed');
      console.error(error);
      remoteResponses = [];
    }

    const remoteOptions = this.extractRemoteOptions(remoteResponses);

    // Merge: local options take priority for same protocol name
    const sortedOptions = this.mergeAndSortOptions(sortedLocalOptions, remoteOptions);

    if (remoteOptions.length > 0) {
      trace.push(this.log('evaluate', `Received ${remoteOptions.length} external yield strategies via AXL`, {
        remoteProtocols: remoteOptions.map(o => o.protocol),
      }, ts, externalMetadata));
      ts += 10;
    }

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

    let baseConfidence = 0.7 + (apyGap / 10);
    if (attempt > 1) {
      baseConfidence += 0.05;
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
    }, ts, externalMetadata));
    ts += 10;

    // Step: selection decision
    trace.push(this.log('evaluate', reasoning, {
      selectedOption,
      attempt,
      confidence,
    }, ts, externalMetadata));

    return {
      options: sortedOptions,
      selectedOption,
      reasoning,
      attempt,
      confidence,
    };
  }

  private mergeAndSortOptions(localOptions: YieldOption[], remoteOptions: YieldOption[]): YieldOption[] {
    const mergedByProtocol = new Map<string, YieldOption>();

    // Local options go first — they take priority for same protocol
    for (const option of localOptions) {
      const key = option.protocol.trim().toLowerCase();
      mergedByProtocol.set(key, option);
    }

    // Remote options only added if protocol doesn't already exist
    for (const option of remoteOptions) {
      const key = option.protocol.trim().toLowerCase();
      if (!mergedByProtocol.has(key)) {
        mergedByProtocol.set(key, option);
      }
    }

    return [...mergedByProtocol.values()].sort((a, b) => {
      if (b.apy !== a.apy) return b.apy - a.apy;
      return a.protocol.localeCompare(b.protocol);
    });
  }

  private extractRemoteOptions(responses: unknown[]): YieldOption[] {
    const extracted: YieldOption[] = [];

    for (const response of responses) {
      if (!isRecord(response)) continue;

      const optionCandidates: unknown[] = [];

      if (response.option) optionCandidates.push(response.option);
      if (Array.isArray(response.options)) optionCandidates.push(...response.options);
      if (isRecord(response.payload)) {
        if (response.payload.option) optionCandidates.push(response.payload.option);
        if (Array.isArray(response.payload.options)) optionCandidates.push(...response.payload.options);
      }

      for (const candidate of optionCandidates) {
        const parsed = this.parseYieldOption(candidate);
        if (parsed) extracted.push(parsed);
      }
    }

    return extracted;
  }

  private parseYieldOption(value: unknown): YieldOption | null {
    if (!isRecord(value)) return null;

    if (typeof value.protocol !== 'string' || typeof value.apy !== 'number') return null;

    const normalizedProtocol = value.protocol.trim();
    if (!normalizedProtocol) return null;

    const riskLevel = value.riskLevel;
    const normalizedRiskLevel =
      riskLevel === 'low' || riskLevel === 'medium' || riskLevel === 'high'
        ? riskLevel
        : undefined;

    return {
      protocol: normalizedProtocol,
      apy: value.apy,
      riskLevel: normalizedRiskLevel,
    };
  }
}
