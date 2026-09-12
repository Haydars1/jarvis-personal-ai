param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][string]$Name)
$ErrorActionPreference='Stop';$raw=Get-Content -Raw -LiteralPath $Path
try{$x=$raw|ConvertFrom-Json}catch{Write-Error "Secret listesi JSON degil: $($_.Exception.Message)";exit 3}
if(@($x)|Where-Object {$_.name -eq $Name}){exit 0};exit 2
