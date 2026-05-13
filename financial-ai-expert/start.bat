@echo off
echo.
echo ============================================
echo Financial AI Expert - Quick Start
echo ============================================
echo.

REM Check Node.js installation
node -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

REM Check if ollama is running
echo Checking Ollama connection...
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -ErrorAction Stop | Out-Null; Write-Host 'OK' } catch { Write-Host 'FAILED' }" >nul 2>&1

if errorlevel 1 (
    echo.
    echo WARNING: Ollama appears to be offline
    echo Please start Ollama before running the system
    echo.
    echo To start Ollama:
    echo   - Windows: Ollama should run as a background service after installation
    echo   - If not, open Command Prompt and run: ollama serve
    echo.
    echo To pull models:
    echo   - ollama pull mistral
    echo   - ollama pull neural-chat
    echo.
    pause
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo Starting services...
echo.
echo 1. API Server will run on:  http://localhost:3001
echo 2. Dashboard will run on:   http://localhost:3000
echo.

REM Start API in one window
start cmd /k "npm start"

REM Wait a moment for API to start
timeout /t 3 /nobreak

REM Start dashboard in another window
start cmd /k "npm run dashboard"

REM Wait and open browser
timeout /t 3 /nobreak

REM Try to open browser
start http://localhost:3000

echo.
echo Dashboard opening in your browser...
echo.
echo If browser doesn't open automatically, visit: http://localhost:3000
echo.
echo Press Ctrl+C in any terminal to stop services
echo.

pause
