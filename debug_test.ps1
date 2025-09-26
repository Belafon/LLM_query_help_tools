# Test PowerShell Script for debugging
Write-Host "=== PowerShell Manager Test Script ===" -ForegroundColor Cyan
Write-Host "Hello from PowerShell!" -ForegroundColor Green
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Current time: $(Get-Date)" -ForegroundColor Cyan
Write-Host "PowerShell version: $($PSVersionTable.PSVersion)" -ForegroundColor Magenta
Write-Host "Execution Policy: $(Get-ExecutionPolicy)" -ForegroundColor Blue

# Test some basic commands
Write-Host ""
Write-Host "Testing basic commands:" -ForegroundColor White
Write-Host "Files in current directory:"
Get-ChildItem | Select-Object Name, Length | Format-Table

Write-Host ""
Write-Host "=== Test completed successfully ===" -ForegroundColor Green
Write-Host "Press any key to close..." -ForegroundColor Yellow
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Read-Host "Press Enter to close"
}