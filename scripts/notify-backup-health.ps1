param(
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$HealthScript,
  [Parameter(Mandatory=$true)][string]$ConfigRoot,
  [switch]$TestNoPopup
)
$ErrorActionPreference='Stop'
try {
  $message = @(& $NodePath $HealthScript $ConfigRoot 2>&1)
  $description = if ($LASTEXITCODE -eq 0) { '' } else { $message -join "`n" }
  if ($LASTEXITCODE -ne 0 -and [string]::IsNullOrWhiteSpace($description)) { $description='No se pudo comprobar el respaldo.' }
} catch { $description='No se pudo comprobar el respaldo de Nexafia.' }
$enabledPath = Join-Path $ConfigRoot 'security-monitor-enabled'
if (Test-Path -LiteralPath $enabledPath) {
  try {
    Add-Type -AssemblyName System.Security
    $keyBytes = [System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes((Join-Path $ConfigRoot 'render-monitor-key.dpapi')), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $owner = [System.IO.File]::ReadAllText((Join-Path $ConfigRoot 'render-monitor-owner.txt')).Trim()
    $payload = @{ownerId=$owner;apiKey=[Text.Encoding]::UTF8.GetString($keyBytes)} | ConvertTo-Json -Compress
    $securityScript = Join-Path (Split-Path -Parent $HealthScript) 'render-security-monitor.mjs'
    $securityResult = @($payload | & $NodePath $securityScript 2>&1)
    if ($LASTEXITCODE -ne 0) { $description = (@($description) + $securityResult | Where-Object { $_ }) -join "`n" }
  } catch { $description = (@($description) + 'No se pudo comprobar el monitor de seguridad de Render.' | Where-Object { $_ }) -join "`n" }
  finally { if ($keyBytes) { [Array]::Clear($keyBytes,0,$keyBytes.Length) }; $payload=$null }
}
if ([string]::IsNullOrWhiteSpace($description)) { exit 0 }
if ($TestNoPopup) { Write-Output $description; exit 1 }
try {
  $shell = New-Object -ComObject WScript.Shell
  $null = $shell.Popup("$description`n`nAbre Codex para revisar el estado de Nexafia.", 60, 'Nexafia: revisa su estado', 48)
} catch { Write-Error 'No se pudo mostrar el aviso de estado de Nexafia.' }
exit 1
