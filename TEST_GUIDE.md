# Test the PowerShell Manager

## Quick Test Steps:

1. **Application should be running at**: http://localhost:3000
2. **Navigate to**: PowerShell Manager (in the sidebar)
3. **Create a test script** by clicking "Create New Script"

## Test Script Examples:

### Simple Test:
```powershell
Write-Host "Hello from PowerShell Manager!" -ForegroundColor Green
Write-Host "Current date and time:" -ForegroundColor Yellow
Get-Date
Write-Host "PowerShell version:" -ForegroundColor Cyan
$PSVersionTable.PSVersion
```

### Interactive Test:
```powershell
Write-Host "Welcome to the interactive test!" -ForegroundColor Green
$name = Read-Host "What is your name?"
Write-Host "Hello, $name! Nice to meet you!" -ForegroundColor Yellow

$favoriteColor = Read-Host "What's your favorite color?"
Write-Host "That's a great choice! $favoriteColor is a beautiful color." -ForegroundColor $favoriteColor

Write-Host "Here are the first 5 processes on your system:" -ForegroundColor Cyan
Get-Process | Select-Object -First 5 | Format-Table Name, Id, CPU
```

### System Information Test:
```powershell
Write-Host "System Information Report" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""

Write-Host "Computer Name: $env:COMPUTERNAME" -ForegroundColor Yellow
Write-Host "User Name: $env:USERNAME" -ForegroundColor Yellow
Write-Host "Operating System: $(Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty Caption)" -ForegroundColor Yellow

Write-Host ""
Write-Host "Current Location: $(Get-Location)" -ForegroundColor Cyan
Write-Host "PowerShell Execution Policy: $(Get-ExecutionPolicy)" -ForegroundColor Cyan

Write-Host ""
Write-Host "Available drives:" -ForegroundColor Magenta
Get-PSDrive -PSProvider FileSystem | Format-Table Name, @{Name="Size(GB)";Expression={[math]::Round($_.Used/1GB + $_.Free/1GB,2)}}, @{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}}
```

## Expected Behavior:

1. ✅ Click "Execute" button
2. ✅ A new console window should open
3. ✅ The PowerShell script should run in the console
4. ✅ For interactive scripts, you can type responses
5. ✅ Console shows "Press any key to close" when finished
6. ✅ Console closes when you press any key

## Troubleshooting:

- If console doesn't open: Check that backend is running on port 3001
- If script doesn't execute: Look for error messages in the console window
- If console closes immediately: There might be a syntax error in your script

## Current Status:
- ✅ Backend running on port 3001
- ✅ Frontend running on port 3000  
- ✅ WebSocket connection established
- ✅ Script execution via console windows