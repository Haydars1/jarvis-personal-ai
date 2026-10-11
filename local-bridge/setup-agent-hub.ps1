# JARVIS Agent Hub — Windows local AI bootstrap (safe, no deployment)
# Run in PowerShell from the repository root:
#   powershell -ExecutionPolicy Bypass -File .\local-bridge\setup-agent-hub.ps1
$ErrorActionPreference = 'Stop'
function Need($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
Write-Host 'JARVIS Agent Hub - Yerel AI kurulumu' -ForegroundColor Cyan
if (-not (Need 'git')) { Write-Warning 'Git bulunamadi. Git for Windows kurun: https://git-scm.com/downloads/win' }
if (-not (Need 'node')) { Write-Warning 'Node.js bulunamadi. https://nodejs.org/' }
if (-not (Need 'ollama')) {
    if (Need 'winget') {
        Write-Host 'Ollama, Windows paket yoneticisiyle kuruluyor...'
        winget install --id Ollama.Ollama --exact --source winget --accept-package-agreements --accept-source-agreements
    } else {
        throw 'Ollama bulunamadi ve winget yok. https://ollama.com/download/windows adresinden yukleyip yeniden calistirin.'
    }
}
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
    $exe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
    if (Test-Path $exe) { $ollamaExe = $exe }
    else { throw 'Ollama yuklendi ancak bu terminalde bulunamadi. PowerShell penceresini yeniden acin.' }
} else { $ollamaExe = $ollama.Source }
Write-Host 'Qwen2.5 Coder 7B modeli indiriliyor (yaklasik 4.7 GB)...'
& $ollamaExe pull qwen2.5-coder:7b
if ($LASTEXITCODE -ne 0) { throw 'Model indirilemedi. Ollama servisinin calistigini kontrol edin.' }
Write-Host 'Yerel model kontrolu:' -ForegroundColor Green
& $ollamaExe list
Write-Host 'Kurulum tamamlandi. Kullanmak icin: ollama run qwen2.5-coder:7b' -ForegroundColor Green
Write-Host 'JARVIS Cloudflare Worker, localhost uzerindeki Ollama servisine dogrudan ulasamaz.'
Write-Host 'Guvenli kimlik dogrulamali local bridge kurulmadan internet uzerinden port acmayin.'
