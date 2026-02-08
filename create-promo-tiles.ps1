# Generate promo tiles for Chrome Web Store
Add-Type -AssemblyName System.Drawing

$logoPath = "c:\Users\dubey\extension\public\android-chrome-192x192.png"
$logo = [System.Drawing.Image]::FromFile($logoPath)

Write-Host "`n🎨 Creating Small Promo Tile (440x280)..." -ForegroundColor Cyan

# Small Promo Tile
$smallTile = New-Object System.Drawing.Bitmap(440, 280)
$g = [System.Drawing.Graphics]::FromImage($smallTile)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

# Background gradient
$rect = New-Object System.Drawing.Rectangle(0, 0, 440, 280)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(26, 26, 26), [System.Drawing.Color]::FromArgb(45, 45, 45), 135)
$g.FillRectangle($brush, $rect)

# Orange glow circle
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(300, 150, 200, 200)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(50, 255, 161, 22)
$glowBrush.SurroundColors = @([System.Drawing.Color]::Transparent)
$g.FillPath($glowBrush, $glowPath)

# Logo
$logoSize = 70
$logoX = (440 - $logoSize) / 2
$logoY = 70
$g.DrawImage($logo, $logoX, $logoY, $logoSize, $logoSize)

# Title
$titleFont = New-Object System.Drawing.Font("Segoe UI", 32, [System.Drawing.FontStyle]::Bold)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$titleSize = $g.MeasureString("L'Amigo", $titleFont)
$g.DrawString("L'Amigo", $titleFont, $whiteBrush, (440 - $titleSize.Width) / 2, 160)

# Subtitle
$subtitleFont = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$orangeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 161, 22))
$subtitleSize = $g.MeasureString("Track LeetCode Friends", $subtitleFont)
$g.DrawString("Track LeetCode Friends", $subtitleFont, $orangeBrush, (440 - $subtitleSize.Width) / 2, 210)

$smallTile.Save("c:\Users\dubey\extension\small-promo-440x280.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "✅ Saved: small-promo-440x280.png" -ForegroundColor Green

$g.Dispose()
$smallTile.Dispose()

# ===================================
Write-Host "`n🎨 Creating Marquee Promo Tile (1400x560)..." -ForegroundColor Cyan

# Marquee Promo Tile
$marqueeTile = New-Object System.Drawing.Bitmap(1400, 560)
$g = [System.Drawing.Graphics]::FromImage($marqueeTile)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

# Background gradient
$rect = New-Object System.Drawing.Rectangle(0, 0, 1400, 560)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(26, 26, 26), [System.Drawing.Color]::FromArgb(45, 45, 45), 135)
$g.FillRectangle($brush, $rect)

# Orange glow
$glowPath2 = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath2.AddEllipse(1100, 300, 400, 400)
$glowBrush2 = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath2)
$glowBrush2.CenterColor = [System.Drawing.Color]::FromArgb(40, 255, 161, 22)
$glowBrush2.SurroundColors = @([System.Drawing.Color]::Transparent)
$g.FillPath($glowBrush2, $glowPath2)

# Logo
$logoSize = 90
$logoX = 100
$logoY = 150
$g.DrawImage($logo, $logoX, $logoY, $logoSize, $logoSize)

# Title
$titleFont = New-Object System.Drawing.Font("Segoe UI", 48, [System.Drawing.FontStyle]::Bold)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString("L'Amigo", $titleFont, $whiteBrush, 220, 165)

# Subtitle
$subtitleFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$orangeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 161, 22))
$g.DrawString("LeetCode Friends Tracker", $subtitleFont, $orangeBrush, 220, 225)

# Description
$descFont = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Regular)
$grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(224, 224, 224))
$g.DrawString("Track friends' progress, compare stats side-by-side,", $descFont, $grayBrush, 100, 290)
$g.DrawString("and auto-sync to GitHub. Stay motivated together!", $descFont, $grayBrush, 100, 318)

# Badge
$badgePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$badgeRect = New-Object System.Drawing.RectangleF(100, 380, 200, 45)
$radius = 8
$badgePath.AddArc($badgeRect.X, $badgeRect.Y, $radius * 2, $radius * 2, 180, 90)
$badgePath.AddArc($badgeRect.Right - $radius * 2, $badgeRect.Y, $radius * 2, $radius * 2, 270, 90)
$badgePath.AddArc($badgeRect.Right - $radius * 2, $badgeRect.Bottom - $radius * 2, $radius * 2, $radius * 2, 0, 90)
$badgePath.AddArc($badgeRect.X, $badgeRect.Bottom - $radius * 2, $radius * 2, $radius * 2, 90, 90)
$badgePath.CloseFigure()
$badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 161, 22))
$g.FillPath($badgeBrush, $badgePath)

$badgeFont = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
$blackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 26, 26))
$badgeText = "Free & Open Source"
$badgeTextSize = $g.MeasureString($badgeText, $badgeFont)
$g.DrawString($badgeText, $badgeFont, $blackBrush, 200 - $badgeTextSize.Width / 2, 390)

# Privacy
$privacyFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Regular)
$lightGrayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(197, 203, 211))
$g.DrawString("★★★★★  100% Privacy", $privacyFont, $lightGrayBrush, 320, 390)

# Chart box
$chartX = 950
$chartY = 180
$chartSize = 300
$chartPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$chartRect = New-Object System.Drawing.RectangleF($chartX, $chartY, $chartSize, $chartSize)
$chartRadius = 20
$chartPath.AddArc($chartRect.X, $chartRect.Y, $chartRadius * 2, $chartRadius * 2, 180, 90)
$chartPath.AddArc($chartRect.Right - $chartRadius * 2, $chartRect.Y, $chartRadius * 2, $chartRadius * 2, 270, 90)
$chartPath.AddArc($chartRect.Right - $chartRadius * 2, $chartRect.Bottom - $chartRadius * 2, $chartRadius * 2, $chartRadius * 2, 0, 90)
$chartPath.AddArc($chartRect.X, $chartRect.Bottom - $chartRadius * 2, $chartRadius * 2, $chartRadius * 2, 90, 90)
$chartPath.CloseFigure()

$chartBgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 255, 161, 22))
$g.FillPath($chartBgBrush, $chartPath)
$chartPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 161, 22), 2)
$g.DrawPath($chartPen, $chartPath)

# Bars
$barBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 161, 22))
$barWidth = 40
$barGap = 25
$baseY = $chartY + $chartSize - 60
$heights = @(80, 140, 100, 160, 120)

for ($i = 0; $i -lt 5; $i++) {
    $barX = $chartX + 50 + ($i * ($barWidth + $barGap))
    $barHeight = $heights[$i]
    $g.FillRectangle($barBrush, $barX, $baseY - $barHeight, $barWidth, $barHeight)
}

$marqueeTile.Save("c:\Users\dubey\extension\marquee-promo-1400x560.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "✅ Saved: marquee-promo-1400x560.png" -ForegroundColor Green

$g.Dispose()
$marqueeTile.Dispose()
$logo.Dispose()

Write-Host "`n🎉 Perfect! Both promo tiles ready!" -ForegroundColor Green
Write-Host "   📁 c:\Users\dubey\extension\" -ForegroundColor Cyan
