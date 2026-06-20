# Remove 1–2px black frame artifact from left edge of tribal tile
Add-Type -AssemblyName System.Drawing

$path = Join-Path $PSScriptRoot "assets\tribal-border.png"
$img = [System.Drawing.Bitmap]::FromFile($path)
$origW = $img.Width
$h = $img.Height

$left = 0
for ($x = 0; $x -lt 3; $x++) {
  $minBright = 255
  for ($y = 0; $y -lt $h; $y++) {
    $p = $img.GetPixel($x, $y)
    $b = ($p.R + $p.G + $p.B) / 3.0
    if ($b -lt $minBright) { $minBright = $b }
  }
  if ($minBright -lt 100) { $left = $x + 1 }
}

$newW = $origW - $left
$out = New-Object System.Drawing.Bitmap $newW, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.DrawImage($img, 0, 0, (New-Object System.Drawing.Rectangle $left, 0, $newW, $h), [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

$tmp = Join-Path $PSScriptRoot "assets\tribal-border-new.png"
$out.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
$out.Dispose()
Move-Item -Force $tmp $path

Write-Host "Tile: ${newW}x${h} (trimmed $left px from left)" -ForegroundColor Green
