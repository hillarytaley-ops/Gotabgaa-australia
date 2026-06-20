# Extract tribal border without black frame lines
Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$srcPath = Join-Path $root "assets\logo.png"
$outPath = Join-Path $root "assets\tribal-border.png"

$img = [System.Drawing.Bitmap]::FromFile($srcPath)

$cropX = 30
$cropY = 178
$cropW = 62
$cropH = 520

$cropRect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropW, $cropH
$cropped = $img.Clone($cropRect, $img.PixelFormat)

$rotW = $cropped.Height
$rotH = $cropped.Width
$rotated = New-Object System.Drawing.Bitmap $rotW, $rotH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$g = [System.Drawing.Graphics]::FromImage($rotated)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::Transparent)
$g.TranslateTransform($rotW, 0)
$g.RotateTransform(90)
$g.DrawImage($cropped, 0, 0)
$g.Dispose()

function TrimDarkEdges($bmp) {
  $left = 0
  $right = $bmp.Width - 1

  while ($left -lt $bmp.Width) {
    $sum = 0
    for ($y = 0; $y -lt $bmp.Height; $y++) {
      $p = $bmp.GetPixel($left, $y)
      $sum += ($p.R + $p.G + $p.B) / 3.0
    }
    if (($sum / $bmp.Height) -gt 80) { break }
    $left++
  }

  while ($right -gt $left) {
    $sum = 0
    for ($y = 0; $y -lt $bmp.Height; $y++) {
      $p = $bmp.GetPixel($right, $y)
      $sum += ($p.R + $p.G + $p.B) / 3.0
    }
    if (($sum / $bmp.Height) -gt 80) { break }
    $right--
  }

  return @($left, $right)
}

$trim = TrimDarkEdges $rotated
$trimLeft = $trim[0]
$trimRight = $trim[1]
$newW = $trimRight - $trimLeft + 1
$newH = $rotated.Height

$final = New-Object System.Drawing.Bitmap $newW, $newH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$fg = [System.Drawing.Graphics]::FromImage($final)
$fg.DrawImage($rotated, 0, 0, (New-Object System.Drawing.Rectangle $trimLeft, 0, $newW, $newH), [System.Drawing.GraphicsUnit]::Pixel)
$fg.Dispose()

$final.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved ${newW}x${newH}" -ForegroundColor Green

$cropped.Dispose()
$rotated.Dispose()
$final.Dispose()
$img.Dispose()
