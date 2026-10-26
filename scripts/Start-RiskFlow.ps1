$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Use-ProjectTools.ps1')
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExecutable = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
$nodeExecutable = Join-Path $projectRoot '.tools\node-v24.22.0-win-x64\node.exe'
$viteExecutable = Join-Path $projectRoot 'frontend\node_modules\vite\bin\vite.js'
foreach ($path in @($pythonExecutable, $viteExecutable)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing $path. Follow README setup instructions first." }
}
foreach ($port in @(8000, 5173)) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    try { $probe.Start() } catch { throw "Port $port is already in use. Stop the existing service before launching RiskFlow." } finally { $probe.Stop() }
}
$logDirectory = Join-Path $projectRoot '.cache\dev'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$backendProcess = $null
$frontendProcess = $null
try {
    $backendProcess = Start-Process -FilePath $pythonExecutable -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'backend.log') -RedirectStandardError (Join-Path $logDirectory 'backend-error.log')
    $frontendProcess = Start-Process -FilePath $nodeExecutable -ArgumentList @('"' + $viteExecutable + '"') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'frontend.log') -RedirectStandardError (Join-Path $logDirectory 'frontend-error.log')
    foreach ($url in @('http://127.0.0.1:8000/api/v1/health', 'http://127.0.0.1:5173')) {
        $ready = $false
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if ($backendProcess.HasExited -or $frontendProcess.HasExited) { throw "A service exited. Inspect $logDirectory." }
            try {
                $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
                if ($response.StatusCode -eq 200) { $ready = $true; break }
            } catch { Start-Sleep -Milliseconds 250 }
        }
        if (-not $ready) { throw "Service did not become ready: $url. Inspect $logDirectory." }
    }
    Write-Host 'RiskFlow is ready: http://127.0.0.1:5173'
    Write-Host 'Keep this terminal open. Ctrl+C stops both local services.'
    while (-not $backendProcess.HasExited -and -not $frontendProcess.HasExited) { Start-Sleep -Seconds 1 }
} finally {
    foreach ($process in @($frontendProcess, $backendProcess)) {
        if ($null -ne $process -and -not $process.HasExited) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue }
    }
}
