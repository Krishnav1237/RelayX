# 🚀 START HERE - Complete Transaction Test Guide

This is your master guide to test the backend and execute a real transaction.

## Quick Links

- **Quick Start:** Follow this file (you're reading it now)
- **Detailed Steps:** `STEP_BY_STEP_TEST.md`
- **Pre-Flight Checks:** `FINAL_CHECKLIST.md`
- **Troubleshooting:** `BACKEND_FIX_GUIDE.md`
- **Architecture:** `TRANSACTION_FLOW_STATUS.md`

## What We're Testing

1. ✅ Backend starts without crashing
2. ✅ All integrations work (Uniswap, ENS, AXL, Memory, LLM)
3. ✅ Analyze endpoint generates swap calldata
4. ✅ Frontend submits transaction to MetaMask
5. ✅ User signs transaction
6. ✅ Transaction broadcasts to Sepolia
7. ✅ Tokens are deducted from wallet
8. ✅ Transaction confirms on Etherscan

## Prerequisites (5 minutes)

### 1. Environment Variables

Create `backend/.env` file:

```bash
# Required for LLM (optional - system works without it)
GROQ_API_KEY=your_groq_api_key_here

# Optional: Your wallet for testing
TEST_WALLET_ADDRESS=0xYourWalletAddress

# Optional: Faster RPC
ALCHEMY_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
```

**Get Groq API Key (free):**
1. Go to https://console.groq.com
2. Sign up (free)
3. Create API key
4. Copy to `.env` file

### 2. MetaMask Setup

- Install MetaMask browser extension
- Create or import wallet
- Switch to Sepolia testnet
- Get test ETH from faucet:
  - https://sepoliafaucet.com/
  - https://www.alchemy.com/faucets/ethereum-sepolia
- Need: 0.02 ETH (0.01 for swap + gas)

### 3. Install Dependencies

```powershell
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Quick Start (4 minutes)

### Step 1: Fix & Build Backend (30 seconds)

```powershell
cd backend
.\fix-backend.ps1
```

**Expected output:**
```
===================================================
BACKEND FIX SCRIPT
===================================================

Step 1: Killing all node processes...
   No node processes running

Step 2: Cleaning build artifacts...
   Removed dist/ folder

Step 3: Rebuilding TypeScript...
   TypeScript compiled successfully

Step 4: Testing backend startup...
   Backend debug test passed

===================================================
BACKEND FIX COMPLETE
===================================================
```

**If script fails:** Run commands manually:
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
npm run build
```

### Step 2: Start Backend (5 seconds)

```powershell
npm run dev:full
```

**Expected output:**
```
[BACKEND] [BOOT] ══════════════════════════════════════════
[BACKEND] [BOOT] RelayX Backend
[BACKEND] [BOOT] ══════════════════════════════════════════
[BACKEND] [BOOT] Chain: Ethereum Sepolia (11155111)
[BACKEND] [BOOT] Server running → http://localhost:3001
[AXL] [AXL-SIM] Simulation node running on http://localhost:3005
```

**If backend crashes:**
- Copy the ENTIRE error message
- Share it with me
- I'll fix it immediately

**Leave this terminal open!**

### Step 3: Test Backend (60 seconds)

Open a NEW PowerShell window:

```powershell
cd backend
npm run test:comprehensive
```

**Expected output:**
```
═══════════════════════════════════════════════════════
🧪 COMPREHENSIVE BACKEND TEST
═══════════════════════════════════════════════════════

📋 Phase 1: Health Checks
─────────────────────────────────────────────────────
✅ Health endpoint (50ms)
✅ Integration health (120ms)
✅ AXL health (80ms)
✅ Yield health (200ms)
✅ ENS health (150ms)
✅ Quote health (180ms)
✅ Memory health (60ms)

📋 Phase 2: Analyze Endpoint
─────────────────────────────────────────────────────
✅ Analyze without wallet (2500ms)
✅ Analyze with wallet (3000ms)
   ✓ Calldata generated!
     Router: 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
     Value: 10000000000000000 wei
     Gas estimate: 150000
     Token in: ETH
     Token out: USDC
     Amount out: 30.123456 USDC
     Deadline: 2026-05-03T...
     Data length: 324 chars

📋 Phase 3: Execution Confirmation
─────────────────────────────────────────────────────
✅ Confirm execution (1500ms)

📋 Phase 4: Error Handling
─────────────────────────────────────────────────────
✅ Invalid intent handling (50ms)
✅ Expired approval handling (50ms)

═══════════════════════════════════════════════════════
📊 TEST SUMMARY
═══════════════════════════════════════════════════════

Total tests: 12
Passed: 12 ✅
Failed: 0 ❌

═══════════════════════════════════════════════════════
✅ ALL TESTS PASSED!
═══════════════════════════════════════════════════════

The backend is ready for frontend testing.
```

**If any test fails:**
- Copy the failed test output
- Share it with me
- I'll fix the issue

**If all tests pass:** Proceed to Step 4

### Step 4: Start Frontend (10 seconds)

Open a NEW PowerShell window:

```powershell
cd frontend
npm run dev
```

**Expected output:**
```
- Local:        http://localhost:3000
```

### Step 5: Execute Transaction (2 minutes)

1. **Open browser:** http://localhost:3000/dashboard

2. **Open DevTools:** Press F12, go to Console tab

3. **Connect wallet:**
   - Click "Connect Wallet"
   - Select MetaMask
   - Approve connection

4. **Check network:**
   - Look at "Switch to Sepolia" button
   - Should show "✓ Connected to Sepolia"
   - If not, click button and approve in MetaMask

5. **Submit intent:**
   - Type: `get best yield on 0.01 ETH`
   - Press Enter
   - Wait 10-30 seconds

6. **Watch backend terminal:**
   ```
   [CONTROLLER] Analyze request received
   [CONTROLLER] Intent: get best yield on 0.01 ETH
   [CONTROLLER] Starting execution service analyze...
   [ReasoningAdapter] LLM CALL → provider: groq
   [CONTROLLER] Execution service analyze completed
   ```

7. **Review execution plan:**
   - Protocol name (e.g., "Aave")
   - APY (e.g., "3.5%")
   - Confidence score
   - Explanation

8. **Click "Approve & Execute"**

9. **Review MetaMask transaction:**
   - To: Uniswap V3 Router
   - Value: 0.01 ETH
   - Gas: ~150,000 units
   - Total: ~0.011 ETH

10. **Confirm in MetaMask**

11. **Watch browser console:**
    ```
    [DASHBOARD] Transaction submitted successfully!
    {
      txHash: "0x...",
      explorerUrl: "https://sepolia.etherscan.io/tx/0x..."
    }
    ```

12. **Verify on Etherscan:**
    - Copy transaction hash
    - Open https://sepolia.etherscan.io
    - Paste hash
    - Wait for confirmation (1-2 minutes)
    - Status should show: Success ✅

13. **Check wallet:**
    - Open MetaMask
    - Balance should be reduced by ~0.011 ETH

## Success! 🎉

If you made it here:
- ✅ Backend is working perfectly
- ✅ All integrations are functional
- ✅ Swap calldata is generated correctly
- ✅ Frontend submits transactions properly
- ✅ MetaMask integration works
- ✅ Tokens are deducted as expected

## What to Share with Me

### If Everything Works:

Share:
1. ✅ "All tests passed!"
2. ✅ Transaction hash
3. ✅ Etherscan link showing success
4. ✅ Screenshot of successful transaction (optional)

### If Something Fails:

Share:
1. ❌ Which step failed
2. ❌ Backend terminal output (full error)
3. ❌ Test output (which tests failed)
4. ❌ Browser console errors
5. ❌ Screenshot (if helpful)

I'll fix any issues immediately!

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| Backend crashes on startup | Share error output with me |
| TypeScript compilation fails | Share build errors with me |
| Test fails | Share test output with me |
| Backend crashes during analyze | Share backend terminal output |
| No calldata generated | Check `curl http://localhost:3001/quote-health` |
| MetaMask doesn't popup | Check browser console, refresh page |
| Transaction fails | Share transaction hash from Etherscan |
| Tokens not deducted | Check you're on Sepolia, refresh MetaMask |

## Additional Resources

- **Detailed walkthrough:** `STEP_BY_STEP_TEST.md`
- **Pre-flight checklist:** `FINAL_CHECKLIST.md`
- **Architecture overview:** `TRANSACTION_FLOW_STATUS.md`
- **Troubleshooting guide:** `BACKEND_FIX_GUIDE.md`
- **Quick fixes:** `QUICK_FIX.md`

## Timeline

- Setup: 5 minutes
- Backend fix: 30 seconds
- Backend start: 5 seconds
- Backend test: 60 seconds
- Frontend start: 10 seconds
- Transaction execution: 2 minutes
- Verification: 1 minute

**Total: ~9 minutes from start to verified transaction**

## Let's Go! 🚀

Follow the steps above and share your results with me. I'm here to help if anything goes wrong!
