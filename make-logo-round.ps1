# Regenerate circular logo with transparent corners (no white square)
Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "assets\logo.png"
$outPath = Join-Path $PSScriptRoot "assets\logo-round.png"

if (-not (Test-Path $srcPath)) {
  Write-Error "Source logo not found: $srcPath"
  exit 1
}

$src = [System.Drawing.Image]::FromFile($srcPath)
$size = [Math]::Min($src.Width, $src.Height)
$bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(0, 0, $size, $size)
$g.SetClip($path)

$offsetX = ($src.Width - $size) / 2
$offsetY = ($src.Height - $size) / 2
$srcRect = New-Object System.Drawing.Rectangle $offsetX, $offsetY, $size, $size
$destRect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
$g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()
$g.Dispose()
$bmp.Dispose()

Write-Host "Saved circular logo: $outPath" -ForegroundColor Green
