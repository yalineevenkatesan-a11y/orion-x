@echo off
set PATH=C:\Users\asus\node-v24.19.0-win-x64;%PATH%

echo [1/3] Clearing ghost background processes...
taskkill /f /im electron.exe /im node.exe 2>nul
timeout /t 1 /nobreak >nul

echo [2/3] Compiling static visual assets...
cd /d "C:\Users\asus\.gemini\antigravity\scratch\orion-x-studio\renderer"
call npm run build

echo [3/3] Launching ORION-X Studio V4 Workspace...
cd /d "C:\Users\asus\.gemini\antigravity\scratch\orion-x-studio"
".\node_modules\electron\dist\electron.exe" main/dist/index.js