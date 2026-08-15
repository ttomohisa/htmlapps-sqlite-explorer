param(
  [Parameter(Mandatory = $true)][string]$Path,
  [bool]$RequireNetworkBlock = $true
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if (-not (Test-Path $Path)) { throw "Standalone HTML not found: $Path" }
$html = [IO.File]::ReadAllText((Resolve-Path $Path), [Text.Encoding]::UTF8)
foreach ($placeholder in @("__APP_CONFIG_JSON__", "__BUILD_MANIFEST_JSON__", "__EMBEDDED_ASSET_BUNDLE_BASE64__")) {
  if ($html.Contains($placeholder)) { throw "Unresolved placeholder: $placeholder" }
}
if ($RequireNetworkBlock -and $html -notmatch "connect-src\s+'none'") { throw "CSP must include connect-src 'none'." }
if ($html -match '<script[^>]+src\s*=\s*["''][^"''>]+') { throw "Standalone HTML contains an external script src." }
if ($html -match '<link[^>]+href\s*=\s*["'']https?://') { throw "Standalone HTML contains a remote stylesheet/link." }
if ($html -notmatch 'SQLite Explorer') { throw "App title not found." }
if ((Get-Item $Path).Length -lt 50000) { throw "Standalone HTML is unexpectedly small." }
Write-Host "[OK] Standalone verification passed: $Path" -ForegroundColor Green
