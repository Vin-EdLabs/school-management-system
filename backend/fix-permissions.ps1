# PowerShell script to fix PostgreSQL permissions
# Run this script as Administrator if needed

Write-Host "Fixing PostgreSQL permissions for sms_user..." -ForegroundColor Yellow
Write-Host ""

# Try to run the SQL commands
$sqlCommands = @"
GRANT ALL ON SCHEMA public TO sms_user;
GRANT USAGE ON SCHEMA public TO sms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sms_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sms_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sms_user;
"@

# Save to temp file
$tempFile = [System.IO.Path]::GetTempFileName()
$sqlCommands | Out-File -FilePath $tempFile -Encoding utf8

Write-Host "Running SQL commands..." -ForegroundColor Cyan
Write-Host "You may be prompted for the postgres password." -ForegroundColor Yellow
Write-Host ""

try {
    $result = psql -U postgres -d sms_db -f $tempFile 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Permissions fixed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now restart your backend server." -ForegroundColor Cyan
    } else {
        Write-Host "❌ Error running commands. Please run manually:" -ForegroundColor Red
        Write-Host ""
        Write-Host "psql -U postgres -d sms_db" -ForegroundColor Yellow
        Write-Host "Then run these SQL commands:" -ForegroundColor Yellow
        Write-Host $sqlCommands
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run manually:" -ForegroundColor Yellow
    Write-Host "psql -U postgres -d sms_db" -ForegroundColor Cyan
    Write-Host "Then copy and paste the SQL commands from fix-permissions.sql" -ForegroundColor Cyan
} finally {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}
