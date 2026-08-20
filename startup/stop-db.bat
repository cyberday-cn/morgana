@echo off
title MariaDB - Stop

cd /d "%~dp0"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to change directory
    pause
    exit /b 1
)

echo.
echo ========================================
echo   MariaDB Database - Stopping
echo ========================================
echo.

where bash >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git Bash not found. Please install Git for Windows.
    pause
    exit /b 1
)

bash stop-db.sh %*

echo.
echo Press any key to close this window ...
pause >nul
