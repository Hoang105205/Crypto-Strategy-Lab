$ErrorActionPreference = 'Stop'

$frontendRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = (Resolve-Path (Join-Path $frontendRoot '..\..')).Path
$nextCli = '..\..\node_modules\next\dist\bin\next'
$playwrightCli = Join-Path $workspaceRoot 'node_modules\.bin\playwright.cmd'
$nodeExecutable = (Get-Command node).Source
$server = $null
$fixture = $null

Push-Location $frontendRoot
try {
  $env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:3201'
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed with exit code $LASTEXITCODE."
  }

  $fixture = Start-Process `
    -FilePath $nodeExecutable `
    -ArgumentList @('e2e\infrastructure-fixture.mjs') `
    -WorkingDirectory $frontendRoot `
    -WindowStyle Hidden `
    -PassThru

  $fixtureReady = $false
  $fixtureDeadline = (Get-Date).AddSeconds(15)
  do {
    if ($fixture.HasExited) {
      throw "Infrastructure fixture exited before readiness with code $($fixture.ExitCode)."
    }
    try {
      $fixtureResponse = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3201/health' -TimeoutSec 2
      $fixtureReady = $fixtureResponse.StatusCode -eq 200
    } catch {
      Start-Sleep -Milliseconds 250
    }
  } while (-not $fixtureReady -and (Get-Date) -lt $fixtureDeadline)

  if (-not $fixtureReady) {
    throw 'Infrastructure fixture did not become ready on port 3201 within 15 seconds.'
  }

  $server = Start-Process `
    -FilePath $nodeExecutable `
    -ArgumentList @($nextCli, 'start', '--hostname', '127.0.0.1', '--port', '3100') `
    -WorkingDirectory $frontendRoot `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  $deadline = (Get-Date).AddSeconds(30)
  do {
    if ($server.HasExited) {
      throw "Next production server exited before readiness with code $($server.ExitCode)."
    }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3100/leaderboard' -TimeoutSec 2
      $ready = $response.StatusCode -eq 200
    } catch {
      Start-Sleep -Milliseconds 250
    }
  } while (-not $ready -and (Get-Date) -lt $deadline)

  if (-not $ready) {
    throw 'Next production server did not become ready on port 3100 within 30 seconds.'
  }

  & $playwrightCli test @args
  exit $LASTEXITCODE
} finally {
  if ($null -ne $server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
  if ($null -ne $fixture -and -not $fixture.HasExited) {
    Stop-Process -Id $fixture.Id -Force
  }
  Remove-Item Env:NEXT_PUBLIC_API_URL -ErrorAction SilentlyContinue
  Pop-Location
}
