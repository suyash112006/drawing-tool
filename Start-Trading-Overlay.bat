@echo off
title Trading Overlay Launcher

echo ========================================
echo Starting Trading Overlay...
echo ========================================
echo.

echo Closing existing instances...
taskkill /IM app.exe /F 2>nul
timeout /t 1 >nul

echo Launching Desktop Application...
:: Launch the compiled .exe file silently in the background
start "" "overlay-app\src-tauri\target\release\app.exe"

echo.
echo Success! Your server is permanently running in the cloud.
exit
