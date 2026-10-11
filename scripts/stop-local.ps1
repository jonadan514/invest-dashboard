param(
  [switch]$NoMessage
)

$ErrorActionPreference = 'Stop'

$projectPath = Split-Path $PSScriptRoot -Parent
$pidFile = Join-Path $projectPath '.local-server.pid'

function Show-LauncherMessage([string]$message, [int]$icon = 64) {
  if ($NoMessage) {
    Write-Output $message
    return
  }
  $shell = New-Object -ComObject WScript.Shell
  $null = $shell.Popup($message, 0, 'Invest Dashboard', $icon)
}

try {
  if (-not (Test-Path $pidFile)) {
    Show-LauncherMessage 'The dashboard is not running.'
    exit 0
  }

  $state = ConvertFrom-Json (Get-Content -Raw $pidFile)
  $savedPid = [int]$state.pid
  $serverProcess = Get-Process -Id $savedPid -ErrorAction SilentlyContinue

  if (-not $serverProcess) {
    Remove-Item -LiteralPath $pidFile -Force
    Show-LauncherMessage 'The dashboard is already stopped.'
    exit 0
  }

  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  if ($serverProcess.ProcessName -ne 'node' -or $serverProcess.Path -ne $nodePath) {
    throw 'The saved process is not the dashboard server, so it was not stopped.'
  }

  if ($state.startedAt) {
    $expectedStart = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$state.startedAt).LocalDateTime
    if ([Math]::Abs(($serverProcess.StartTime - $expectedStart).TotalSeconds) -gt 10) {
      throw 'The saved process start time does not match, so it was not stopped.'
    }
  }

  & taskkill.exe /PID $savedPid /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Windows could not stop the dashboard server.'
  }

  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  Show-LauncherMessage 'The dashboard has been stopped.'
} catch {
  Show-LauncherMessage $_.Exception.Message 48
  exit 1
}
