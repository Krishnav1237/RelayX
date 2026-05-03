#!/usr/bin/env pwsh
# Backend Fix Script
# This script will kill stale processes, clean build artifacts, and restart the backend

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "BACKEND FIX SCRIPT" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill all node processes
Write-Host "Step 1: Killing all node processes..." -ForegroundColor Yellow
try {
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $nodeProcesses | Stop-Process -Force
        Write-Host "   Killed $($nodeProcesses.Count) node process(es)" -ForegroundColor Green
    } else {
        Write-Host "   No node processes running" -ForegroundColor Green
    }
} catch {
    Write-Host "   Could not kill node processes: $_" -ForegroundColor Yellow
}
Write-Host ""

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 1

# Step 2: Clean build artifacts
Write-Host "Step 2: Cleaning build artifacts..." -ForegroundColor Yellow
try {
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
        Write-Host "   Removed dist/ folder" -ForegroundColor Green
    } else {
        Write-Host "   dist/ folder does not exist" -ForegroundColor Green
    }
    
    if (Test-Path "node_modules/.cache") {
        Remove-Item -Recurse -Force "node_modules/.cache"
        Write-Host "   Removed node_modules/.cache" -ForegroundColor Green
    } else {
        Write-Host "   node_modules/.cache does not exist" -ForegroundColor Green
    }
} catch {
    Write-Host "   Could not clean build artifacts: $_" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Rebuild TypeScript
Write-Host "Step 3: Rebuilding TypeScript..." -ForegroundColor Yellow
try {
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   TypeScript compiled successfully" -ForegroundColor Green
    } else {
        Write-Host "   TypeScript compilation failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Build output:" -ForegroundColor Red
        Write-Host $buildOutput -ForegroundColor Red
        Write-Host ""
        Write-Host "Fix the TypeScript errors and run this script again." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   Build failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Test backend startup
Write-Host "Step 4: Testing backend startup..." -ForegroundColor Yellow
try {
    $debugOutput = npm run debug 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Backend debug test passed" -ForegroundColor Green
    } else {
        Write-Host "   Backend debug test failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Debug output:" -ForegroundColor Red
        Write-Host $debugOutput -ForegroundColor Red
        Write-Host ""
        Write-Host "Fix the errors and run this script again." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   Debug test failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Success!
Write-Host "===================================================" -ForegroundColor Green
Write-Host "BACKEND FIX COMPLETE" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Write-Host "The backend is ready to start!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the backend:" -ForegroundColor Cyan
Write-Host "   npm run dev:full" -ForegroundColor White
Write-Host ""
Write-Host "To test the transaction flow:" -ForegroundColor Cyan
Write-Host "   npm run test:transaction" -ForegroundColor White
Write-Host ""
Write-Host "To execute via frontend:" -ForegroundColor Cyan
Write-Host "   1. Open http://localhost:3000/dashboard" -ForegroundColor White
Write-Host "   2. Connect MetaMask wallet" -ForegroundColor White
Write-Host "   3. Submit intent: get best yield on 0.01 ETH" -ForegroundColor White
Write-Host "   4. Click Approve & Execute" -ForegroundColor White
Write-Host "   5. Confirm in MetaMask" -ForegroundColor White
Write-Host ""
