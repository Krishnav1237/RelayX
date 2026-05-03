/**
 * Real Transaction Test Script
 * 
 * This script tests the complete execution flow with a VERY small ETH amount.
 * It will:
 * 1. Submit an intent to the backend
 * 2. Get the execution plan with swap calldata
 * 3. Show the transaction details
 * 4. Optionally execute the transaction (requires MetaMask)
 * 
 * Usage:
 *   npm run test:transaction
 */

import dotenv from 'dotenv';
dotenv.config();

const BACKEND_URL = 'http://localhost:3001';
const TEST_WALLET = process.env.TEST_WALLET_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'; // vitalik.eth
const VERY_SMALL_AMOUNT = '10000000000000000'; // 0.01 ETH in wei

interface ExecutionResponse {
  sessionId: string;
  intent: string;
  trace: any[];
  final_result: {
    protocol: string;
    apy: string;
    action: string;
    status: string;
    swap?: {
      amountOut: string;
      priceImpact: number;
      gasEstimate: string;
      route: string;
      source: string;
      calldata?: {
        to: string;
        data: string;
        value: string;
        gasEstimate: string;
        tokenIn: string;
        tokenOut: string;
        amountOut: string;
        router: string;
        deadline: number;
      };
    };
  };
  summary: {
    selectedProtocol: string;
    finalProtocol: string;
    confidence: number;
    explanation: string;
  };
  approval?: {
    id: string;
    expiresAt: number;
  };
}

async function testRealTransaction() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 REAL TRANSACTION TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  WARNING: This will prepare a REAL transaction!');
  console.log('   Amount: 0.01 ETH (~$30 USD)');
  console.log('   Network: Sepolia Testnet');
  console.log('   Wallet:', TEST_WALLET);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  try {
    // Step 1: Check backend health
    console.log('📡 Step 1: Checking backend health...');
    const healthRes = await fetch(`${BACKEND_URL}/health`);
    if (!healthRes.ok) {
      throw new Error('Backend is not running! Start it with: npm run dev:full');
    }
    const health = await healthRes.json();
    console.log('✅ Backend is healthy');
    console.log('   Chain:', health.chain);
    console.log('   Chain ID:', health.chainId);
    console.log('');

    // Step 2: Submit intent with wallet address
    console.log('📝 Step 2: Submitting intent to backend...');
    console.log('   Intent: "get best yield on 0.01 ETH"');
    console.log('   Wallet:', TEST_WALLET);
    console.log('   Timeout: 60 seconds');
    console.log('');

    // Create abort controller with 60 second timeout (LLM calls can take time)
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.error('⏱️  Request timed out after 60 seconds!');
      controller.abort();
    }, 60000);

    try {
      const analyzeRes = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'get best yield on 0.01 ETH',
          context: {
            wallet: TEST_WALLET,
            debug: true,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!analyzeRes.ok) {
        const error = await analyzeRes.text();
        throw new Error(`Backend error: ${error}`);
      }

      const response: ExecutionResponse = await analyzeRes.json();
      console.log('✅ Analysis complete!');
      console.log('');
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out after 60 seconds. Check backend logs for details.');
      }
      throw error;
    }

    // Step 3: Display results
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 EXECUTION PLAN');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Protocol:', response.summary.finalProtocol || response.final_result.protocol);
    console.log('APY:', response.final_result.apy);
    console.log('Confidence:', `${(response.summary.confidence * 100).toFixed(0)}%`);
    console.log('Status:', response.final_result.status);
    console.log('');
    console.log('Explanation:');
    console.log(response.summary.explanation);
    console.log('');

    // Step 4: Check for swap details
    if (response.final_result.swap) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('💱 SWAP DETAILS');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('Route:', response.final_result.swap.route);
      console.log('Amount Out:', response.final_result.swap.amountOut);
      console.log('Price Impact:', `${response.final_result.swap.priceImpact}%`);
      console.log('Gas Estimate:', response.final_result.swap.gasEstimate);
      console.log('Source:', response.final_result.swap.source);
      console.log('');

      // Step 5: Check for calldata
      if (response.final_result.swap.calldata) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔐 TRANSACTION CALLDATA (READY FOR METAMASK)');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        const calldata = response.final_result.swap.calldata;
        console.log('To (Router):', calldata.to);
        console.log('Value (ETH):', `${parseInt(calldata.value) / 1e18} ETH`);
        console.log('Gas Estimate:', calldata.gasEstimate);
        console.log('Token In:', calldata.tokenIn);
        console.log('Token Out:', calldata.tokenOut);
        console.log('Expected Out:', calldata.amountOut);
        console.log('Deadline:', new Date(calldata.deadline * 1000).toLocaleString());
        console.log('');
        console.log('Calldata (first 100 chars):', calldata.data.substring(0, 100) + '...');
        console.log('');

        // Calculate total cost
        const ethValue = parseInt(calldata.value) / 1e18;
        const estimatedGas = parseInt(calldata.gasEstimate);
        const gasPrice = 20; // gwei (estimate)
        const gasCost = (estimatedGas * gasPrice) / 1e9;
        const totalCost = ethValue + gasCost;

        console.log('═══════════════════════════════════════════════════════');
        console.log('💰 COST BREAKDOWN');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        console.log('ETH to swap:', `${ethValue.toFixed(6)} ETH`);
        console.log('Estimated gas:', `${gasCost.toFixed(6)} ETH (${estimatedGas} gas @ ${gasPrice} gwei)`);
        console.log('Total cost:', `${totalCost.toFixed(6)} ETH`);
        console.log('');

        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ TEST SUCCESSFUL!');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        console.log('The transaction is ready to be executed.');
        console.log('');
        console.log('To execute this transaction:');
        console.log('1. Open the frontend: http://localhost:3000/dashboard');
        console.log('2. Connect your MetaMask wallet');
        console.log('3. Submit the same intent: "get best yield on 0.01 ETH"');
        console.log('4. Click "Approve & Execute"');
        console.log('5. Confirm in MetaMask');
        console.log('');
        console.log('Your tokens will be deducted and the swap will execute!');
        console.log('');

        // Check if approval is required
        if (response.approval) {
          console.log('⏳ Approval ID:', response.approval.id);
          console.log('⏳ Expires at:', new Date(response.approval.expiresAt).toLocaleString());
          console.log('');
          console.log('To confirm this execution, call:');
          console.log(`POST ${BACKEND_URL}/execute/confirm`);
          console.log(`Body: { "approvalId": "${response.approval.id}" }`);
          console.log('');
        }

      } else {
        console.log('⚠️  No calldata generated!');
        console.log('');
        console.log('Possible reasons:');
        console.log('- Quote source is cache/fallback without rawAmountOut');
        console.log('- Wallet address not provided');
        console.log('- Token addresses could not be resolved');
        console.log('');
        console.log('Swap details:', JSON.stringify(response.final_result.swap, null, 2));
      }
    } else {
      console.log('⚠️  No swap details in response!');
      console.log('');
      console.log('This might be a direct deposit without a swap.');
      console.log('');
    }

    // Step 6: Show trace summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 EXECUTION TRACE SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log(`Total steps: ${response.trace.length}`);
    console.log('');
    
    const agentCounts: Record<string, number> = {};
    response.trace.forEach(t => {
      const agent = t.agent || 'unknown';
      agentCounts[agent] = (agentCounts[agent] || 0) + 1;
    });
    
    console.log('Steps by agent:');
    Object.entries(agentCounts).forEach(([agent, count]) => {
      console.log(`  ${agent}: ${count} steps`);
    });
    console.log('');

    // Show last 5 traces
    console.log('Last 5 trace entries:');
    response.trace.slice(-5).forEach((t, i) => {
      console.log(`  ${i + 1}. [${t.agent}] ${t.step}: ${t.message.substring(0, 80)}${t.message.length > 80 ? '...' : ''}`);
    });
    console.log('');

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ TEST FAILED');
    console.error('═══════════════════════════════════════════════════════');
    console.error('');
    if (error instanceof Error) {
      console.error('Error:', error.message);
      if (error.stack) {
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('Error:', error);
    }
    console.error('');
    process.exit(1);
  }
}

// Run the test
testRealTransaction();
