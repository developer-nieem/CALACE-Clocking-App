Add-Type -AssemblyName System.Drawing

function New-AppIcon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::FromArgb(255, 13, 42, 67))
  $fontSize = [Math]::Max(12, [int]($size * 0.34))
  $style = [System.Drawing.FontStyle]::Bold
  $font = New-Object System.Drawing.Font("Arial", $fontSize, $style, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 216, 181, 60))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $g.DrawString("CA", $font, $brush, $rect, $sf)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $font.Dispose()
  $brush.Dispose()
}

New-AppIcon 192 "public\icon-192.png"
New-AppIcon 512 "public\icon-512.png"
New-AppIcon 180 "public\apple-touch-icon.png"
Get-Item public\icon-192.png, public\icon-512.png, public\apple-touch-icon.png | Select-Object Name, Length
