@echo off
cd /d "%~dp0"

set SERVER_PORT=3001
set FRONTEND_PORT=5173

if exist env.conf (
    for /f "usebackq tokens=1,2 delims==" %%a in ("env.conf") do (
        if /i "%%a"==SERVER_PORT set SERVER_PORT=%%b
        if /i "%%a"==FRONTEND_PORT set FRONTEND_PORT=%%b
    )
)

echo.
echo ========================================
echo   Morgana System - Stopping Services
echo ========================================
echo.

netstat -ano > "%TEMP%\ns_all.txt"

echo [1/3] Stopping backend (port %SERVER_PORT%) ...
findstr /c:":%SERVER_PORT% " "%TEMP%\ns_all.txt" | findstr /c:LISTENING > "%TEMP%\ns_pid.txt" 2>nul
for /f "tokens=5" %%p in (%TEMP%\ns_pid.txt) do taskkill /f /pid %%p >nul 2>&1
echo   Ok

echo [2/3] Stopping frontend (port %FRONTEND_PORT%) ...
findstr /c:":%FRONTEND_PORT% " "%TEMP%\ns_all.txt" | findstr /c:LISTENING > "%TEMP%\ns_pid.txt" 2>nul
for /f "tokens=5" %%p in (%TEMP%\ns_pid.txt) do taskkill /f /pid %%p >nul 2>&1
echo   Ok

del "%TEMP%\ns_all.txt" "%TEMP%\ns_pid.txt" 2>nul
if exist logs\.running del logs\.running

echo.
echo ========================================
echo       All services stopped
echo ========================================
echo.

rem Wait 3 seconds then exit without requiring key press
%WINDIR%\System32\timeout.exe /t 3 /nobreak >nul
