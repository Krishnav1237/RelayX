# Final Pre-Flight Checklist

Before running the transaction test, verify everything is ready.

## Environment Setup

### Backend Environment Variables

Check `backend/.env` file exists and contains:

```bash
# Required for LLM explanations
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant

# Optional: Your wallet for testing
TEST_WALLET_ADDRESS=0xYourWalletAddress

# Optional: Alchemy RPC (faster than public)
ALCHEMY_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
```

**If GROQ_API_KEY is missing:**
- LLM explanations will be disabled
- System will use template explanations instead
- Everything else will still work

### MetaMask Setup

- [ ] MetaMask installed in browser
- [ ] Wallet unlocked
- [ ] Connected to Sepolia testnet
- [ ] Balance: At least 0.02 ETH on Sepolia

**Get Sepolia ETH:**
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://faucet.quicknode.com/ethereum/sepolia

### Node Modules

```powershell
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Pre-Flight Checks

### 1. TypeScript Compiles

```powershell
cd backend
npm run build
```

**Expected:** No errors

**If errors:** Share with me

### 2. No Stale Processes

```powershell
Get-Process node -ErrorAction SilentlyContinue
```

**Expected:** No output (no node processes running)

**If processes found:**
```powershell
Get-Process node | Stop-Process -Force
```

### 3. Ports Available

```powershell
# Check if port 3001 is free (backend)
Test-NetConnection -ComputerName localhost -Port 3001

# Check if port 3000 is free (frontend)
Test-NetConnection -ComputerName localhost -Port 3000
```

**Expected:** Connection should fail (ports not in use)

**If ports in use:**
```powershell
# Find and kill process using port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Find and kill process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## Execution Checklist

### Phase 1: Backend Startup

- [ ] Open PowerShell in `backend/` directory
- [ ] Run `npm run dev:full`
- [ ] Wait for "Server running → http://localhost:3001"
- [ ] No crash or error messages
- [ ] AXL simulator starts successfully

**If backend crashes:**
- Copy full error output
- Share with me
- Do NOT proceed

### Phase 2: Backend Testing

- [ ] Open NEW PowerShell window
- [ ] Navigate to `backend/` directory
- [ ] Run `npm run test:comprehensive`
- [ ] All 12 tests pass ✅
- [ ] "Analyze with wallet" shows calldata generated
- [ ] See "✅ ALL TESTS PASSED!"

**If any test fails:**
- Copy failed test output
- Share with me
- Do NOT proceed to frontend

### Phase 3: Frontend Startup

- [ ] Open NEW PowerShell window
- [ ] Navigate to `frontend/` directory
- [ ] Run `npm run dev`
- [ ] Wait for "Local: http://localhost:3000"
- [ ] No compilation errors

### Phase 4: Browser Setup

- [ ] Open http://localhost:3000/dashboard
- [ ] Page loads without errors
- [ ] Open DevTools (F12)
- [ ] Go to Console tab
- [ ] Clear console
- [ ] Keep DevTools open

### Phase 5: Wallet Connection

- [ ] Click "Connect Wallet" button
- [ ] MetaMask popup appears
- [ ] Select your account
- [ ] Click "Connect"
- [ ] Wallet address appears in navbar
- [ ] Check "Switch to Sepolia" button
- [ ] If not on Sepolia, click button and approve

**Verify:**
- [ ] Button shows "✓ Connected to Sepolia"
- [ ] Green checkmark visible

### Phase 6: Transaction Execution

- [ ] Type in text box: `get best yield on 0.01 ETH`
- [ ] Click "Submit" or press Enter
- [ ] Watch backend terminal for logs
- [ ] Wait 10-30 seconds for analysis

**Backend should show:**
```
[CONTROLLER] Analyze request received
[CONTROLLER] Intent: get best yield on 0.01 ETH
[CONTROLLER] Starting execution service analyze...
[CONTROLLER] Execution service analyze completed
```

**Frontend should show:**
- [ ] Execution plan panel appears
- [ ] Protocol name displayed
- [ ] APY percentage shown
- [ ] Confidence score visible
- [ ] Explanation text present
- [ ] "Approve & Execute" button enabled

### Phase 7: Transaction Approval

- [ ] Click "Approve & Execute" button
- [ ] Watch browser console for logs
- [ ] MetaMask popup appears

**MetaMask should show:**
- [ ] Contract interaction
- [ ] To: Uniswap V3 Router address
- [ ] Value: 0.01 ETH
- [ ] Gas estimate: ~150,000 units
- [ ] Total: ~0.011 ETH

**Browser console should show:**
```
[DASHBOARD] Submitting transaction to MetaMask...
[DASHBOARD] Current chain ID: 11155111
[DASHBOARD] Calling submitSwapTransaction...
```

### Phase 8: Transaction Confirmation

- [ ] Review transaction details in MetaMask
- [ ] Click "Confirm" button
- [ ] Wait for transaction to broadcast

**Browser console should show:**
```
[DASHBOARD] Transaction submitted successfully!
{
  txHash: "0x...",
  explorerUrl: "https://sepolia.etherscan.io/tx/0x..."
}
```

### Phase 9: Verification

- [ ] Copy transaction hash from console
- [ ] Open https://sepolia.etherscan.io
- [ ] Paste transaction hash in search
- [ ] Wait for transaction to confirm (1-2 minutes)

**Etherscan should show:**
- [ ] Status: Success ✅
- [ ] From: Your wallet address
- [ ] To: Uniswap V3 Router
- [ ] Value: 0.01 ETH
- [ ] Gas used: ~150,000
- [ ] Token transfers visible

### Phase 10: Balance Check

- [ ] Open MetaMask
- [ ] Check ETH balance
- [ ] Balance should be reduced by ~0.011 ETH

**Calculate:**
- Before: X ETH
- After: X - 0.011 ETH (approximately)
- Difference: 0.01 ETH (swap) + ~0.001 ETH (gas)

## Success Criteria

✅ Backend starts without crashing
✅ All 12 comprehensive tests pass
✅ Frontend loads without errors
✅ Wallet connects successfully
✅ Network switches to Sepolia
✅ Analyze request completes
✅ Execution plan displays
✅ MetaMask popup appears
✅ Transaction broadcasts
✅ Transaction confirms on Etherscan
✅ Wallet balance decreases
✅ Token transfers visible

## Failure Points & Solutions

### Backend Crashes on Startup

**Symptoms:** Backend exits immediately with error

**Solutions:**
1. Check `.env` file exists
2. Run `npm run build` to check for TypeScript errors
3. Kill all node processes and retry
4. Share error output with me

### Backend Crashes During Analyze

**Symptoms:** Frontend shows 500 error, backend exits

**Solutions:**
1. Check backend terminal for error
2. Look for which adapter is failing (ENS, Uniswap, LLM, etc.)
3. Share error output with me

### No Calldata Generated

**Symptoms:** Test shows "No calldata generated"

**Solutions:**
1. Check Uniswap health: `curl http://localhost:3001/quote-health`
2. Verify wallet address in request
3. Check backend logs for Uniswap errors

### MetaMask Doesn't Popup

**Symptoms:** Click "Approve & Execute", nothing happens

**Solutions:**
1. Check browser console for errors
2. Verify MetaMask is unlocked
3. Check if MetaMask is on correct network
4. Refresh page and try again

### Transaction Fails on Etherscan

**Symptoms:** Transaction shows "Failed" status

**Solutions:**
1. Check "Revert Reason" on Etherscan
2. Verify you have enough ETH for gas
3. Check if Uniswap pool has liquidity
4. Share transaction hash with me

## Emergency Reset

If everything is broken and you need to start fresh:

```powershell
# Kill all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Clean backend
cd backend
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
npm run build

# Clean frontend
cd ../frontend
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# Restart everything
cd ../backend
npm run dev:full

# In new terminal
cd frontend
npm run dev
```

## Ready to Go?

If all pre-flight checks pass:

1. Follow `STEP_BY_STEP_TEST.md`
2. Check off each item in this checklist
3. Share results with me

Let's make this transaction happen! 🚀
