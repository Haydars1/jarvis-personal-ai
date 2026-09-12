@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title JARVIS v6.3 - Cloud Upgrade

echo ================================================
echo JARVIS v6.3 - WRANGLER SECRET FIX
echo ================================================
echo.

where.exe node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo Close this window, install Node.js LTS, then run this file again.
  pause
  exit /b 1
)

where.exe npx.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npx.cmd was not found. Reinstall Node.js LTS.
  pause
  exit /b 1
)

for /f "delims=" %%V in ('node --version') do set "NODEVER=%%V"
echo Node.js detected: !NODEVER!

set "D1JSON=%TEMP%\jarvis-v63-d1-%RANDOM%.json"
set "SECRETS=%TEMP%\jarvis-v63-secrets-%RANDOM%.json"
set "HEALTH=%TEMP%\jarvis-v63-health-%RANDOM%.json"

call npx.cmd wrangler@latest whoami
if errorlevel 1 (
  echo.
  echo Opening Cloudflare login...
  call npx.cmd wrangler@latest login
  if errorlevel 1 goto :fail
)

echo.
echo [1/7] Checking D1 binding...
call npx.cmd wrangler@latest d1 list --json > "%D1JSON%"
if errorlevel 1 goto :fail
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0WRITE-D1-CONFIG.ps1" -JsonPath "%D1JSON%" -ConfigPath "%~dp0wrangler.jsonc"
if errorlevel 1 goto :fail

echo.
echo [2/7] Applying database schema...
call npx.cmd wrangler@latest d1 execute jarvis-db --remote --file="%~dp0schema.sql"
if errorlevel 1 goto :fail

echo.
echo [3/7] Reading Cloudflare secret list...
call npx.cmd wrangler@latest secret list --format json > "%SECRETS%"
if errorlevel 1 goto :fail

echo.
echo [4/7] Checking credential vault key...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0CHECK-SECRETS.ps1" -JsonPath "%SECRETS%" -Name "CREDENTIAL_MASTER_KEY"
set "SECRET_RESULT=!ERRORLEVEL!"
if "!SECRET_RESULT!"=="2" (
  echo Creating CREDENTIAL_MASTER_KEY...
  for /f "usebackq delims=" %%i in (`powershell.exe -NoProfile -Command "$b=New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Fill($b); [Convert]::ToBase64String($b)"`) do set "MASTER=%%i"
  if not defined MASTER goto :fail
  echo(!MASTER!| call npx.cmd wrangler@latest secret put CREDENTIAL_MASTER_KEY
  if errorlevel 1 goto :fail
) else if not "!SECRET_RESULT!"=="0" (
  goto :fail
) else (
  echo Existing CREDENTIAL_MASTER_KEY preserved.
)

echo.
echo [5/7] Checking JARVIS session secret...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0CHECK-SECRETS.ps1" -JsonPath "%SECRETS%" -Name "JARVIS_SECRET"
set "SECRET_RESULT=!ERRORLEVEL!"
if "!SECRET_RESULT!"=="2" (
  echo Creating JARVIS_SECRET...
  for /f "usebackq delims=" %%i in (`powershell.exe -NoProfile -Command "$b=New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Fill($b); [Convert]::ToBase64String($b)"`) do set "JSECRET=%%i"
  if not defined JSECRET goto :fail
  echo(!JSECRET!| call npx.cmd wrangler@latest secret put JARVIS_SECRET
  if errorlevel 1 goto :fail
) else if not "!SECRET_RESULT!"=="0" (
  goto :fail
) else (
  echo Existing JARVIS_SECRET preserved.
)

echo.
echo [6/7] Deploying Worker...
call npx.cmd wrangler@latest deploy
if errorlevel 1 goto :fail

echo.
echo [7/7] Testing live health endpoint...
for /l %%I in (1,1,8) do (
  timeout /t 2 /nobreak >nul
  curl.exe -s -f "https://jarvis-personal-ai.haydojarvis.workers.dev/api/health" > "%HEALTH%" 2>nul
  if not errorlevel 1 goto :healthy
)

echo [WARNING] Deploy finished but automatic health check did not respond.
echo Open: https://jarvis-personal-ai.haydojarvis.workers.dev/api/health
goto :done

:healthy
echo.
echo [SUCCESS] JARVIS v6.3 is live:
type "%HEALTH%"
echo.
echo Open: https://jarvis-personal-ai.haydojarvis.workers.dev
start "" "https://jarvis-personal-ai.haydojarvis.workers.dev"
goto :done

:fail
echo.
echo [ERROR] Upgrade/deploy stopped here. Send the last error lines from this window.
del "%D1JSON%" >nul 2>nul
del "%SECRETS%" >nul 2>nul
del "%HEALTH%" >nul 2>nul
pause
exit /b 1

:done
del "%D1JSON%" >nul 2>nul
del "%SECRETS%" >nul 2>nul
del "%HEALTH%" >nul 2>nul
pause
exit /b 0
