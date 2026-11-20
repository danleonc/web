param(
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$ScriptPath,
  [Parameter(Mandatory=$true)][string]$BackupRoot
)
$ErrorActionPreference = 'Stop'
$configRoot = Join-Path $env:LOCALAPPDATA 'NexafiaBackup'
$statePath = Join-Path $configRoot 'ultimo-estado.txt'
try {
  Add-Type -AssemblyName System.Security
  $keyBytes = [System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes((Join-Path $configRoot 'backup-key.dpapi')), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  if ($keyBytes.Length -ne 32) { throw 'Clave de respaldo inválida' }
  $env:NEXAFIA_BACKUP_KEY = ([BitConverter]::ToString($keyBytes)).Replace('-', '').ToLowerInvariant()
  [Array]::Clear($keyBytes, 0, $keyBytes.Length)
  [System.IO.Directory]::CreateDirectory($BackupRoot) | Out-Null
  $fileName = 'nexafia-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8) + '.enc'
  $target = Join-Path $BackupRoot $fileName
  & $NodePath $ScriptPath 'srv-dbr2npjl550s73c3mte0@ssh.oregon.render.com' (Join-Path $configRoot 'render_backup_ed25519') (Join-Path $configRoot 'known_hosts.render') $target
  if ($LASTEXITCODE -ne 0) { throw "Fallo del respaldo (código $LASTEXITCODE)" }
  # Only prune files made by this task, after a verified successful backup.
  $files = @(Get-ChildItem -LiteralPath $BackupRoot -File | Where-Object { $_.Name -cmatch '^nexafia-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}\.enc$' -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } | Sort-Object Name -Descending)
  foreach ($old in @($files | Select-Object -Skip 14)) { Remove-Item -LiteralPath $old.FullName -ErrorAction Stop }
  [System.IO.File]::WriteAllText($statePath, "OK $([DateTime]::UtcNow.ToString('o')) $fileName")
} catch {
  [System.IO.File]::WriteAllText($statePath, "ERROR $([DateTime]::UtcNow.ToString('o')) $($_.Exception.Message)")
  Write-Error $_
  exit 1
} finally {
  Remove-Item Env:NEXAFIA_BACKUP_KEY -ErrorAction SilentlyContinue
}
