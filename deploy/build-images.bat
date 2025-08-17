@echo off
REM Build script for Ever Life Vault Docker images
REM This script builds the images with the correct names for the deploy script

echo [%date% %time%] Building Ever Life Vault Docker images...

REM Configuration
set APP_NAME=ever-life-vault
set FRONTEND_IMAGE=%APP_NAME%/web:latest
set BACKEND_IMAGE=%APP_NAME%/backend:latest

REM Build frontend image (SSL-enabled nginx)
echo [%date% %time%] Building frontend image: %FRONTEND_IMAGE%
docker build -t "%FRONTEND_IMAGE%" .

if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Frontend image build failed
    exit /b 1
) else (
    echo [%date% %time%] ✓ Frontend image built successfully
)

REM Build backend image
echo [%date% %time%] Building backend image: %BACKEND_IMAGE%
docker build -t "%BACKEND_IMAGE%" ./server

if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Backend image build failed
    exit /b 1
) else (
    echo [%date% %time%] ✓ Backend image built successfully
)

REM Show built images
echo [%date% %time%] Built images:
docker images | findstr "%APP_NAME%"

echo.
echo 🎉 All images built successfully!
echo.
echo Next steps:
echo 1. Run the deployment script: deploy\deploy.sh
echo 2. Or manually start containers:
echo    docker run -d --name %APP_NAME%_backend_1 -p 8787:8787 %BACKEND_IMAGE%
echo    docker run -d --name %APP_NAME%_web_1 -p 80:80 -p 443:443 %FRONTEND_IMAGE%
echo.
echo The web app will be available at:
echo   HTTP:  http://localhost (redirects to HTTPS)
echo   HTTPS: https://localhost
echo.
pause
