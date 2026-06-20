@echo off
cd /d "%~dp0"
echo Starting Gotabgaa Australia website...
echo Browser will open at http://localhost:8080
echo.
start "" "http://localhost:8080"
powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
