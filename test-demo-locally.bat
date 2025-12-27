@echo off
REM Local Demo Testing Script for HomeScreen Hero (Windows)
REM This script helps you test the demo setup locally before deploying to Railway

echo.
echo 🎬 HomeScreen Hero - Local Demo Test
echo ====================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)

echo ✅ Docker is running
echo.

REM Build the Docker image
echo 📦 Building Docker image (this may take 5-10 minutes)...
docker build -t homescreen-hero-demo:local .

if errorlevel 1 (
    echo ❌ Docker build failed. Check the output above for errors.
    exit /b 1
)

echo ✅ Docker image built successfully
echo.

REM Create a temporary data directory for local testing
if not exist "demo-data\logs" mkdir demo-data\logs

REM Copy demo config to the data directory
if exist "config.demo.yaml" (
    copy config.demo.yaml demo-data\config.yaml >nul
    echo ✅ Demo config copied to demo-data\config.yaml
) else (
    echo ⚠️  Warning: config.demo.yaml not found. Using default config.
)

echo.
echo 🚀 Starting HomeScreen Hero Demo...
echo.
echo Container will be available at: http://localhost:8000
echo Login credentials:
echo   Username: admin
echo   Password: demo
echo.
echo Press Ctrl+C to stop the container
echo.

REM Stop and remove existing container if it exists
docker stop homescreen-hero-demo >nul 2>&1
docker rm homescreen-hero-demo >nul 2>&1

REM Run the container
docker run -it --rm ^
  --name homescreen-hero-demo ^
  -p 8000:8000 ^
  -v "%CD%\demo-data:/data" ^
  -e HSH_AUTH_PASSWORD=demo ^
  -e HSH_AUTH_SECRET_KEY=local-demo-secret-key ^
  -e HSH_PLEX_TOKEN=mock-token ^
  -e HSH_TRAKT_CLIENT_ID=mock-client-id ^
  -e HOMESCREEN_HERO_DB=sqlite:////data/homescreen_hero.sqlite ^
  -e HOMESCREEN_HERO_LOG_DIR=/data/logs ^
  -e HOMESCREEN_HERO_CONFIG=/data/config.yaml ^
  homescreen-hero-demo:local

echo.
echo ✅ Container stopped
echo.
echo 📁 Demo data is preserved in demo-data\ directory
echo    To clean up: rmdir /s /q demo-data
