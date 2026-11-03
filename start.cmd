@echo off
rem Starts AnimeHub for local development: the local database and the web server.
rem Double-click this file, or run it from a terminal in the project folder.
title AnimeHub launcher
cd /d "%~dp0"

if not exist node_modules (
  echo [setup] node_modules not found. Installing packages...
  call npm install
  if errorlevel 1 (
    echo [error] npm install failed.
    pause
    exit /b 1
  )
)

if not exist .env.local (
  echo [error] .env.local not found. Copy .env.example to .env.local and fill in the values.
  pause
  exit /b 1
)

echo [db] Starting the local database in a new window...
start "AnimeHub DB" cmd /k npm run db:dev

echo [open] The browser opens http://localhost:3000/th in about 10 seconds.
start "" cmd /c "timeout /t 10 /nobreak >nul & start http://localhost:3000/th"

echo [web] Starting the web server. Press Ctrl+C here to stop it.
call npm run dev
pause
