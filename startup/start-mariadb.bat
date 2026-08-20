@echo off
title MariaDB - Start
cd /d "%~dp0"
if errorlevel 1 ( echo [ERROR] Failed to change directory & pause & exit /b 1 )

echo ========================================
echo   MariaDB Database - Starting
echo ========================================
echo.

set "MARIADB_HOME=C:\tools\mariadb-11.4.5-winx64"

set "DB_PORT=3306"
set "DB_DATABASE=morgana"
if exist env.conf (
    for /f "usebackq delims=" %%i in (env.conf) do (
        for /f "tokens=1,2 delims==" %%a in ("%%i") do (
            if /i "%%a"=="DB_PORT" set "DB_PORT=%%b"
            if /i "%%a"=="DB_DATABASE" set "DB_DATABASE=%%b"
        )
    )
)

set "DATA_DIR=%MARIADB_HOME%\data"

REM --- First-time init ---
if not exist "%DATA_DIR%\ibdata1" (
    echo Initializing MariaDB data directory ...

    set "INIT_TOOL="
    if exist "%MARIADB_HOME%\bin\mariadb-install-db.exe" set "INIT_TOOL=%MARIADB_HOME%\bin\mariadb-install-db.exe"
    if exist "%MARIADB_HOME%\bin\mysql_install_db.exe" set "INIT_TOOL=%MARIADB_HOME%\bin\mysql_install_db.exe"

    if not defined INIT_TOOL (
        echo [ERROR] Cannot find mariadb-install-db.exe or mysql_install_db.exe
        echo        Check MARIADB_HOME=%MARIADB_HOME%
        pause & exit /b 1
    )

    "%INIT_TOOL%" --datadir="%DATA_DIR%"
    if errorlevel 1 ( echo [ERROR] Init failed & pause & exit /b 1 )
    echo Init complete
)

REM --- Check if already running ---
echo Starting MariaDB (port %DB_PORT%) ...
"%MARIADB_HOME%\bin\mysqladmin.exe" -u root -h 127.0.0.1 --port=%DB_PORT% ping >nul 2>&1
if errorlevel 1 goto start_db

echo MariaDB is already running
goto check_db

:start_db
REM --- Start mysqld as detached process (survives bat exit) ---
REM Use .NET Process API with CreateNoWindow=true to:
REM   1. Create a fully detached process (not killed when bat exits)
REM   2. No blank console window for mysqld (vs Start-Process creates one)
REM Outer -WindowStyle Minimized avoids the PowerShell flash window
REM without risking the parent CMD auto-hiding (known -WindowStyle Hidden quirk).
powershell -WindowStyle Minimized -NoProfile -Command "[System.Diagnostics.Process]::Start([System.Diagnostics.ProcessStartInfo]@{FileName='%MARIADB_HOME%\bin\mysqld.exe';Arguments='--datadir=\"%DATA_DIR%\" --port=%DB_PORT% --skip-grant-tables';WindowStyle=[System.Diagnostics.ProcessWindowStyle]::Hidden;CreateNoWindow=$true;UseShellExecute=$false})" >nul 2>&1

REM --- Wait up to 20 seconds ---
set RETRIES=0
:wait_loop
"%MARIADB_HOME%\bin\mysql.exe" -u root -h 127.0.0.1 --port=%DB_PORT% -e "SELECT 1" >nul 2>&1
if not errorlevel 1 goto check_db
set /a RETRIES+=1
if %RETRIES% lss 20 goto wait_loop
echo [ERROR] MariaDB startup timeout
pause & exit /b 1

:check_db
REM --- Create database if not exists ---
"%MARIADB_HOME%\bin\mysql.exe" -u root -h 127.0.0.1 --port=%DB_PORT% -e "CREATE DATABASE IF NOT EXISTS %DB_DATABASE% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >nul 2>&1

echo MariaDB ready (port %DB_PORT%)
echo.
echo Press any key to close this window...
pause >nul
