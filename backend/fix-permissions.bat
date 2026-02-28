@echo off
echo ========================================
echo Fixing PostgreSQL Permissions
echo ========================================
echo.
echo This will grant permissions to sms_user
echo You will be prompted for the postgres password
echo.
pause

psql -U postgres -d sms_db -c "GRANT ALL ON SCHEMA public TO sms_user; GRANT USAGE ON SCHEMA public TO sms_user; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sms_user; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sms_user; GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sms_user; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sms_user;"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Permissions fixed.
    echo ========================================
    echo.
    echo You can now restart your backend server.
    echo.
) else (
    echo.
    echo ========================================
    echo ERROR: Could not fix permissions
    echo ========================================
    echo.
    echo Please run manually:
    echo   psql -U postgres -d sms_db
    echo.
    echo Then run these SQL commands:
    echo   GRANT ALL ON SCHEMA public TO sms_user;
    echo   GRANT USAGE ON SCHEMA public TO sms_user;
    echo   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sms_user;
    echo   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sms_user;
    echo.
)

pause
