param(
  [Parameter(Mandatory=$true)][string]$JsonPath,
  [Parameter(Mandatory=$true)][string]$ConfigPath
)
$ErrorActionPreference='Stop'
$raw = Get-Content -Raw -LiteralPath $JsonPath
$list = $raw | ConvertFrom-Json
$db = @($list) | Where-Object { $_.name -eq 'jarvis-db' } | Select-Object -First 1
if (-not $db) { Write-Error 'jarvis-db bulunamadi'; exit 2 }
$id = $db.uuid
if (-not $id) { $id = $db.id }
if (-not $id) { $id = $db.database_id }
if (-not $id) { Write-Error 'jarvis-db bulundu fakat database_id okunamadi'; exit 3 }
$config = [ordered]@{
  '$schema' = './node_modules/wrangler/config-schema.json'
  name = 'jarvis-personal-ai'
  main = 'src/worker.js'
  compatibility_date = '2026-09-12'
  assets = [ordered]@{
    directory = './public'
    binding = 'ASSETS'
    not_found_handling = 'single-page-application'
  }
  d1_databases = @(
    [ordered]@{
      binding = 'DB'
      database_name = 'jarvis-db'
      database_id = [string]$id
    }
  )
  observability = [ordered]@{ enabled = $true }
}
$json = $config | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ConfigPath, $json, $utf8NoBom)
Write-Host "DB binding yazildi: $id" -ForegroundColor Green
