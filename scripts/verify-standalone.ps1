param(
  [Parameter(Mandatory = $true)][string]$Path,
  [bool]$RequireNetworkBlock = $true
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if (-not (Test-Path $Path)) { throw "Standalone HTML not found: $Path" }
$html = [IO.File]::ReadAllText((Resolve-Path $Path), [Text.Encoding]::UTF8)
foreach ($placeholder in @("__APP_CONFIG_JSON__", "__BUILD_MANIFEST_JSON__", "__EMBEDDED_ASSET_BUNDLE_JSON__")) {
  if ($html.Contains($placeholder)) { throw "Unresolved placeholder: $placeholder" }
}
if ($RequireNetworkBlock -and $html -notmatch "connect-src\s+'none'") { throw "CSP must include connect-src 'none'." }
if ($html -match '<script[^>]+src\s*=\s*["''][^"''>]+') { throw "Standalone HTML contains an external script src." }
if ($html -match '<link[^>]+href\s*=\s*["'']https?://') { throw "Standalone HTML contains a remote stylesheet/link." }
if ($html -notmatch 'SQLite Explorer') { throw "App title not found." }
if ($html -notmatch '\"encoding\":\"gzip\"') { throw "Standalone HTML must contain a gzip-compressed embedded asset." }
if ($html -notmatch 'new\s+DecompressionStream\(["'']gzip["'']\)') { throw "Standalone HTML is missing the gzip decompressor." }

$bundleMatch = [regex]::Match(
  $html,
  'const\s+assetBundle=(?<json>\{.*?\});\s*function\s+decodeBase64Bytes',
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)
if (-not $bundleMatch.Success) { throw "The embedded asset bundle could not be parsed." }
$bundle = $bundleMatch.Groups["json"].Value | ConvertFrom-Json
$gzipAssetFound = $false
foreach ($dependencyProperty in $bundle.dependencies.PSObject.Properties) {
  foreach ($assetProperty in $dependencyProperty.Value.assets.PSObject.Properties) {
    $asset = $assetProperty.Value
    if ([string]$asset.encoding -ne "gzip") { continue }
    $gzipAssetFound = $true
    try {
      $compressedBytes = [Convert]::FromBase64String([string]$asset.base64)
    } catch {
      throw "Embedded gzip asset '$($dependencyProperty.Name)/$($assetProperty.Name)' is not valid Base64: $($_.Exception.Message)"
    }
    $input = New-Object System.IO.MemoryStream
    $input.Write($compressedBytes, 0, $compressedBytes.Length)
    $input.Position = 0
    $output = New-Object System.IO.MemoryStream
    try {
      $gzip = New-Object System.IO.Compression.GZipStream -ArgumentList @($input, [System.IO.Compression.CompressionMode]::Decompress)
      try { $gzip.CopyTo($output) } finally { $gzip.Dispose() }
      $restoredBytes = $output.ToArray()
    } finally {
      $output.Dispose()
      $input.Dispose()
    }
    if ($asset.originalBytes -and $restoredBytes.Length -ne [int64]$asset.originalBytes) {
      throw "Embedded gzip asset '$($dependencyProperty.Name)/$($assetProperty.Name)' restored to an unexpected byte length."
    }
  }
}
if (-not $gzipAssetFound) { throw "No gzip-compressed embedded asset was found." }
if ((Get-Item $Path).Length -lt 50000) { throw "Standalone HTML is unexpectedly small." }
Write-Host "[OK] Standalone verification passed: $Path" -ForegroundColor Green
