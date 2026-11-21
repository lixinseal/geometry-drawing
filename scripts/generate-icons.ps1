Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null
$iconDir = (Resolve-Path -LiteralPath $iconDir).Path

function New-GeometryIcon {
  param(
    [int]$Size,
    [string]$FileName,
    [double]$Inset
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $margin = [int]($Size * $Inset)
  $radius = [int]($Size * 0.18)
  $rect = New-Object System.Drawing.Rectangle($margin, $margin, ($Size - 2 * $margin), ($Size - 2 * $margin))
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = 2 * $radius
  $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  $background = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 24, 35, 44))
  $graphics.FillPath($background, $path)

  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [float]($Size * 0.025))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  function P([double]$x, [double]$y) {
    New-Object System.Drawing.PointF([float]($x * $Size), [float]($y * $Size))
  }

  $a = P 0.28 0.34
  $b = P 0.50 0.22
  $c = P 0.72 0.34
  $d = P 0.50 0.46
  $e = P 0.28 0.64
  $f = P 0.50 0.76
  $g = P 0.72 0.64

  $graphics.DrawPolygon($pen, [System.Drawing.PointF[]]@($a, $b, $c, $d))
  $graphics.DrawLine($pen, $a, $e)
  $graphics.DrawLine($pen, $b, (P 0.50 0.34))
  $graphics.DrawLine($pen, $c, $g)
  $graphics.DrawLine($pen, $d, $f)
  $graphics.DrawLine($pen, $e, $f)
  $graphics.DrawLine($pen, $f, $g)

  $target = Join-Path $iconDir $FileName
  $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)

  $graphics.Dispose()
  $background.Dispose()
  $pen.Dispose()
  $path.Dispose()
  $bitmap.Dispose()
}

New-GeometryIcon -Size 180 -FileName 'apple-touch-icon-180.png' -Inset 0.04
New-GeometryIcon -Size 192 -FileName 'icon-192.png' -Inset 0.04
New-GeometryIcon -Size 512 -FileName 'icon-512.png' -Inset 0.04
New-GeometryIcon -Size 512 -FileName 'maskable-512.png' -Inset 0.13

Write-Output "Generated PWA icons in $iconDir"
