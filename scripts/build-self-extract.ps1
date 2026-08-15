param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$AppName = "SQLite Explorer",
  [string]$AppNameJa = "SQLite Explorer"
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if (-not (Test-Path $InputPath)) { throw "Input not found: $InputPath" }
$bytes = [IO.File]::ReadAllBytes((Resolve-Path $InputPath))
$sha = (Get-FileHash -Algorithm SHA256 -Path $InputPath).Hash.ToLowerInvariant()
$ms = New-Object IO.MemoryStream
$gzip = New-Object IO.Compression.GZipStream($ms, [IO.Compression.CompressionMode]::Compress, $true)
try { $gzip.Write($bytes, 0, $bytes.Length) } finally { $gzip.Dispose() }
$payload = [Convert]::ToBase64String($ms.ToArray())
$ms.Dispose()
$safeName = [System.Net.WebUtility]::HtmlEncode($AppName)
$safeNameJa = [System.Net.WebUtility]::HtmlEncode($AppNameJa)
$wrapper = @"
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'">
<title>$safeName - Self Extract</title>
<style>
:root{--bg:#f5f5f2;--surface:#fff;--text:#20211f;--muted:#666963;--line:#dadbd6;--accent:#16624f}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}.card{width:min(540px,100%);padding:26px;border:1px solid var(--line);border-radius:18px;background:var(--surface);box-shadow:0 12px 34px rgba(25,28,24,.08)}.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:var(--accent);color:white;font-weight:900}.sub{color:var(--muted);font-size:13px;line-height:1.7}.button{width:100%;min-height:46px;border:0;border-radius:11px;background:var(--accent);color:#fff;font-weight:800;cursor:pointer}.meta{margin-top:14px;color:var(--muted);font:11px ui-monospace,monospace;overflow-wrap:anywhere}.status{margin:12px 0;font-size:12px;color:var(--muted)}
</style>
</head>
<body>
<main class="card" data-sha256="$sha">
<div class="mark">DB</div>
<h1>$safeNameJa</h1>
<p class="sub">このファイルには、完全内包版の <code>index.html</code> が圧縮されています。ボタンを押すとブラウザー内だけで展開して保存します。</p>
<p class="sub">This file contains the compressed standalone <code>index.html</code>. Extraction happens only in your browser.</p>
<div class="status" id="status">Ready</div>
<button class="button" id="extract" type="button">index.html を展開 / Extract</button>
<div class="meta">SHA-256: $sha</div>
</main>
<script>
const PAYLOAD="$payload";
const status=document.getElementById("status");
document.getElementById("extract").onclick=async()=>{
  try{
    status.textContent="Extracting…";
    const raw=Uint8Array.from(atob(PAYLOAD),c=>c.charCodeAt(0));
    if(!("DecompressionStream" in window)) throw new Error("This browser does not support DecompressionStream.");
    const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"));
    const blob=await new Response(stream).blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="index.html";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent="Done";
  }catch(e){status.textContent=e.message||String(e)}
};
</script>
</body>
</html>
"@
$outDir = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
[IO.File]::WriteAllText($OutputPath, $wrapper, (New-Object Text.UTF8Encoding($false)))
$outputSha = (Get-FileHash -Algorithm SHA256 -Path $OutputPath).Hash.ToLowerInvariant()
$manifest = [ordered]@{
  schemaVersion = 1
  source = [ordered]@{ file = [IO.Path]::GetFileName($InputPath); bytes = $bytes.Length; sha256 = $sha }
  selfExtract = [ordered]@{ file = [IO.Path]::GetFileName($OutputPath); bytes = (Get-Item $OutputPath).Length; sha256 = $outputSha; compression = "gzip" }
}
$manifestPath = Join-Path (Split-Path -Parent $OutputPath) "self-extract-manifest.json"
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding($false)))
Write-Host "[OK] Self-extracting HTML: $OutputPath" -ForegroundColor Green
