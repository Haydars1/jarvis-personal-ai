param([Parameter(Mandatory=$true)][string]$JsonPath,[Parameter(Mandatory=$true)][string]$ConfigPath,[switch]$WithR2)
$ErrorActionPreference='Stop'
$list=(Get-Content -Raw -LiteralPath $JsonPath)|ConvertFrom-Json
$db=@($list)|Where-Object {$_.name -eq 'jarvis-db'}|Select-Object -First 1
if(-not $db){Write-Error 'jarvis-db bulunamadi';exit 2}
$id=$db.uuid;if(-not $id){$id=$db.id};if(-not $id){$id=$db.database_id};if(-not $id){Write-Error 'database_id okunamadi';exit 3}
$config=[ordered]@{
 '$schema'='./node_modules/wrangler/config-schema.json';name='jarvis-personal-ai';main='src/worker.js';compatibility_date='2026-09-12';
 assets=[ordered]@{directory='./public';binding='ASSETS';not_found_handling='single-page-application'};
 d1_databases=@([ordered]@{binding='DB';database_name='jarvis-db';database_id=[string]$id});
 ai=[ordered]@{binding='AI'};
 triggers=[ordered]@{crons=@('*/30 * * * *')};observability=[ordered]@{enabled=$true}
}
if($WithR2){$config.r2_buckets=@([ordered]@{binding='FILES';bucket_name='jarvis-files'})}
$json=$config|ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($ConfigPath,$json,(New-Object Text.UTF8Encoding($false)))
Write-Host "D1 binding: $id" -ForegroundColor Green
if($WithR2){Write-Host 'R2 binding: jarvis-files' -ForegroundColor Green}else{Write-Host 'R2 kullanilmiyor; JARVIS yine calisacak.' -ForegroundColor Yellow}
