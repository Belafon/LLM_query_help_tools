# Backup Script for LLM Query Help Tools - User Data
# This script specifically backs up the user-created scripts stored in the user_data folder.

$ProjectRoot = $PSScriptRoot
$UserDataDir = Join-Path $ProjectRoot "user_data"
$BackupRoot = Join-Path $ProjectRoot "backups"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Join-Path $BackupRoot "user_data_backup_$Timestamp"

# Check if user_data exists
if (!(Test-Path $UserDataDir)) {
    Write-Host "Error: user_data folder not found. Have you saved any scripts yet?" -ForegroundColor Red
    exit
}

# Create backup root if it doesn't exist
if (!(Test-Path $BackupRoot)) {
    New-Item -ItemType Directory -Path $BackupRoot | Out-Null
}

# Create specific backup directory
New-Item -ItemType Directory -Path $BackupDir | Out-Null

Write-Host "Starting backup of user data to $BackupDir..." -ForegroundColor Cyan

# Copy the user_data content
Copy-Item -Path "$UserDataDir\*" -Destination $BackupDir -Recurse -Force

Write-Host "Backup completed successfully!" -ForegroundColor Green
Write-Host "Location: $BackupDir" -ForegroundColor Green
