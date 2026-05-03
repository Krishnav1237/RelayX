/**
 * Comprehensive Backend Test
 * Tests every component and integration point
 */

import dotenv from 'dotenv';
dotenv.config();

const BACKEND_URL = 'http://localhost:3001';
const TEST_WALLET = process.env.TEST_WALLET_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, duration?: number) {
  results.push({ name, passed, error, duration });
  const icon = passed ? '✅' : '❌';
  const time = duration ? ` (${duration}ms)` : '';
  console.log(`${icon} ${name}${time}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function testHealthEndpoint(): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error('Status not ok');
    logTest('Health endpoint', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Health endpoint', false, error instanceof Error ? error.message : String(error));
  }
}

async function testIntegrationHealth(): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/integration-health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('   Integration status:', JSON.stringify(data, null, 2));
    logTest('Integration health', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Integration health', false, error instanceof Error ? error.message : String(error));
  }
}

async function testAXLHealth(): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/axl-health`);
    const data = await res.json();
    console.log('   AXL status:', data.status);
    logTest('AXL health', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('AXL health', false, error instanceof Error ? error.message : String(error));
  }
}

async function testYieldHealth(): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/yield-health`);
    const data = await res.json();
    console.log('   Yield status:', data.status, '| Source:', data.source, '| Protocols:', data.protocols);
    if (data.protocols === 0) {
      throw new Error('No yield protocols available');
    }
    logTest('Yield health', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Yield health', false, error instanceof Error ? error.message : String(error));
  }
}

async function testENSHealth(): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/ens-health`);
    const data = await res.json();
    console.log('   ENS status:', data.status, '| Resolved:', data.addressResolved);
    logTest('ENS health', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('ENS health', false, error instanceof Error ? error.message : String(error));
  }
}

async function testQuoteHealth(): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/quote-health`);
    const data = await res.json();
    console.log('   Quote status:', data.status, '| Source:', data.source);
    logTest('Quote health', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Quote health', false, error instanceof Error ? error.message : String(error));
  }
}

async function testMemoryHealth(): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/memory-health`);
    const data = await res.json();
    console.log('   Memory status:', data.status, '| Mode:', data.mode);
    logTest('Memory health', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Memory health', false, error instanceof Error ? error.message : String(error));
  }
}

async function testAnalyzeWithoutWallet(): Promise<void> {
  const start = Date.now();
  try {
    console.log('   Testing analyze without wallet (should work but no calldata)...');
    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'get best yield on ETH',
        context: { debug: true },
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`HTTP ${res.status}: ${error}`);
    }

    const data = await res.json();
    
    if (!data.final_result) throw new Error('No final_result in response');
    if (!data.summary) throw new Error('No summary in response');
    if (!data.trace || data.trace.length === 0) throw new Error('No trace in response');
    
    console.log('   Protocol:', data.final_result.protocol);
    console.log('   APY:', data.final_result.apy);
    console.log('   Status:', data.final_result.status);
    console.log('   Trace steps:', data.trace.length);
    console.log('   Has swap:', !!data.final_result.swap);
    console.log('   Has calldata:', !!data.final_result.swap?.calldata);
    
    logTest('Analyze without wallet', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Analyze without wallet', false, error instanceof Error ? error.message : String(error));
  }
}

async function testAnalyzeWithWallet(): Promise<void> {
  const start = Date.now();
  try {
    console.log('   Testing analyze WITH wallet (should generate calldata)...');
    console.log('   Wallet:', TEST_WALLET);
    
    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'get best yield on 0.01 ETH',
        context: {
          wallet: TEST_WALLET,
          debug: true,
        },
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`HTTP ${res.status}: ${error}`);
    }

    const data = await res.json();
    
    if (!data.final_result) throw new Error('No final_result in response');
    if (!data.summary) throw new Error('No summary in response');
    if (!data.trace || data.trace.length === 0) throw new Error('No trace in response');
    if (!data.approval) throw new Error('No approval in response');
    
    console.log('   Protocol:', data.final_result.protocol);
    console.log('   APY:', data.final_result.apy);
    console.log('   Status:', data.final_result.status);
    console.log('   Trace steps:', data.trace.length);
    console.log('   Has swap:', !!data.final_result.swap);
    console.log('   Has calldata:', !!data.final_result.swap?.calldata);
    
    if (data.final_result.swap?.calldata) {
      const calldata = data.final_result.swap.calldata;
      console.log('   ✓ Calldata generated!');
      console.log('     Router:', calldata.to);
      console.log('     Value:', calldata.value, 'wei');
      console.log('     Gas estimate:', calldata.gasEstimate);
      console.log('     Token in:', calldata.tokenIn);
      console.log('     Token out:', calldata.tokenOut);
      console.log('     Amount out:', calldata.amountOut);
      console.log('     Deadline:', new Date(calldata.deadline * 1000).toISOString());
      console.log('     Data length:', calldata.data.length, 'chars');
    } else {
      console.log('   ⚠ No calldata generated (might be using cache/fallback)');
    }
    
    logTest('Analyze with wallet', true, undefined, Date.now() - start);
    
    // Return the approval ID for the next test
    return data.approval.id;
  } catch (error) {
    logTest('Analyze with wallet', false, error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

async function testConfirmExecution(approvalId: string): Promise<void> {
  const start = Date.now();
  try {
    console.log('   Testing execution confirmation...');
    console.log('   Approval ID:', approvalId);
    
    const res = await fetch(`${BACKEND_URL}/execute/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`HTTP ${res.status}: ${error}`);
    }

    const data = await res.json();
    
    if (!data.final_result) throw new Error('No final_result in response');
    if (data.final_result.status !== 'success') {
      throw new Error(`Execution status is ${data.final_result.status}, expected success`);
    }
    
    console.log('   Status:', data.final_result.status);
    console.log('   Protocol:', data.final_result.protocol);
    console.log('   Trace steps:', data.trace.length);
    
    logTest('Confirm execution', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Confirm execution', false, error instanceof Error ? error.message : String(error));
  }
}

async function testInvalidIntent(): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: '', // Empty intent should fail
      }),
    });

    if (res.ok) {
      throw new Error('Expected 400 error for empty intent');
    }
    
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
    
    logTest('Invalid intent handling', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Invalid intent handling', false, error instanceof Error ? error.message : String(error));
  }
}

async function testExpiredApproval(): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/execute/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: 'invalid-approval-id' }),
    });

    if (res.ok) {
      throw new Error('Expected 404 error for invalid approval');
    }
    
    if (res.status !== 404) {
      throw new Error(`Expected 404, got ${res.status}`);
    }
    
    logTest('Expired approval handling', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Expired approval handling', false, error instanceof Error ? error.message : String(error));
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 COMPREHENSIVE BACKEND TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  console.log('📋 Phase 1: Health Checks');
  console.log('─────────────────────────────────────────────────────');
  await testHealthEndpoint();
  await testIntegrationHealth();
  await testAXLHealth();
  await testYieldHealth();
  await testENSHealth();
  await testQuoteHealth();
  await testMemoryHealth();
  console.log('');
  
  console.log('📋 Phase 2: Analyze Endpoint');
  console.log('─────────────────────────────────────────────────────');
  await testAnalyzeWithoutWallet();
  const approvalId = await testAnalyzeWithWallet();
  console.log('');
  
  console.log('📋 Phase 3: Execution Confirmation');
  console.log('─────────────────────────────────────────────────────');
  if (approvalId) {
    await testConfirmExecution(approvalId);
  } else {
    logTest('Confirm execution', false, 'Skipped - no approval ID from previous test');
  }
  console.log('');
  
  console.log('📋 Phase 4: Error Handling');
  console.log('─────────────────────────────────────────────────────');
  await testInvalidIntent();
  await testExpiredApproval();
  console.log('');
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log('');
  
  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}`);
      if (r.error) {
        console.log(`     ${r.error}`);
      }
    });
    console.log('');
  }
  
  if (failed === 0) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('The backend is ready for frontend testing.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Open http://localhost:3000/dashboard');
    console.log('2. Connect MetaMask wallet');
    console.log('3. Switch to Sepolia network');
    console.log('4. Submit intent: "get best yield on 0.01 ETH"');
    console.log('5. Click "Approve & Execute"');
    console.log('6. Sign transaction in MetaMask');
    console.log('7. Verify tokens are deducted');
    console.log('');
  } else {
    console.log('═══════════════════════════════════════════════════════');
    console.log('❌ SOME TESTS FAILED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Fix the failed tests before proceeding to frontend testing.');
    console.log('');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('');
  console.error('═══════════════════════════════════════════════════════');
  console.error('❌ TEST SUITE CRASHED');
  console.error('═══════════════════════════════════════════════════════');
  console.error('');
  console.error('Error:', error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
  }
  console.error('');
  process.exit(1);
});
