param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$projectPath = Split-Path $PSScriptRoot -Parent
$serverUrl = 'http://127.0.0.1:3000'
$pidFile = Join-Path $projectPath '.local-server.pid'
$stderrLog = Join-Path $projectPath '.local-server.err.log'
$nextCli = Join-Path $projectPath 'node_modules\next\dist\bin\next'
$launcherPath = Join-Path $PSScriptRoot 'launch-local.mjs'

function Show-LauncherMessage([string]$message) {
  if ($NoBrowser) {
    Write-Error $message
    return
  }
  $shell = New-Object -ComObject WScript.Shell
  $null = $shell.Popup($message, 0, 'Invest Dashboard', 48)
}

function Open-Dashboard {
  if (-not $NoBrowser) {
    $shell = New-Object -ComObject WScript.Shell
    $null = $shell.Run($serverUrl, 1, $false)
  }
}

function Read-ServerPid {
  if (-not (Test-Path $pidFile)) {
    return $null
  }

  $content = Get-Content -Raw $pidFile
  try {
    return [int](ConvertFrom-Json $content).pid
  } catch {
    return [int]$content
  }
}

try {
  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  $savedPid = Read-ServerPid
  if ($savedPid) {
    $savedProcess = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
    if ($savedProcess -and $savedProcess.ProcessName -eq 'node' -and $savedProcess.Path -eq $nodePath) {
      Open-Dashboard
      exit 0
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  }

  if (-not (Test-Path $nextCli) -or -not (Test-Path $launcherPath)) {
    throw 'Required files are missing. Run npm install in the project folder first.'
  }

  $launcherOutput = & $nodePath $launcherPath 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($launcherOutput -join [Environment]::NewLine)
  }

  $serverPid = Read-ServerPid
  if (-not $serverPid) {
    throw 'The server process ID was not created.'
  }

  $ready = $false
  for ($attempt = 0; $attempt -lt 120; $attempt++) {
    if (-not (Get-Process -Id $serverPid -ErrorAction SilentlyContinue)) {
      throw "The server did not start. Check the log: $stderrLog"
    }

    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $client.Connect('127.0.0.1', 3000)
      $client.Close()
      $ready = $true
      break
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    throw 'Server startup took more than one minute. Stop it and try again.'
  }

  Open-Dashboard
} catch {
  Show-LauncherMessage $_.Exception.Message
  exit 1
}
