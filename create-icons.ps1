Add-Type -AssemblyName System.Drawing

# Create 16x16 icon
$bmp16 = New-Object System.Drawing.Bitmap(16, 16)
$g16 = [System.Drawing.Graphics]::FromImage($bmp16)
$g16.Clear([System.Drawing.Color]::Transparent)
$g16.Dispose()
$bmp16.Save("$PSScriptRoot\dist\icon16.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp16.Dispose()

# Create 48x48 icon
$bmp48 = New-Object System.Drawing.Bitmap(48, 48)
$g48 = [System.Drawing.Graphics]::FromImage($bmp48)
$g48.Clear([System.Drawing.Color]::Transparent)
$g48.Dispose()
$bmp48.Save("$PSScriptRoot\dist\icon48.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp48.Dispose()

# Create 128x128 icon
$bmp128 = New-Object System.Drawing.Bitmap(128, 128)
$g128 = [System.Drawing.Graphics]::FromImage($bmp128)
$g128.Clear([System.Drawing.Color]::Transparent)
$g128.Dispose()
$bmp128.Save("$PSScriptRoot\dist\icon128.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp128.Dispose()

Write-Host "Icons created successfully!"
