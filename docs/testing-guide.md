# RelayX — Complete Testing Guide

## Pre-Flight Checklist

Before running any tests, ensure the following are ready.

### 1. Environment Setup

Copy the example env file and fill it in:

```bash
cd RelayX/backend
cp .env.example .env
```

Minimum required values for testnet operation:

| Variable | Value | Notes |
|---|---|---|
| `RELAYX_CHAIN` | `sepolia` | ENS and swap chain |
| `ALCHEMY_SEPOLIA_RPC_URL` | `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY` | Get free at alchemy.com |
| `AXL_BASE_URL` | `http://localhost:3005` | Local sim node (auto-started) |
| `ZEROG_PRIVATE_KEY` | `0x...` | Optional — enables real 0G storage |

### 2. Start the Backend

```bash
# Terminal 1
cd RelayX/backend
npm run dev:full
```

Expected boot output:
```
[BOOT] RelayX Backend
[BOOT] Chain: Ethereum Sepolia (11155111)
[BOOT] Uniswap: QuoterV2 on-chain (chain 11155111) -> CoinGecko fallback
[BOOT] 0G Memory: in-memory (set ZEROG_PRIVATE_KEY for real testnet storage)
[BOOT] Server running -> http://localhost:3001
```

### 3. Start the Frontend

```bash
# Terminal 2
cd RelayX/frontend
npm run dev
```

Open **http://localhost:3000**

### 4. MetaMask Setup

1. Install MetaMask browser extension
2. Add Sepolia testnet (Chain ID: `11155111`)
3. Get Sepolia ETH at sepoliafaucet.com

---

## Step 1: Backend Health Checks

### Overall Health
```bash
curl http://localhost:3001/health
```
Expected: `"status": "ok", "chainId": 11155111`

### Unified Integration Health
```bash
curl http://localhost:3001/integration-health
```
Expected:
```json
{ "axl": "ok", "uniswap": "fallback", "memory": "fallback", "ens": "ok" }
```
> `uniswap: fallback` is normal without Alchemy RPC. `memory: fallback` is normal without `ZEROG_PRIVATE_KEY`.

### ENS Health
```bash
curl http://localhost:3001/ens-health
```
Expected: `"status": "ok"` or `"status": "fallback"` (both work).

### AXL Health
```bash
curl http://localhost:3001/axl-health
```
Expected: `"mode": "sim"` when real AXL binary is not running.

### Yield Data Health
```bash
curl http://localhost:3001/yield-health
```
Expected: `"status": "ok", "source": "defillama"` with `protocols > 0`.

### Uniswap Quote Health
```bash
curl http://localhost:3001/quote-health
```
Expected: `"status": "ok"` or `"status": "degraded"` (degraded = CoinGecko fallback, still functional).

### 0G Memory Health
```bash
curl http://localhost:3001/memory-health
```
Without `ZEROG_PRIVATE_KEY`: `"status": "degraded", "mode": "in-memory", "recordCount": 5`

---

## Step 2: API Tests (curl)

### Test 2a: Basic Analyze Call
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": "find the best yield for ETH"}'
```

Expected response shape:
```json
{
  "final_result": {
    "protocol": "Aave",
    "apy": "4.2%",
    "status": "pending_approval",
    "swap": { "amountOut": "...", "route": "...", "source": "coingecko" }
  },
  "approval": { "id": "<uuid>", "expiresAt": <unix_ms> }
}
```

Copy the `approval.id` for the next step.

### Test 2b: Confirm Execution
```bash
curl -X POST http://localhost:3001/execute/confirm \
  -H "Content-Type: application/json" \
  -d '{"approvalId": "<paste-id-from-above>"}'
```

Expected: `"status": "success"`

### Test 2c: Analyze with ENS Context
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": "find safest yield", "context": {"ens": "vitalik.eth"}}'
```

Expected: ENS trace entries showing reputation score.

### Test 2d: Analyze with Wallet Context (Generates Real Calldata)
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "swap ETH for yield",
    "context": { "wallet": "0xYOUR_ADDRESS_HERE" }
  }'
```

Expected: `swap.calldata` object with fields `to`, `data`, `value`, `gasEstimate`, `deadline`.

### Test 2e: Debug Mode
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": "find best yield on ETH", "context": {"debug": true}}'
```

Expected: Extra `debug` block with `confidenceBreakdown`, `ensReputationScore`, `axlInfluence`.

### Test 2f: Full Execute (one-shot)
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"intent": "deposit into lowest risk yield protocol"}'
```

Expected: Immediate `"status": "success"`.

---

## Step 3: Frontend UI Tests

### 3a: Connect MetaMask
1. Click "Connect Wallet" top right
2. Select "MetaMask"
3. Approve popup
4. Verify: address shown in navbar, network = Sepolia

### 3b: Basic Intent (No Wallet)
1. Enter: `find the safest yield for my ETH`
2. Click "Execute"
3. Watch trace stream in terminal panel (4 agents should appear)
4. Wait for summary panel to appear on right

### 3c: Full Execution with Approval
1. Submit an intent
2. After analysis, right panel shows protocol + APY + confidence
3. Click "Approve & Execute"
4. Without wallet calldata: backend confirm is called, status -> `success`

### 3d: Full On-Chain Execution (With MetaMask + Calldata)
1. Connect MetaMask on Sepolia (have Sepolia ETH)
2. Enter: `swap 0.1 ETH to USDC on Uniswap`
3. Click "Execute"
4. Click "Approve & Execute"
5. MetaMask opens with:
   - To: Uniswap SwapRouter02
   - Data: encoded calldata
   - Value: ETH amount
6. Approve in MetaMask
7. In trace: `Transaction broadcasted on-chain! Hash: 0x...`
8. Click the hash link to verify on Sepolia Etherscan

### 3e: Rejection Test
1. Click "Approve & Execute"
2. Click "Reject" in MetaMask
3. Expected: Error shown — "Transaction failed or rejected"
4. Nothing written to backend

### 3f: Approval Expiry
1. Submit intent, wait 5+ minutes without approving
2. Click "Approve & Execute"
3. Expected: 404 error — "Approval request expired"

### 3g: Demo Mode
1. Check "Demo retry path"
2. Submit any intent
3. Expected: Trace shows memory-backed retries, often triggers second protocol selection

---

## Step 4: 0G Galileo Real Storage Test

Only if you want to test real 0G storage:

1. Fund wallet at faucet.0g.ai
2. Set in `backend/.env`:
   ```
   ZEROG_PRIVATE_KEY=0x...
   ZEROG_EVM_RPC=https://evmrpc-testnet.0g.ai
   ZEROG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
   ```
3. Restart backend — look for:
   ```
   [ZeroGMemory] Mode: 0G Galileo Testnet (chain 16602)
   ```
4. Run a full execution, watch backend logs for:
   ```
   [ZeroGMemory] Stored on 0G Galileo (chain 16602). rootHash: ...
   ```
5. Check `http://localhost:3001/memory-health` shows `"mode": "0g-storage"`.

---

## Step 5: Automated Test Suite

```bash
cd RelayX/backend
npm test
```

Expected:
```
Test Files  15 passed (15)
     Tests  140 passed (140)
```

| Test File | Coverage |
|---|---|
| `integration.test.ts` | Full pipeline end-to-end |
| `hardening.test.ts` | Shape validation + all agents present |
| `ExecutorAgent.test.ts` | Swap quote + execution mode |
| `UniswapAdapter.test.ts` | Quote fallback chain |
| `AXLAdapter.test.ts` | Non-blocking broadcast |
| `ZeroGMemoryAdapter.test.ts` | Memory storage/retrieval |

---

## Edge Cases

### Invalid Intent
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": ""}'
```
Expected: `400 Bad Request`

### High-Risk Protocol Retry
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"intent": "put everything into the highest APY protocol no matter the risk"}'
```
Expected: `wasRetried: true` in summary.

---

## Common Issues

| Issue | Cause | Fix |
|---|---|---|
| `uniswap: fallback` | No Alchemy RPC | Set `ALCHEMY_SEPOLIA_RPC_URL` |
| MetaMask not found | Extension missing | Install from metamask.io |
| `Approval request expired` | Waited >5 min | Re-submit the intent |
| `Transaction failed` | No Sepolia ETH | Top up at Sepolia faucet |
| `axl: offline` | Sim node not started | Run `npm run dev:full` |

---

## Key Addresses (Sepolia)

| Contract | Address |
|---|---|
| Uniswap V3 QuoterV2 | `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3` |
| Uniswap V3 SwapRouter02 | `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` |
| WETH | `0xfff9976782d46cc05630d1f6ebab18b2324d6b14` |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

## Key URLs

| Resource | URL |
|---|---|
| Sepolia Etherscan | https://sepolia.etherscan.io |
| Sepolia Faucet | https://sepoliafaucet.com |
| 0G Explorer | https://explorer.0g.ai |
| 0G Faucet | https://faucet.0g.ai |
