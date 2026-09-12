@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title JARVIS ULTIMATE - ONE FILE SETUP
echo ================================================
echo JARVIS ULTIMATE - TEK KURULUM / DEPLOY
echo ================================================
echo.
where.exe node >nul 2>nul || (echo [HATA] Node.js LTS kurulu degil.& pause & exit /b 1)
where.exe npx.cmd >nul 2>nul || (echo [HATA] npx bulunamadi.& pause & exit /b 1)
for /f "delims=" %%V in ('node --version') do echo Node.js: %%V
echo.
echo [1/8] Cloudflare oturumu kontrol ediliyor...
call npx.cmd wrangler@latest whoami || (call npx.cmd wrangler@latest login || goto :fail)
set "D1JSON=%TEMP%\jarvis-d1-%RANDOM%.json"
set "SECRETS=%TEMP%\jarvis-secret-%RANDOM%.json"
echo [2/8] D1 kontrol ediliyor...
call npx.cmd wrangler@latest d1 list --json > "%D1JSON%" 2>nul || goto :fail
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0WRITE-CONFIG.ps1" -JsonPath "%D1JSON%" -ConfigPath "%~dp0wrangler.jsonc" >nul 2>nul
if errorlevel 2 (
  echo jarvis-db olusturuluyor...
  call npx.cmd wrangler@latest d1 create jarvis-db --location weur || goto :fail
  call npx.cmd wrangler@latest d1 list --json > "%D1JSON%" 2>nul || goto :fail
)
echo [3/8] R2 kontrol ediliyor - basarisiz olursa atlanacak...
set "WITHR2=0"
call npx.cmd wrangler@latest r2 bucket list > "%TEMP%\jarvis-r2-%RANDOM%.txt" 2>nul
call npx.cmd wrangler@latest r2 bucket list 2>nul | findstr /i /c:"jarvis-files" >nul && set "WITHR2=1"
if "!WITHR2!"=="0" (
  call npx.cmd wrangler@latest r2 bucket create jarvis-files >nul 2>nul
  if not errorlevel 1 set "WITHR2=1"
)
if "!WITHR2!"=="1" (powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0WRITE-CONFIG.ps1" -JsonPath "%D1JSON%" -ConfigPath "%~dp0wrangler.jsonc" -WithR2) else (powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0WRITE-CONFIG.ps1" -JsonPath "%D1JSON%" -ConfigPath "%~dp0wrangler.jsonc")
if errorlevel 1 goto :fail
echo [4/8] Veritabani semasi uygulan?yor...
call npx.cmd wrangler@latest d1 execute jarvis-db --remote --file="%~dp0schema.sql" --yes || goto :fail
echo [5/8] Secret listesi okunuyor...
call npx.cmd wrangler@latest secret list --format json > "%SECRETS%" 2>nul || goto :fail
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0CHECK-SECRET.ps1" -Path "%SECRETS%" -Name "CREDENTIAL_MASTER_KEY"
if errorlevel 2 (
 for /f "delims=" %%K in ('powershell -NoProfile -Command "$b=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Fill($b);[Convert]::ToBase64String($b)"') do set "K=%%K"
 echo(!K!| call npx.cmd wrangler@latest secret put CREDENTIAL_MASTER_KEY || goto :fail
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0CHECK-SECRET.ps1" -Path "%SECRETS%" -Name "JARVIS_SECRET"
if errorlevel 2 (
 for /f "delims=" %%K in ('powershell -NoProfile -Command "$b=New-Object byte[] 48;[Security.Cryptography.RandomNumberGenerator]::Fill($b);[Convert]::ToBase64String($b)"') do set "K=%%K"
 echo(!K!| call npx.cmd wrangler@latest secret put JARVIS_SECRET || goto :fail
)
echo [6/8] Yerel syntax + Cloudflare dry-run testi...
node --check src\worker.js || goto :fail
node --check public\app.js || goto :fail
call npx.cmd wrangler@latest deploy --dry-run --outdir .wrangler-dry >nul || goto :fail
echo [7/8] Canli deploy...
call npx.cmd wrangler@latest deploy || goto :fail
echo [8/8] Health check...
for /l %%I in (1,1,10) do (
 timeout /t 2 /nobreak >nul
 curl.exe -s -f "https://jarvis-personal-ai.haydojarvis.workers.dev/api/health" > "%TEMP%\jarvis-health.txt" 2>nul && goto :ok
)
echo [UYARI] Deploy tamamlandi ama otomatik health check cevap vermedi.
goto :done
:ok
echo.
echo [BASARILI] JARVIS canli:
type "%TEMP%\jarvis-health.txt"
echo.
start "" "https://jarvis-personal-ai.haydojarvis.workers.dev"
goto :done
:fail
echo.
echo [HATA] Kurulum durdu. Bu pencereyi kapatma; son satirlar ger?ek hatayi g?sterir.
pause
exit /b 1
:done
del "%D1JSON%" >nul 2>nul
del "%SECRETS%" >nul 2>nul
pause
exit /b 0
