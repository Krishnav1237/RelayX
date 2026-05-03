# Quick Fix - Backend Crash

## Problem
Backend crashes with `[Object: null prototype]` error due to deprecated `ts-node/esm` loader.

## Solution (30 seconds)

```powershell
# Navigate to backend
cd backend

# Run automated fix script
.\fix-backend.ps1

# Start backend
npm run dev:full
```

## Test Backend (Comprehensive)

Once backend is running, open a NEW terminal and run:

```powershell
cd backend
npm run test:comprehensive
```

This will test:
- ✅ All health endpoints
- ✅ Integration status
- ✅ Analyze without wallet
- ✅ Analyze with wallet (generates calldata)
- ✅ Execution confirmation
- ✅ Error handling

## If Script Fails

```powershell
# Kill node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Clean and rebuild
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
npm run build

# Start backend
npm run dev:full
```

## Execute Real Transaction

After all tests pass:

1. Open http://localhost:3000/dashboard
2. Connect MetaMask
3. Switch to Sepolia (button will show checkmark when connected)
4. Submit: "get best yield on 0.01 ETH"
5. Click "Approve & Execute"
6. Sign in MetaMask
7. ✅ Tokens deducted!

## What's Already Working

✅ Backend generates swap calldata  
✅ Frontend submits to MetaMask  
✅ User signs transaction  
✅ Tokens are deducted  
✅ History stored on 0G Galileo  

**Only issue**: Backend crash blocking execution.

## Files to Read

- `TRANSACTION_FLOW_STATUS.md` - Complete status and flow explanation
- `BACKEND_FIX_GUIDE.md` - Detailed troubleshooting guide

## Expected Result

After fix:
- Backend starts without crashes ✅
- Comprehensive test passes all checks ✅
- Frontend execution works end-to-end ✅
- Tokens deducted from MetaMask ✅
