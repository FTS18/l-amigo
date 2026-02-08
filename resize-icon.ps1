# Resize logo to 128x128 for Chrome Web Store

Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\dubey\extension\public\android-chrome-192x192.png"
$outputPath = "c:\Users\dubey\extension\store-icon-128.png"

Write-Host "Resizing icon to 128x128..." -ForegroundColor Cyan

$img = [System.Drawing.Image]::FromFile($sourcePath)
$newImg = New-Object System.Drawing.Bitmap(128, 128)
$graphics = [System.Drawing.Graphics]::FromImage($newImg)

# High quality resize
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.DrawImage($img, 0, 0, 128, 128)

$newImg.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

Write-Host "✅ Icon saved: $outputPath" -ForegroundColor Green

$graphics.Dispose()
$newImg.Dispose()
$img.Dispose()
