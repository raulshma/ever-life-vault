@echo off
REM Ever Life Vault Manual Rollback Script for Windows
REM This script allows manual rollback to a previous deployment backup

setlocal enabledelayedexpansion

REM Configuration
if "%DEPLOY_DIR%"=="" set DEPLOY_DIR=C:\apps\ever-life-vault
if "%APP_NAME%"=="" set APP_NAME=ever-life-vault
set BACKUP_DIR=%DEPLOY_DIR%\backups

REM Colors for output (Windows 10+)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "BLUE=[94m"
set "NC=[0m"

REM Function to log messages
:log
echo %GREEN%[%date% %time%] %~1%NC%
goto :eof

REM Function to warn messages
:warn
echo %YELLOW%[%date% %time%] WARNING: %~1%NC%
goto :eof

REM Function to error messages
:error
echo %RED%[%date% %time%] ERROR: %~1%NC%
goto :eof

REM Function to info messages
:info
echo %BLUE%[%date% %time%] INFO: %~1%NC%
goto :eof

REM Function to list available backups
:list_backups
echo Available backups:
echo.
if not exist "%BACKUP_DIR%" (
    echo No backups found in %BACKUP_DIR%
    goto :eof
)

echo Backup files:
for /f "delims=" %%i in ('dir /b /o-d "%BACKUP_DIR%\*.yml.*" 2^>nul') do (
    echo   %%i
)
for /f "delims=" %%i in ('dir /b /o-d "%BACKUP_DIR%\*.env.*" 2^>nul') do (
    echo   %%i
)

echo.
echo Most recent backups:
for /f "delims=" %%i in ('dir /b /o-d "%BACKUP_DIR%\docker-compose.yml.*" 2^>nul ^| findstr /r ".*" ^| findstr /n "^" ^| findstr "^1:"') do (
    set "latest_compose=%%i"
    set "latest_compose=!latest_compose:1:=!"
    echo   docker-compose.yml: !latest_compose!
)
for /f "delims=" %%i in ('dir /b /o-d "%BACKUP_DIR%\*.env.*" 2^>nul ^| findstr /r ".*" ^| findstr /n "^" ^| findstr "^1:"') do (
    set "latest_env=%%i"
    set "latest_env=!latest_env:1:=!"
    echo   .env: !latest_env!
)
goto :eof

REM Function to stop containers
:stop_containers
call :log "Stopping existing containers..."

REM Stop and remove containers with our app name
for /f "delims=" %%i in ('docker ps -a --filter "name=%APP_NAME%" --format "{{.Names}}" 2^>nul') do (
    if not "%%i"=="" (
        call :log "Stopping container: %%i"
        docker stop "%%i" 2>nul || call :warn "Failed to stop %%i"
        docker rm "%%i" 2>nul || call :warn "Failed to remove %%i"
    )
)

REM Remove network if it exists
docker network rm "%APP_NAME%_app-network" 2>nul
goto :eof

REM Function to start containers
:start_containers
call :log "Starting containers from backup..."

REM Create network
docker network create "%APP_NAME%_app-network" 2>nul

REM Start backend
call :log "Starting backend container..."
docker run -d ^
    --name "%APP_NAME%_backend_1" ^
    --network "%APP_NAME%_app-network" ^
    --network-alias backend ^
    --restart unless-stopped ^
    -p "%BACKEND_PORT%:8787" ^
    --env-file "%DEPLOY_DIR%\.env" ^
    -e NODE_ENV=production ^
    -e HOST=0.0.0.0 ^
    -e PORT=8787 ^
    ever-life-vault/backend:latest

REM Start web
call :log "Starting web container..."
docker run -d ^
    --name "%APP_NAME%_web_1" ^
    --network "%APP_NAME%_app-network" ^
    --network-alias web ^
    --restart unless-stopped ^
    -p "%WEB_PORT%:80" ^
    -p "%WEB_SSL_PORT%:443" ^
    --env-file "%DEPLOY_DIR%\.env" ^
    -e NODE_ENV=production ^
    ever-life-vault/web:latest
goto :eof

REM Function to rollback to specific backup
:rollback_to_backup
set "backup_timestamp=%~1"
call :log "Rolling back to backup: %backup_timestamp%"

REM Check if backup files exist
set "compose_backup=%BACKUP_DIR%\docker-compose.yml.%backup_timestamp%"
set "env_backup=%BACKUP_DIR%\.env.%backup_timestamp%"

if not exist "%compose_backup%" (
    call :error "Backup file not found: %compose_backup%"
    exit /b 1
)

if not exist "%env_backup%" (
    call :error "Backup file not found: %env_backup%"
    exit /b 1
)

REM Stop current containers
call :stop_containers

REM Restore backup files
call :log "Restoring backup files..."
copy "%compose_backup%" "%DEPLOY_DIR%\docker-compose.yml" >nul
copy "%env_backup%" "%DEPLOY_DIR%\.env" >nul

REM Start containers
cd /d "%DEPLOY_DIR%"
call :start_containers

call :log "Rollback completed successfully!"

REM Show status
echo.
echo 🚀 Service Status:
docker ps --filter "name=%APP_NAME%" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
echo 📋 Rollback completed to backup: %backup_timestamp%
goto :eof

REM Function to rollback to most recent backup
:rollback_to_latest
call :log "Rolling back to most recent backup..."

REM Find the most recent backup
for /f "delims=" %%i in ('dir /b /o-d "%BACKUP_DIR%\docker-compose.yml.*" 2^>nul ^| findstr /r ".*" ^| findstr /n "^" ^| findstr "^1:"') do (
    set "latest_compose=%%i"
    set "latest_compose=!latest_compose:1:=!"
    goto :found_latest
)

call :error "No backup files found"
exit /b 1

:found_latest
REM Extract timestamp from filename
for /f "tokens=2 delims=." %%a in ("!latest_compose!") do (
    set "timestamp=%%a"
)

call :rollback_to_backup "!timestamp!"
goto :eof

REM Function to show usage
:show_usage
echo Ever Life Vault Manual Rollback Script for Windows
echo.
echo Usage: %~nx0 [OPTIONS] [BACKUP_TIMESTAMP]
echo.
echo Options:
echo   -l, --list              List available backups
echo   -r, --rollback          Rollback to most recent backup
echo   -h, --help              Show this help message
echo.
echo Examples:
echo   %~nx0 --list                                    # List available backups
echo   %~nx0 --rollback                               # Rollback to most recent backup
echo   %~nx0 20250115_143022                         # Rollback to specific backup
echo.
echo Environment variables:
echo   DEPLOY_DIR     Deployment directory (default: C:\apps\ever-life-vault)
echo   APP_NAME       Application name (default: ever-life-vault)
echo   WEB_PORT       Web port (default: 8080)
echo   BACKEND_PORT   Backend port (default: 8787)
echo   WEB_SSL_PORT   Web SSL port (default: 8443)
goto :eof

REM Main script logic
if "%1"=="" goto :show_usage
if "%1"=="-h" goto :show_usage
if "%1"=="--help" goto :show_usage
if "%1"=="-l" goto :list_backups
if "%1"=="--list" goto :list_backups
if "%1"=="-r" goto :rollback_to_latest
if "%1"=="--rollback" goto :rollback_to_latest

REM Assume it's a backup timestamp
REM Check if it matches the expected format (YYYYMMDD_HHMMSS)
echo %1 | findstr /r "^[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]$" >nul
if errorlevel 1 (
    call :error "Invalid backup timestamp format. Expected: YYYYMMDD_HHMMSS"
    echo.
    call :show_usage
    exit /b 1
)

call :rollback_to_backup "%1"
goto :eof
