@echo off
setlocal enabledelayedexpansion

set PATH=C:\Users\asus\node-v24.19.0-win-x64;C:\Program Files\Go\bin;%PATH%
set WORKSPACE_ROOT=%~dp0

echo ===============================================================================
echo                 ORION-X STUDIO // PHASE 4 MASTER RUNTIME
echo ===============================================================================

echo [1/5] Terminating previous ghost processes...
taskkill /f /im electron.exe /im watcher.exe 2>nul
timeout /t 1 /nobreak >nul

echo [2/5] Initializing Phase 2 Daemon Mesh...

:: 1. Launch Go AST Watcher Daemon on port 9042
echo  [-] Starting Go AST Watcher (localhost:9042)...
if exist "%WORKSPACE_ROOT%services\watcher\watcher.exe" (
    start "ORION-X AST Watcher" /b "%WORKSPACE_ROOT%services\watcher\watcher.exe" "%WORKSPACE_ROOT%"
) else (
    echo  [!] Warning: services\watcher\watcher.exe not found.
)

:: 2. Launch FastAPI Core Kernel on localhost:8000
echo  [-] Starting Python FastAPI Core Kernel (localhost:8000)...
if exist "%WORKSPACE_ROOT%.venv\Scripts\python.exe" (
    start "ORION-X FastAPI Kernel" /b "%WORKSPACE_ROOT%.venv\Scripts\python.exe" "%WORKSPACE_ROOT%services\backend\main.py"
) else (
    start "ORION-X FastAPI Kernel" /b python "%WORKSPACE_ROOT%services\backend\main.py"
)

echo [3/5] Verifying Daemon Cluster Telemetry...
timeout /t 3 /nobreak >nul
curl -s -m 4 http://127.0.0.1:8000/api/v1/health
echo.

echo [4/5] Checking static renderer assets...
if not exist "%WORKSPACE_ROOT%renderer\out\index.html" (
    echo  [-] Compiling visual assets...
    cd /d "%WORKSPACE_ROOT%renderer"
    call npm.cmd run build
    cd /d "%WORKSPACE_ROOT%"
) else (
    echo  [-] Production bundle ready.
)

echo [5/5] Launching ORION-X Studio Desktop Workspace...
cd /d "%WORKSPACE_ROOT%"
".\node_modules\electron\dist\electron.exe" main/dist/index.js

:: Cleanup background daemons on exit
echo Terminating background daemons...
taskkill /f /im watcher.exe 2>nul
