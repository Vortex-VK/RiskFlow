$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeDirectory = Join-Path $projectRoot '.tools\node-v24.22.0-win-x64'
$uvDirectory = Join-Path $projectRoot '.tools\uv'
foreach ($executable in @((Join-Path $nodeDirectory 'node.exe'), (Join-Path $uvDirectory 'uv.exe'))) {
    if (-not (Test-Path -LiteralPath $executable)) {
        throw "Project runtime missing: $executable. See README setup instructions."
    }
}
$env:PATH = "$nodeDirectory;$uvDirectory;$env:PATH"
$env:UV_PYTHON_INSTALL_DIR = Join-Path $projectRoot '.tools\python'
$env:UV_CACHE_DIR = Join-Path $projectRoot '.cache\uv'
$env:npm_config_cache = Join-Path $projectRoot '.cache\npm'
