# Trim stray edge pixels from tribal border
Add-Type -AssemblyName System.Drawing
$path = Join-Path $PSScriptRoot "assets\tribal-border.png"
$img = [System.Drawing.Bitmap]::FromFile($path)
$trimL = 1
$trimR = $img.Width - 3
$newW = $trimR - $trimL + 1
$newH = $img.Height
$out = New-Object System.Drawing.Bitmap $newW, $newH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.DrawImage($img, 0, 0, (New-Object System.Drawing.Rectangle $trimL, 0, $newW, $newH), [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
$out.Dispose()
Write-Host "Trimmed to ${newW}x${newH}"
