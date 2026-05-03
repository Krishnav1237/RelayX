#!/usr/bin/env pwsh
# Run comprehensive backend test

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "COMPREHENSIVE BACKEND TEST" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "Checking if backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "Backend is running" -ForegroundColor Green
} catch {
    Write-Host "Backend is NOT running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start the backend first:" -ForegroundColor Yellow
    Write-Host "   npm run dev:full" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "Running comprehensive test suite..." -ForegroundColor Yellow
Write-Host ""

npm run test:comprehensive
