param([string]$ReportPath = "", [string]$JarvisUrl = "https://hayirlievlad.haydojarvis.workers.dev")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw "Node.js kurulu olmali." }
if (-not $ReportPath) { $ReportPath = Read-Host "ECU ID raporu tam dosya yolu (.txt, .json, .pdf)" }
$ReportPath = [System.IO.Path]::GetFullPath($ReportPath.Trim([char]34))
if (-not (Test-Path -LiteralPath $ReportPath -PathType Leaf)) { throw "Rapor bulunamadi: $ReportPath" }
if (-not $env:JARVIS_BRIDGE_TOKEN) {
  $secret = Read-Host -AsSecureString "Jarvis ECU Studio -> CIHAZ bolumunden Bridge token"
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try { $env:JARVIS_BRIDGE_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
if (-not $env:JARVIS_BRIDGE_TOKEN) { throw "Bridge token gerekli." }
$env:JARVIS_URL = $JarvisUrl.TrimEnd("/")
$env:ECU_ADAPTER_URL = "http://127.0.0.1:8765"
$env:ECU_IDENTITY_FILE = $ReportPath
Write-Host "ECU kimligi icin salt-okunur yerel kopru baslatiliyor."
$adapter = Start-Process -FilePath $node.Source -ArgumentList @((Join-Path $root "ecu-identity-report-adapter.mjs")) -NoNewWindow -PassThru
try {
  Start-Sleep -Seconds 2
  if ($adapter.HasExited) { throw "Yerel rapor adaptoru acilamadi. 8765 portunu kontrol et." }
  & $node.Source (Join-Path $root "ecu-bridge.mjs")
} finally {
  if ($adapter -and -not $adapter.HasExited) { Stop-Process -Id $adapter.Id -Force -ErrorAction SilentlyContinue }
  Remove-Item Env:JARVIS_BRIDGE_TOKEN -ErrorAction SilentlyContinue
}
