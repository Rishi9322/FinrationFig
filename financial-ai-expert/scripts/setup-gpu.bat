@echo off
:: GPU Setup Script for Local CMA AI — Windows
:: Installs Ollama, pulls Qwen 2.5 7B, verifies GPU acceleration
echo.
echo =====================================================
echo  Local CMA AI — GPU Setup (Windows)
echo  Model: Qwen 2.5 7B Instruct (Q4_K_M, ~5 GB)
echo =====================================================
echo.

:: 1. Check for NVIDIA GPU
echo [1/5] Checking for NVIDIA GPU...
nvidia-smi >nul 2>&1
if %errorlevel% neq 0 (
  echo WARNING: nvidia-smi not found. CPU inference will be used.
  echo          For GPU: install NVIDIA drivers from https://nvidia.com/drivers
) else (
  echo OK — NVIDIA GPU detected:
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
)
echo.

:: 2. Check / install Ollama
echo [2/5] Checking Ollama...
where ollama >nul 2>&1
if %errorlevel% neq 0 (
  echo Ollama not found. Downloading installer...
  powershell -Command "Invoke-WebRequest -Uri 'https://ollama.ai/download/OllamaSetup.exe' -OutFile '%TEMP%\OllamaSetup.exe'"
  echo Running Ollama installer — follow the prompts...
  start /wait %TEMP%\OllamaSetup.exe
) else (
  echo OK — Ollama already installed:
  ollama --version
)
echo.

:: 3. Start Ollama service
echo [3/5] Starting Ollama service...
tasklist /FI "IMAGENAME eq ollama.exe" 2>nul | find /I "ollama.exe" >nul
if %errorlevel% neq 0 (
  start /B ollama serve
  timeout /t 3 /nobreak >nul
  echo Ollama service started.
) else (
  echo Ollama service already running.
)
echo.

:: 4. Pull Qwen 2.5 7B model
echo [4/5] Pulling Qwen 2.5 7B Instruct (Q4_K_M)...
echo This downloads ~5 GB. Please wait...
ollama pull qwen2.5:7b
echo.
echo Pulling embedding model (all-minilm, 80 MB)...
ollama pull all-minilm
echo.

:: 5. Verify GPU is used
echo [5/5] Verifying GPU acceleration...
ollama run qwen2.5:7b "Reply with one word: GPU" --nowordwrap
echo.

:: 6. Start the Financial AI Expert server
echo =====================================================
echo  Setup complete!
echo  Starting Financial AI Expert server on port 3001...
echo =====================================================
echo.
cd /d "%~dp0.."
npm start
