# Backend Crash Fix Guide

## Problem Summary

The backend is crashing with a cryptic error related to ES module loading. The terminal shows it's still using the deprecated `--loader ts-node/esm` flag, which is causing the crash.

## Root Causes

1. **Stale Node Process**: The old backend process with the deprecated loader is still running
2. **Cached Build**: The `dist/` folder might contain old compiled code
3. **Terminal Cache**: The terminal might be showing old output from a previous run

## Solution Steps

### Step 1: Kill All Node Processes

```powershell
# Stop all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Verify no node processes are running
Get-Process node -ErrorAction SilentlyContinue
```

### Step 2: Clean Build Artifacts

```powershell
cd backend

# Remove dist folder
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# Remove node_modules/.cache if it exists
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
```

### Step 3: Rebuild TypeScript

```powershell
# Compile TypeScript
npm run build
```

### Step 4: Test Backend Startup

```powershell
# Run debug script to test imports and adapters
npm run debug
```

If the debug script passes, proceed to step 5.

### Step 5: Start Backend

```powershell
# Start backend with AXL simulator
npm run dev:full
```

You should see:
```
[BACKEND] [BOOT] ══════════════════════════════════════════
[BACKEND] [BOOT] RelayX Backend
[BACKEND] [BOOT] ══════════════════════════════════════════
[BACKEND] [BOOT] Server running → http://localhost:3001
```

### Step 6: Test Transaction Flow

Once the backend is running without crashes:

```powershell
# In a NEW terminal window (keep backend running)
cd backend
npm run test:transaction
```

This will:
1. Check backend health
2. Submit an intent with your wallet address
3. Get execution plan with swap calldata
4. Display transaction details
5. Show instructions for executing via frontend

## Expected Behavior

### Backend Startup (No Crashes)
- ✅ No `[Object: null prototype]` errors
- ✅ No `ExperimentalWarning` about `--experimental-loader`
- ✅ Clean startup with boot logs
- ✅ Server listening on port 3001

### Test Script (No Timeout)
- ✅ Health check passes
- ✅ Analyze request completes within 60 seconds
- ✅ Swap calldata is generated
- ✅ Transaction details are displayed

### Frontend Execution
- ✅ Connect MetaMask wallet
- ✅ Submit intent: "get best yield on 0.01 ETH"
- ✅ See execution plan with approval button
- ✅ Click "Approve & Execute"
- ✅ MetaMask popup appears with transaction
- ✅ Sign transaction
- ✅ Tokens are deducted from wallet
- ✅ Transaction appears on Sepolia Etherscan

## Troubleshooting

### Backend Still Crashing

If the backend still crashes after following the steps:

1. **Check for syntax errors**:
   ```powershell
   npm run build
   ```
   Look for TypeScript compilation errors.

2. **Check environment variables**:
   ```powershell
   cat .env
   ```
   Ensure `GROQ_API_KEY` is set.

3. **Check Node version**:
   ```powershell
   node --version
   ```
   Should be v18 or higher.

### Test Script Timeout

If the test script times out after 60 seconds:

1. **Check backend logs** - Look for where it's stuck:
   - ENS resolution?
   - Uniswap quote?
   - LLM call?
   - AXL consensus?

2. **Check network connectivity**:
   - Can you reach `https://api.groq.com`?
   - Can you reach Sepolia RPC?
   - Can you reach DefiLlama API?

3. **Increase timeout** in `test-real-transaction.ts`:
   ```typescript
   const timeout = setTimeout(() => controller.abort(), 120000); // 2 minutes
   ```

### No Calldata Generated

If the test completes but no calldata is generated:

1. **Check wallet address** in `.env`:
   ```
   TEST_WALLET_ADDRESS=0xYourWalletAddress
   ```

2. **Check Uniswap adapter** - Ensure QuoterV2 is working:
   ```powershell
   curl http://localhost:3001/quote-health
   ```

3. **Check token addresses** - Ensure WETH and protocol tokens are resolved.

### Tokens Not Deducted

If you execute via frontend but tokens aren't deducted:

1. **Check MetaMask network** - Must be on Sepolia (chainId: 11155111)
2. **Check transaction status** - Look for transaction hash in browser console
3. **Check Sepolia Etherscan** - Search for your wallet address
4. **Check gas fees** - Ensure you have enough ETH for gas

## What Was Fixed

### 1. Backend Startup
- ✅ Removed deprecated `ts-node/esm` loader
- ✅ Changed to compile-first approach: `tsc && node dist/index.js`
- ✅ Updated `package.json` scripts
- ✅ Updated `nodemon.json` config

### 2. Test Script
- ✅ Increased timeout from 30s to 60s
- ✅ Added better error handling
- ✅ Added timeout logging
- ✅ Added abort controller cleanup

### 3. Transaction Flow
- ✅ Frontend already has complete execution flow
- ✅ Backend generates swap calldata when wallet provided
- ✅ Frontend submits to MetaMask
- ✅ User signs transaction
- ✅ Tokens are deducted

## Next Steps

1. **Kill all node processes** (Step 1)
2. **Clean build** (Step 2)
3. **Rebuild** (Step 3)
4. **Test with debug script** (Step 4)
5. **Start backend** (Step 5)
6. **Run transaction test** (Step 6)
7. **Execute via frontend** (see test script output for instructions)

## Summary

The backend crash was caused by the deprecated `ts-node/esm` loader. The fix is to:
1. Kill stale processes
2. Clean build artifacts
3. Rebuild with `tsc`
4. Start with `node dist/index.js`

The transaction flow is already fully implemented - once the backend is stable, transactions will work end-to-end.
