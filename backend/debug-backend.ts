/**
 * Debug script to test backend startup without full execution
 */

import dotenv from 'dotenv';
dotenv.config();

console.log('═══════════════════════════════════════════════════════');
console.log('🔍 BACKEND DEBUG');
console.log('═══════════════════════════════════════════════════════');
console.log('');

// Test 1: Environment variables
console.log('📋 Step 1: Checking environment variables...');
console.log('   GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✓ Set' : '✗ Not set');
console.log('   GROQ_MODEL:', process.env.GROQ_MODEL || 'llama-3.1-8b-instant (default)');
console.log('   PORT:', process.env.PORT || '3001 (default)');
console.log('   FRONTEND_URL:', process.env.FRONTEND_URL || '* (default)');
console.log('');

// Test 2: Import modules
console.log('📦 Step 2: Testing module imports...');
try {
  const { ExecutionService } = await import('./src/orchestrator/ExecutionService.js');
  console.log('   ✓ ExecutionService imported');
  
  const { ENSAdapter } = await import('./src/adapters/ENSAdapter.js');
  console.log('   ✓ ENSAdapter imported');
  
  const { YieldDataAdapter } = await import('./src/adapters/YieldDataAdapter.js');
  console.log('   ✓ YieldDataAdapter imported');
  
  const { AXLAdapter } = await import('./src/adapters/AXLAdapter.js');
  console.log('   ✓ AXLAdapter imported');
  
  const { UniswapAdapter } = await import('./src/adapters/UniswapAdapter.js');
  console.log('   ✓ UniswapAdapter imported');
  
  const { ZeroGMemoryAdapter } = await import('./src/adapters/ZeroGMemoryAdapter.js');
  console.log('   ✓ ZeroGMemoryAdapter imported');
  
  const { ReasoningAdapter } = await import('./src/adapters/ReasoningAdapter.js');
  console.log('   ✓ ReasoningAdapter imported');
  
  console.log('');
  console.log('✅ All modules imported successfully!');
  console.log('');
  
  // Test 3: Create instances
  console.log('🏗️  Step 3: Creating adapter instances...');
  const executionService = new ExecutionService();
  console.log('   ✓ ExecutionService created');
  
  const ensAdapter = new ENSAdapter();
  console.log('   ✓ ENSAdapter created');
  
  const yieldAdapter = new YieldDataAdapter();
  console.log('   ✓ YieldDataAdapter created');
  
  const axlAdapter = new AXLAdapter();
  console.log('   ✓ AXLAdapter created');
  
  const uniswapAdapter = new UniswapAdapter();
  console.log('   ✓ UniswapAdapter created');
  
  const memoryAdapter = new ZeroGMemoryAdapter();
  console.log('   ✓ ZeroGMemoryAdapter created');
  
  const reasoningAdapter = new ReasoningAdapter();
  console.log('   ✓ ReasoningAdapter created');
  console.log('   LLM enabled:', reasoningAdapter.isEnabled());
  
  console.log('');
  console.log('✅ All adapters created successfully!');
  console.log('');
  
  // Test 4: Quick health checks
  console.log('🏥 Step 4: Running quick health checks...');
  
  try {
    const axlHealth = await axlAdapter.getHealth();
    console.log('   ✓ AXL:', axlHealth.status);
  } catch (e) {
    console.log('   ✗ AXL:', e instanceof Error ? e.message : String(e));
  }
  
  try {
    const uniswapHealth = await uniswapAdapter.getHealthStatus();
    console.log('   ✓ Uniswap:', uniswapHealth.status);
  } catch (e) {
    console.log('   ✗ Uniswap:', e instanceof Error ? e.message : String(e));
  }
  
  try {
    const memoryStatus = await memoryAdapter.getStatus();
    console.log('   ✓ Memory:', memoryStatus.status);
  } catch (e) {
    console.log('   ✗ Memory:', e instanceof Error ? e.message : String(e));
  }
  
  try {
    const ensAddress = await ensAdapter.resolveName('vitalik.eth');
    console.log('   ✓ ENS:', ensAddress ? 'resolved' : 'fallback');
  } catch (e) {
    console.log('   ✗ ENS:', e instanceof Error ? e.message : String(e));
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ BACKEND DEBUG COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('The backend should be able to start successfully.');
  console.log('If the backend is still crashing, check:');
  console.log('1. Kill any existing node processes');
  console.log('2. Clear the dist/ folder and rebuild: npm run build');
  console.log('3. Check for syntax errors in TypeScript files');
  console.log('');
  
} catch (error) {
  console.error('');
  console.error('═══════════════════════════════════════════════════════');
  console.error('❌ BACKEND DEBUG FAILED');
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
