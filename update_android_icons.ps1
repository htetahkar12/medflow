Add-Type -AssemblyName System.Drawing

$sourcePath = "public/logo.png"
if (-not (Test-Path $sourcePath)) {
    Write-Host "Source logo not found!"
    exit 1
}

$sourceImg = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))

$sizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($entry in $sizes.GetEnumerator()) {
    $folder = "android/app/src/main/res/" + $entry.Key
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }
    
    $dim = $entry.Value
    $destBmp = New-Object System.Drawing.Bitmap($dim, $dim)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($sourceImg, 0, 0, $dim, $dim)
    $g.Dispose()

    $icPath = Join-Path $folder "ic_launcher.png"
    $icRoundPath = Join-Path $folder "ic_launcher_round.png"
    $icForePath = Join-Path $folder "ic_launcher_foreground.png"

    $destBmp.Save($icPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Save($icRoundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Save($icForePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
}

$sourceImg.Dispose()
Write-Host "Android launcher icons successfully updated across all density folders."
