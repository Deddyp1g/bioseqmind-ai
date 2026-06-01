$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Logs = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null

if (-not (Test-Path (Join-Path $Backend ".env"))) {
  Copy-Item (Join-Path $Backend ".env.example") (Join-Path $Backend ".env")
}

if (-not (Test-Path (Join-Path $Frontend ".env.local"))) {
  Copy-Item (Join-Path $Frontend ".env.local.example") (Join-Path $Frontend ".env.local")
}

if (-not (Test-Path (Join-Path $Backend ".venv"))) {
  py -3.11 -m venv (Join-Path $Backend ".venv")
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

Start-Process -FilePath "npm" `
  -ArgumentList "run dev" `
  -WorkingDirectory $Frontend `
  -RedirectStandardOutput (Join-Path $Logs "frontend.log") `
  -RedirectStandardError (Join-Path $Logs "frontend.err.log")

Write-Host "BioSeqMind-AI started"
Write-Host "Frontend: http://localhost:5174"
Write-Host "Backend:  http://127.0.0.1:8008/api/health"
