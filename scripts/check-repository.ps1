param(
  [switch]$ForceDownload
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$required = @(
  "AGENTS.md","APP_SPEC.md","app.config.json","dependencies.json","src\index.template.html",
  "build-standalone.ps1","scripts\build-self-extract.ps1","scripts\verify-standalone.ps1",
  "scripts\verify-self-extract.ps1","README.md","README.ja.md","LICENSE","THIRD_PARTY_NOTICES.md",
  "schemas\app-config.schema.json","schemas\dependencies.schema.json"
)
foreach ($relative in $required) {
  $path = Join-Path $Root $relative
  if (-not (Test-Path $path)) { throw "Required repository file is missing: $relative" }
}

$selfExtractBuilderPath = Join-Path $Root "scripts\build-self-extract.ps1"
$selfExtractBuilderBytes = [System.IO.File]::ReadAllBytes($selfExtractBuilderPath)
$selfExtractBuilderStart = 0
if (
  $selfExtractBuilderBytes.Length -ge 3 -and
  $selfExtractBuilderBytes[0] -eq 0xef -and
  $selfExtractBuilderBytes[1] -eq 0xbb -and
  $selfExtractBuilderBytes[2] -eq 0xbf
) {
  $selfExtractBuilderStart = 3
}
for ($index = $selfExtractBuilderStart; $index -lt $selfExtractBuilderBytes.Length; $index += 1) {
  if ($selfExtractBuilderBytes[$index] -gt 0x7f) {
    throw "scripts\build-self-extract.ps1 must contain ASCII text only so Windows PowerShell 5.1 cannot corrupt loader text."
  }
}
$app = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "app.config.json") | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace([string]$app.name)) { throw "app.config.json: name is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.slug)) { throw "app.config.json: slug is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.version)) { throw "app.config.json: version is required" }

$template = [IO.File]::ReadAllText((Join-Path $Root "src\index.template.html"), [Text.Encoding]::UTF8)
foreach ($token in @("__APP_CONFIG_JSON__","__BUILD_MANIFEST_JSON__","__EMBEDDED_ASSET_BUNDLE_JSON__")) {
  $count = ([regex]::Matches($template, [regex]::Escape($token))).Count
  if ($count -ne 1) { throw "$token must occur exactly once; found $count." }
}

$buildArguments = @{}
if ($ForceDownload) { $buildArguments.ForceDownload = $true }
& (Join-Path $Root "build-standalone.ps1") @buildArguments

$selfExtract = Join-Path $Root "dist\index.self-extract.html"
if (Test-Path $selfExtract) { & (Join-Path $Root "scripts\verify-self-extract.ps1") -Path $selfExtract -ExpectedSourcePath (Join-Path $Root "dist\index.html") }
Write-Host "[OK] Repository check passed." -ForegroundColor Green
