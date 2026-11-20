param(
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$HealthScript,
  [Parameter(Mandatory=$true)][string]$ConfigRoot,
  [switch]$TestNoPopup
)
$ErrorActionPreference='Stop'
try {
  $message = @(& $NodePath $HealthScript $ConfigRoot 2>&1)
  if ($LASTEXITCODE -eq 0) { exit 0 }
  $description = ($message -join "`n")
  if ([string]::IsNullOrWhiteSpace($description)) { $description='No se pudo comprobar el respaldo.' }
} catch { $description='No se pudo comprobar el respaldo de Nexafia.' }
if ($TestNoPopup) { Write-Output $description; exit 1 }
try {
  $shell = New-Object -ComObject WScript.Shell
  $null = $shell.Popup("$description`n`nAbre Codex para revisar el estado de Nexafia.", 60, 'Nexafia: revisa su estado', 48)
} catch { Write-Error 'No se pudo mostrar el aviso de estado de Nexafia.' }
exit 1
