import { describe, it, expect } from 'vitest';
import { ExecutionService } from '../orchestrator/ExecutionService';
import { YieldDataAdapter } from '../adapters/YieldDataAdapter';
import { UniswapAdapter } from '../adapters/UniswapAdapter';
import { RiskAgent } from '../agents/RiskAgent';
import { AgentTrace } from '../types';

const service = new ExecutionService();

// ─── SECTION 1: FULL PIPELINE VERIFICATION ───

describe('Audit S1: Full Pipeline', () => {
  it('should complete full pipeline and return valid response', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    // Response shape
    expect(typeof r.intent).toBe('string');
    expect(Array.isArray(r.trace)).toBe(true);
    expect(r.trace.length).toBeGreaterThanOrEqual(8);
    expect(typeof r.final_result.protocol).toBe('string');
    expect(r.final_result.apy).toMatch(/%$/);
    expect(['success', 'failed']).toContain(r.final_result.status);
    expect(typeof r.summary.explanation).toBe('string');
    expect(r.summary.explanation.length).toBeGreaterThan(10);
    expect(typeof r.summary.decisionImpact.ens).toBe('string');
    expect(typeof r.summary.decisionImpact.axl).toBe('string');
    expect(r.summary.confidence).toBeGreaterThan(0);
    expect(r.summary.confidence).toBeLessThanOrEqual(0.95);

    // All agents present
    const agents = new Set(r.trace.map((t) => t.agent));
    expect(agents.has('system.relayx.eth')).toBe(true);
    expect(agents.has('yield.relayx.eth')).toBe(true);
    expect(agents.has('risk.relayx.eth')).toBe(true);
    expect(agents.has('executor.relayx.eth')).toBe(true);

    // Timestamps increasing
    for (let i = 1; i < r.trace.length; i++) {
      expect(r.trace[i]!.timestamp).toBeGreaterThanOrEqual(r.trace[i - 1]!.timestamp);
    }
  });

  it('should include Uniswap quote in execution', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    const quoteTrace = r.trace.find((t) => t.step === 'quote');
    expect(quoteTrace).toBeDefined();
    expect(quoteTrace!.message).toContain('Uniswap');
  });
});

// ─── SECTION 2: EDGE CASE DESTRUCTION ───

describe('Audit S2: Edge Case Destruction', () => {
  it('unsupported asset defaults to ETH', async () => {
    const r = await service.execute({ intent: 'yield on DOGE' });
    expect(r.final_result.status).toBe('success');
    expect(r.trace.length).toBeGreaterThan(0);
  });

  it('extremely long intent does not crash', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH ' + 'x'.repeat(5000) });
    expect(r.final_result.status).toBe('success');
  });

  it('AXL unavailable still returns valid response with market data', async () => {
    // In test env: AXL is down, while DefiLlama and CoinGecko are fixture-backed upstream APIs.
    const r = await service.execute({ intent: 'get best yield on ETH' });
    expect(r.final_result.status).toBe('success');
    expect(r.trace.length).toBeGreaterThanOrEqual(8);
    expect(r.summary.explanation.length).toBeGreaterThan(0);
  });

  it('RiskAgent handles missing riskLevel', async () => {
    const agent = new RiskAgent();
    const trace: AgentTrace[] = [];
    const { result } = await agent.review({ protocol: 'X', apy: 3.0 }, trace, 1000);
    expect(result.decision).toBeDefined();
    expect(trace.length).toBeGreaterThan(0);
  });

  it('RiskAgent handles extreme APY values', async () => {
    const agent = new RiskAgent();
    const t1: AgentTrace[] = [];
    const { result: r1 } = await agent.review(
      { protocol: 'X', apy: 0, riskLevel: 'low' },
      t1,
      1000
    );
    expect(r1.decision).toBeDefined();

    const t2: AgentTrace[] = [];
    const { result: r2 } = await agent.review(
      { protocol: 'X', apy: 50, riskLevel: 'low' },
      t2,
      1000
    );
    expect(r2.decision).toBeDefined();

    const t3: AgentTrace[] = [];
    const { result: r3 } = await agent.review(
      { protocol: 'X', apy: -5, riskLevel: 'low' },
      t3,
      1000
    );
    expect(r3.decision).toBeDefined();
  });

  it('UniswapAdapter handles unknown tokens', async () => {
    const adapter = new UniswapAdapter();
    const quote = await adapter.getQuote({ tokenIn: 'FAKE', tokenOut: 'NOPE', amount: '1000' });
    expect(quote).toBeNull();
  });

  it('YieldDataAdapter handles unsupported asset', async () => {
    const adapter = new YieldDataAdapter();
    const options = await adapter.getYieldOptions('ZZZZNOTREAL');
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBe(0);
  });
});

// ─── SECTION 3: DETERMINISM + CONSISTENCY ───

describe('Audit S3: Determinism', () => {
  it('repeated runs produce consistent results with stable upstream data', async () => {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const r = await service.execute({ intent: 'get best yield on ETH' });
      results.push(r);
    }

    const protocols = results.map((r) => r.summary.finalProtocol);
    const retried = results.map((r) => r.summary.wasRetried);

    // All should be identical with deterministic fixtures.
    expect(new Set(protocols).size).toBe(1);
    expect(new Set(retried).size).toBe(1);
    console.log(`[CONSISTENCY CHECK] PASS — protocol: ${protocols[0]}, retried: ${retried[0]}`);
  });
});

// ─── SECTION 4: REAL DATA VALIDATION ───

describe('Audit S4: Real Data', () => {
  it('YieldDataAdapter returns data with valid APY range', async () => {
    const adapter = new YieldDataAdapter();
    const options = await adapter.getYieldOptions('ETH');
    for (const opt of options) {
      expect(opt.apy).toBeGreaterThan(0);
      expect(opt.apy).toBeLessThanOrEqual(50);
      expect(opt.protocol.length).toBeGreaterThan(0);
    }
  });

  it('UniswapAdapter returns quote with valid price impact', async () => {
    const adapter = new UniswapAdapter();
    const quote = await adapter.getQuote({
      tokenIn: 'ETH',
      tokenOut: 'USDC',
      amount: '1000000000000000000',
    });
    expect(quote).not.toBeNull();
    expect(quote!.priceImpact).toBeGreaterThanOrEqual(0);
    expect(quote!.priceImpact).toBeLessThanOrEqual(100);
  });
});

// ─── SECTION 5: TRACE QUALITY ───

describe('Audit S5: Trace Quality', () => {
  it('no trace entry has empty message', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    for (const e of r.trace) {
      expect(e.message.length).toBeGreaterThan(0);
      expect(e.agent.length).toBeGreaterThan(0);
      expect(e.step.length).toBeGreaterThan(0);
    }
  });

  it('trace messages explain WHY not just WHAT', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    // Should have explanatory messages, not just "executing"
    const hasExplanation = r.trace.some(
      (t) =>
        t.message.includes('due to') ||
        t.message.includes('Selected') ||
        t.message.includes('Approved') ||
        t.message.includes('Rejected') ||
        t.message.includes('Retrying')
    );
    expect(hasExplanation).toBe(true);
  });

  it('Uniswap trace includes route information', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    const uniTraces = r.trace.filter((t) => t.step === 'quote');
    expect(uniTraces.length).toBeGreaterThanOrEqual(2);
    // Second quote entry should have route details
    const routeTrace = uniTraces.find(
      (t) => t.message.includes('route') || t.message.includes('unavailable')
    );
    expect(routeTrace).toBeDefined();
  });
});

// ─── SECTION 8: SECURITY + SANITY ───

describe('Audit S8: Security + Sanity', () => {
  it('no undefined values in response fields', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    expect(r.intent).not.toBeUndefined();
    expect(r.trace).not.toBeUndefined();
    expect(r.final_result).not.toBeUndefined();
    expect(r.final_result.protocol).not.toBeUndefined();
    expect(r.final_result.apy).not.toBeUndefined();
    expect(r.final_result.status).not.toBeUndefined();
    expect(r.summary).not.toBeUndefined();
    expect(r.summary.explanation).not.toBeUndefined();
    expect(r.summary.decisionImpact).not.toBeUndefined();
    expect(r.summary.decisionImpact.ens).not.toBeUndefined();
    expect(r.summary.decisionImpact.axl).not.toBeUndefined();
  });

  it('no null values in required fields', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    expect(r.intent).not.toBeNull();
    expect(r.final_result.protocol).not.toBeNull();
    expect(r.final_result.apy).not.toBeNull();
    expect(r.summary.explanation).not.toBeNull();
  });

  it('confidence breakdown sums correctly', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });
    const debug = r.debug as Record<string, unknown>;
    const breakdown = debug.confidenceBreakdown as Record<string, number>;

    const avg =
      Math.round(
        (((breakdown.yield ?? 0) + (breakdown.risk ?? 0) + (breakdown.execution ?? 0)) / 3) * 100
      ) / 100;
    expect(r.summary.confidence).toBe(avg);
  });
});

// ─── SECTION 10: REAL WORLD USAGE ───

describe('Audit S10: Real World Intents', () => {
  const intents = [
    'get best yield on ETH',
    'safe yield for 1000 USDC',
    'low risk strategy',
    'highest return possible',
    'optimize yield considering safety',
  ];

  for (const intent of intents) {
    it(`handles: "${intent}"`, async () => {
      const r = await service.execute({ intent });
      expect(r.final_result.status).toBe('success');
      expect(r.final_result.protocol.length).toBeGreaterThan(0);
      expect(r.trace.length).toBeGreaterThanOrEqual(8);
      expect(r.summary.explanation.length).toBeGreaterThan(10);
    });
  }
});

// ─── SECTION 11: DEMO READINESS ───

describe('Audit S11: Demo Readiness', () => {
  it('pipeline shows retry + ENS + swap quote', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    // Retry visible
    expect(r.summary.wasRetried).toBe(true);
    const retryTrace = r.trace.find((t) => t.step === 'retry');
    expect(retryTrace).toBeDefined();

    // ENS visible
    const ensTrace = r.trace.find((t) => t.message.includes('ENS'));
    expect(ensTrace).toBeDefined();

    // Uniswap visible
    const uniTrace = r.trace.find((t) => t.step === 'quote');
    expect(uniTrace).toBeDefined();

    // Decision impact present
    expect(r.summary.decisionImpact.ens.length).toBeGreaterThan(0);
    expect(r.summary.decisionImpact.axl.length).toBeGreaterThan(0);
  });
});

// ─── SECTION 12: FINAL OUTPUT VALIDATION ───

describe('Audit S12: Output Contract', () => {
  it('every required field is present and valid', async () => {
    const r = await service.execute({ intent: 'get best yield on ETH' });

    // trace
    expect(Array.isArray(r.trace)).toBe(true);
    expect(r.trace.length).toBeGreaterThan(0);
    for (const e of r.trace) {
      expect(typeof e.agent).toBe('string');
      expect(typeof e.step).toBe('string');
      expect(typeof e.message).toBe('string');
      expect(typeof e.timestamp).toBe('number');
    }

    // final_result
    expect(typeof r.final_result.protocol).toBe('string');
    expect(r.final_result.protocol.length).toBeGreaterThan(0);
    expect(r.final_result.apy).toMatch(/%$/);
    expect(['success', 'failed']).toContain(r.final_result.status);
    expect(r.final_result.action).toBe('deposit');

    // summary
    expect(r.summary.selectedProtocol.length).toBeGreaterThan(0);
    expect(r.summary.initialProtocol.length).toBeGreaterThan(0);
    expect(r.summary.finalProtocol.length).toBeGreaterThan(0);
    expect(typeof r.summary.wasRetried).toBe('boolean');
    expect(typeof r.summary.totalSteps).toBe('number');
    expect(r.summary.totalSteps).toBeGreaterThan(0);
    expect(typeof r.summary.confidence).toBe('number');
    expect(r.summary.confidence).toBeGreaterThan(0);
    expect(r.summary.confidence).toBeLessThanOrEqual(0.95);
    expect(r.summary.explanation.length).toBeGreaterThan(10);
    expect(r.summary.decisionImpact.ens.length).toBeGreaterThan(0);
    expect(r.summary.decisionImpact.axl.length).toBeGreaterThan(0);

    // debug
    expect(r.debug).toBeDefined();
    const debug = r.debug as Record<string, unknown>;
    expect(typeof debug.attempts).toBe('number');
    expect(debug.ensReputationScore).toBeDefined();
    expect(debug.confidenceBreakdown).toBeDefined();
  });
});
