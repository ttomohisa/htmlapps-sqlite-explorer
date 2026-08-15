@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-standalone.ps1" %*
if errorlevel 1 (
  echo.
  echo Build failed.
  exit /b 1
)
echo.
echo Build completed.
