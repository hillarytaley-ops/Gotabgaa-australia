# Simple static file server — no Python/Node required
$port = 8080
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

$url = "http://localhost:$port"
Write-Host "Gotabgaa Australia site running at:" -ForegroundColor Green
Write-Host "  $url" -ForegroundColor Cyan
Write-Host "Opening browser..." -ForegroundColor DarkGray
try {
  Start-Process $url
} catch {
  cmd /c start "" $url
}
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  $path = [System.Uri]::UnescapeDataString($request.Url.LocalPath)
  if ($path -eq '/') { $path = '/index.html' }

  $file = Join-Path $root ($path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar))

  if (Test-Path $file -PathType Leaf) {
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $response.ContentType = $mime[$ext]
    if (-not $response.ContentType) { $response.ContentType = 'application/octet-stream' }
    $bytes = [IO.File]::ReadAllBytes($file)
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $response.StatusCode = 404
    $body = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
    $response.ContentType = 'text/plain'
    $response.ContentLength64 = $body.Length
    $response.OutputStream.Write($body, 0, $body.Length)
  }

  $response.Close()
}
