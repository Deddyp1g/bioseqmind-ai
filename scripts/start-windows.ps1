$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Logs = Join-Path $Root "logs"
$Tmp = Join-Path $Root ".tmp"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null

$env:TEMP = $Tmp
$env:TMP = $Tmp
$env:NEXT_TELEMETRY_DISABLED = "1"

if (-not (Test-Path (Join-Path $Backend ".env"))) {
  Copy-Item (Join-Path $Backend ".env.example") (Join-Path $Backend ".env")
}

if (-not (Test-Path (Join-Path $Frontend ".env.local"))) {
  Copy-Item (Join-Path $Frontend ".env.local.example") (Join-Path $Frontend ".env.local")
}

function Resolve-PythonCommand {
  $candidates = @(
    @("py", "-3.11"),
    @("py", "-3.10"),
    @("py", "-3.9"),
    @("python")
  )

  foreach ($candidate in $candidates) {
    $exe = $candidate[0]
    $args = @()
    if ($candidate.Length -gt 1) {
      $args = $candidate[1..($candidate.Length - 1)]
    }

    try {
      & $exe @args --version *> $null
      return @{
        Exe = $exe
        Args = $args
      }
    } catch {
      continue
    }
  }

  throw "No usable Python interpreter found. Install Python 3.9+ and ensure py.exe or python.exe is on PATH."
}

if (-not (Test-Path (Join-Path $Backend ".venv"))) {
  $python = Resolve-PythonCommand
  & $python.Exe @($python.Args + @("-m", "venv", (Join-Path $Backend ".venv")))
}

& (Join-Path $Backend ".venv\Scripts\python.exe") -m pip install -r (Join-Path $Backend "requirements.txt")

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
  Push-Location $Frontend
  npm install
  Pop-Location
}

Start-Process -FilePath (Join-Path $Backend ".venv\Scripts\python.exe") `
  -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8008" `
  -WorkingDirectory $Backend `
  -RedirectStandardOutput (Join-Path $Logs "backend.log") `
  -RedirectStandardError (Join-Path $Logs "backend.err.log")

npm.cmd run build --prefix $Frontend

Start-Process -FilePath "npm" `
  -ArgumentList "run start" `
  -WorkingDirectory $Frontend `
  -RedirectStandardOutput (Join-Path $Logs "frontend.log") `
  -RedirectStandardError (Join-Path $Logs "frontend.err.log")

Write-Host "BioSeqMind-AI started"
Write-Host "Frontend: http://localhost:5174"
Write-Host "Backend:  http://127.0.0.1:8008/api/health"
