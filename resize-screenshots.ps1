# Resize screenshots for Chrome Web Store requirements
# Target: 1280x800 or 640x400, 24-bit PNG/JPEG, no alpha

$sourcePath = "c:\Users\dubey\extension\ss"
$outputPath = "c:\Users\dubey\extension\ss\webstore"

# Create output directory
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

Write-Host "Resizing screenshots for Chrome Web Store..." -ForegroundColor Cyan

# Get all PNG files from source
$screenshots = Get-ChildItem -Path $sourcePath -Filter "*.png"

foreach ($file in $screenshots) {
    Write-Host "`nProcessing: $($file.Name)" -ForegroundColor Yellow
    
    # Load the image
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    
    $originalWidth = $img.Width
    $originalHeight = $img.Height
    Write-Host "  Original: ${originalWidth}x${originalHeight}"
    
    # Target dimensions (1280x800 for better quality)
    $targetWidth = 1280
    $targetHeight = 800
    
    # Calculate aspect ratios
    $sourceRatio = $originalWidth / $originalHeight
    $targetRatio = $targetWidth / $targetHeight
    
    # Calculate new dimensions (fit inside target, maintain aspect ratio)
    if ($sourceRatio -gt $targetRatio) {
        # Image is wider - fit to width
        $newWidth = $targetWidth
        $newHeight = [int]($targetWidth / $sourceRatio)
    } else {
        # Image is taller - fit to height
        $newHeight = $targetHeight
        $newWidth = [int]($targetHeight * $sourceRatio)
    }
    
    # Calculate padding to center image
    $offsetX = [int](($targetWidth - $newWidth) / 2)
    $offsetY = [int](($targetHeight - $newHeight) / 2)
    
    Write-Host "  Resized: ${newWidth}x${newHeight} (centered in ${targetWidth}x${targetHeight})"
    
    # Create new bitmap with black background
    $newImg = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($newImg)
    
    # Fill with dark background (#1a1a1a to match extension theme)
    $darkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 26, 26))
    $graphics.FillRectangle($darkBrush, 0, 0, $targetWidth, $targetHeight)
    
    # Set high quality rendering
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Draw resized image centered
    $graphics.DrawImage($img, $offsetX, $offsetY, $newWidth, $newHeight)
    
    # Save as PNG (24-bit, no alpha)
    $outputFile = Join-Path $outputPath $file.Name
    $newImg.Save($outputFile, [System.Drawing.Imaging.ImageFormat]::Png)
    
    Write-Host "  Saved: $outputFile" -ForegroundColor Green
    
    # Cleanup
    $graphics.Dispose()
    $newImg.Dispose()
    $img.Dispose()
    $darkBrush.Dispose()
}

Write-Host "`n✅ Done! Screenshots saved to: $outputPath" -ForegroundColor Green
Write-Host "   Total files: $($screenshots.Count)" -ForegroundColor Cyan
Write-Host "`nReady to upload to Chrome Web Store!" -ForegroundColor Yellow
