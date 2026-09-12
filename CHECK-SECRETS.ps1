param(
  [Parameter(Mandatory=$true)][string]$JsonPath,
  [Parameter(Mandatory=$true)][string]$Name
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $JsonPath)) {
  Write-Error "Secret listesi bulunamadi: $JsonPath"
  exit 3
}
try {
  $raw = Get-Content -Raw -LiteralPath $JsonPath
  $items = $raw | ConvertFrom-Json
} catch {
  Write-Error "Secret JSON okunamadi: $($_.Exception.Message)"
  exit 4
}
$found = @($items) | Where-Object { $_.name -eq $Name } | Select-Object -First 1
if ($found) { exit 0 }
exit 2
