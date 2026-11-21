param(
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$CheckScript,
  [Parameter(Mandatory=$true)][string]$ConfigRoot,
  [Parameter(Mandatory=$true)][string]$OwnerId
)
$ErrorActionPreference='Stop'
$keyBytes=$null; $payload=$null
try {
  if ($OwnerId -cnotmatch '^tea-[a-z0-9]+$') { throw 'invalid owner' }
  $key=[Console]::In.ReadToEnd().Trim()
  if ($key -cnotmatch '^[a-zA-Z0-9_-]{16,256}$') { throw 'invalid key' }
  $paths=@('render-monitor-key.dpapi','render-monitor-owner.txt','security-monitor-enabled') | ForEach-Object { Join-Path $ConfigRoot $_ }
  foreach ($path in $paths) { if (Test-Path -LiteralPath $path) { throw 'already configured' } }
  $payload=@{ownerId=$OwnerId;apiKey=$key} | ConvertTo-Json -Compress
  $result=@($payload | & $NodePath $CheckScript 2>&1)
  if ($LASTEXITCODE -ne 0) { throw 'verification failed' }
  Add-Type -AssemblyName System.Security
  $keyBytes=[Text.Encoding]::UTF8.GetBytes($key)
  $protected=[System.Security.Cryptography.ProtectedData]::Protect($keyBytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  [System.IO.Directory]::CreateDirectory($ConfigRoot) | Out-Null
  # CreateNew prevents accidental replacement; enable only after both files exist.
  $file=[System.IO.File]::Open($paths[0],[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
  try { $file.Write($protected,0,$protected.Length) } finally { $file.Dispose() }
  $file=[System.IO.File]::Open($paths[1],[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
  try { $bytes=[Text.Encoding]::UTF8.GetBytes($OwnerId);$file.Write($bytes,0,$bytes.Length) } finally { $file.Dispose() }
  $file=[System.IO.File]::Open($paths[2],[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None);$file.Dispose()
  Write-Output 'Monitor de seguridad configurado y consulta verificada.'
} catch { Write-Error 'No se configuró el monitor; revise la clave, los permisos y la conexión.';exit 1 }
finally {if($keyBytes){[Array]::Clear($keyBytes,0,$keyBytes.Length)};$payload=$null;$key=$null}
