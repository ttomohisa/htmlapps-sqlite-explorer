param([Parameter(Mandatory = $true)][string]$Path)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if (-not (Test-Path $Path)) { throw "Self-extract HTML not found: $Path" }
$html = [IO.File]::ReadAllText((Resolve-Path $Path), [Text.Encoding]::UTF8)
if ($html -notmatch 'DecompressionStream') { throw "Extractor logic was not found." }
if ($html -notmatch "connect-src\s+'none'") { throw "Self-extract CSP must block connections." }
if ($html -notmatch 'data-sha256="[0-9a-f]{64}"') { throw "Original SHA-256 metadata was not found." }
Write-Host "[OK] Self-extract verification passed." -ForegroundColor Green
