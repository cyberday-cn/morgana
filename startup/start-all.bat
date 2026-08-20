@echo off
title Morgana - Start All

cd /d "%~dp0"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to change directory
    pause
    exit /b 1
)

set SERVER_PORT=3001
set FRONTEND_PORT=5173
set DB_HOST=localhost
set DB_PORT=3306
set DB_DATABASE=morgana
set DB_USER=root
set DB_PASSWORD=
if exist env.conf (
    for /f "usebackq tokens=1,2 delims==" %%a in ("env.conf") do (
        if /i "%%a"=="SERVER_PORT" set "SERVER_PORT=%%b"
        if /i "%%a"=="FRONTEND_PORT" set "FRONTEND_PORT=%%b"
        if /i "%%a"=="DB_HOST" set "DB_HOST=%%b"
        if /i "%%a"=="DB_PORT" set "DB_PORT=%%b"
        if /i "%%a"=="DB_DATABASE" set "DB_DATABASE=%%b"
        if /i "%%a"=="DB_USER" set "DB_USER=%%b"
        if /i "%%a"=="DB_PASSWORD" set "DB_PASSWORD=%%b"
    )
)

set "BACKEND_DIR=%~dp0..\backend"
set "FRONTEND_DIR=%~dp0..\frontend"
set "LOG_DIR=%~dp0logs"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "FRONTEND_LOG=%LOG_DIR%\frontend.log"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

set DB_HOST=%DB_HOST%
set DB_PORT=%DB_PORT%
set DB_DATABASE=%DB_DATABASE%
set DB_USER=%DB_USER%
set DB_PASSWORD=%DB_PASSWORD%
set SERVER_PORT=%SERVER_PORT%

echo.
echo ========================================
echo   Morgana System - Starting Services
echo ========================================
echo.

if exist "%BACKEND_LOG%" (
  echo   Removing old backend.log...
  del "%BACKEND_LOG%" 2>nul
  if exist "%BACKEND_LOG%" (
    echo   Retrying backend.log deletion...
    timeout /t 1 /nobreak >nul
    del "%BACKEND_LOG%" 2>nul
  )
)
if exist "%FRONTEND_LOG%" (
  del "%FRONTEND_LOG%" 2>nul
)

echo [1/2] Starting backend (port %SERVER_PORT%)...
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden cmd.exe -ArgumentList '/c cd /d %BACKEND_DIR% && npx tsx watch src/index.ts > %BACKEND_LOG% 2>&1'"

timeout /t 3 /nobreak >nul

echo [2/2] Starting frontend (port %FRONTEND_PORT%)...
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden cmd.exe -ArgumentList '/c cd /d %FRONTEND_DIR% && npx vite --port %FRONTEND_PORT% --strictPort > %FRONTEND_LOG% 2>&1'"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Backend:  http://localhost:%SERVER_PORT%
echo   Frontend: http://localhost:%FRONTEND_PORT%
echo ========================================
echo.
echo Press any key to close this window ...
pause >nul
