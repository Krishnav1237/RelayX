# Step-by-Step Backend Test & Transaction Execution

Follow these steps exactly to test the backend and execute a real transaction.

## Prerequisites

- [ ] MetaMask installed
- [ ] Connected to Sepolia testnet
- [ ] Have at least 0.02 ETH on Sepolia (0.01 for swap + gas)
- [ ] Backend and frontend NOT currently running

## Step 1: Clean Start

Open PowerShell in the backend directory:

```powershell
cd C:\Projects\Hackathons\RelayX\backend

# Kill any existing node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Clean build
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# Rebuild
npm run build
```

**Expected output:**
```
> relayx@1.0.0 build
> tsc

(no errors)
```

If you see TypeScript errors, share them with me.

## Step 2: Start Backend

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
```

**If backend crashes:**
- Copy the ENTIRE error message
- Share it with me
- I'll fix the specific issue

**If backend starts successfully:**
- Leave this terminal open
- Proceed to Step 3

## Step 3: Test Backend (New Terminal)

Open a NEW PowerShell window:

```powershell
cd C:\Projects\Hackathons\RelayX\backend
npm run test:comprehensive
```

**Watch for:**
1. All health checks passing ✅
2. "Analyze with wallet" test generating calldata
3. "Confirm execution" test succeeding
4. Final summary showing all tests passed

**If any test fails:**
- Copy the failed test output
- Share it with me
- I'll fix the issue

**If all tests pass:**
- You'll see "✅ ALL TESTS PASSED!"
- Proceed to Step 4

## Step 4: Start Frontend (New Terminal)

Open a NEW PowerShell window:

```powershell
cd C:\Projects\Hackathons\RelayX\frontend
npm run dev
```

**Expected output:**
```
- Local:        http://localhost:3000
```

## Step 5: Execute Transaction via Frontend

1. **Open browser:** http://localhost:3000/dashboard

2. **Connect MetaMask:**
   - Click "Connect Wallet" button
   - Select MetaMask
   - Approve connection

3. **Check Network:**
   - Look at "Switch to Sepolia" button
   - If it shows "✓ Connected to Sepolia" → Good!
   - If it shows "⬡ Switch to Sepolia" → Click it and approve in MetaMask

4. **Submit Intent:**
   - In the text box, type: `get best yield on 0.01 ETH`
   - Click "Submit" or press Enter
   - Wait 10-30 seconds for analysis

5. **Watch Backend Terminal:**
   - You should see logs like:
   ```
   [CONTROLLER] Analyze request received
   [CONTROLLER] Intent: get best yield on 0.01 ETH
   [CONTROLLER] Starting execution service analyze...
   [ReasoningAdapter] LLM CALL → provider: groq
   [CONTROLLER] Execution service analyze completed
   [CONTROLLER] Analysis response sent (2500ms)
   ```

6. **Review Execution Plan:**
   - You'll see a panel with:
     - Protocol name (e.g., "Aave")
     - APY (e.g., "3.5%")
     - Confidence score
     - Explanation
   - Two buttons: "Approve & Execute" and "Cancel"

7. **Click "Approve & Execute":**
   - Frontend will check network (switch to Sepolia if needed)
   - MetaMask popup will appear

8. **Review MetaMask Transaction:**
   - **To:** Uniswap V3 Router address
   - **Value:** 0.01 ETH
   - **Gas:** ~150,000 units
   - **Total:** 0.01 ETH + gas fees (~0.001 ETH)

9. **Confirm in MetaMask:**
   - Click "Confirm"
   - Wait for transaction to broadcast

10. **Watch Browser Console:**
    - Press F12 to open DevTools
    - Go to Console tab
    - You should see:
    ```
    [DASHBOARD] Submitting transaction to MetaMask...
    [DASHBOARD] Current chain ID: 11155111
    [DASHBOARD] Calling submitSwapTransaction...
    [DASHBOARD] Transaction submitted successfully!
    {
      txHash: "0x...",
      explorerUrl: "https://sepolia.etherscan.io/tx/0x..."
    }
    ```

11. **Verify Transaction:**
    - Copy the transaction hash from console
    - Open: https://sepolia.etherscan.io
    - Paste transaction hash
    - You should see:
      - Status: Success ✅
      - From: Your wallet address
      - To: Uniswap V3 Router
      - Value: 0.01 ETH
      - Token transfers

12. **Check Wallet Balance:**
    - Open MetaMask
    - Your ETH balance should be reduced by ~0.011 ETH (0.01 + gas)

## Troubleshooting

### Backend Crashes During Analyze

**Symptoms:**
- Frontend shows "Execution failed (500)"
- Backend terminal shows error and exits

**Action:**
1. Copy the ENTIRE backend error output
2. Share it with me
3. I'll identify the exact issue and fix it

### No Calldata Generated

**Symptoms:**
- Test shows "⚠ No calldata generated"
- Frontend doesn't show MetaMask popup

**Possible causes:**
- Uniswap QuoterV2 not working
- Token addresses not resolved
- Wallet address not provided

**Action:**
1. Check backend logs for Uniswap errors
2. Run: `curl http://localhost:3001/quote-health`
3. Share the output with me

### MetaMask Doesn't Popup

**Symptoms:**
- Click "Approve & Execute"
- Nothing happens

**Action:**
1. Open browser console (F12)
2. Look for errors
3. Check if MetaMask is locked
4. Try refreshing the page

### Transaction Fails

**Symptoms:**
- MetaMask shows transaction
- Transaction fails on-chain

**Action:**
1. Copy transaction hash
2. Check on Sepolia Etherscan
3. Look at "Revert Reason"
4. Share with me

### Tokens Not Deducted

**Symptoms:**
- Transaction shows "Success" on Etherscan
- But wallet balance unchanged

**Action:**
1. Check if you're looking at the right network (Sepolia, not Mainnet)
2. Refresh MetaMask
3. Check transaction details on Etherscan for token transfers

## Success Criteria

✅ Backend starts without crashing
✅ All comprehensive tests pass
✅ Frontend connects to backend
✅ MetaMask popup appears
✅ Transaction broadcasts successfully
✅ Transaction shows "Success" on Etherscan
✅ Wallet balance decreases by ~0.011 ETH

## What to Share with Me

If anything fails, share:

1. **Backend terminal output** (full error message)
2. **Test output** (which tests failed)
3. **Browser console** (any errors)
4. **Transaction hash** (if transaction was sent)
5. **Screenshot** (if helpful)

I'll fix any issues immediately!

## Expected Timeline

- Step 1 (Clean): 30 seconds
- Step 2 (Start backend): 5 seconds
- Step 3 (Test): 30-60 seconds
- Step 4 (Start frontend): 10 seconds
- Step 5 (Execute): 2-3 minutes

**Total: ~4 minutes from start to verified transaction**

Let's do this! 🚀
