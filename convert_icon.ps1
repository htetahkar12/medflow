Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("public/logo.png")
$bmp = New-Object System.Drawing.Bitmap($img, 256, 256)
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$stream = [System.IO.File]::Create("public/icon.ico")
$icon.Save($stream)
$stream.Close()
$img.Dispose()
$bmp.Dispose()
Write-Host "Created public/icon.ico successfully."
