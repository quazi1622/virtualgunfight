param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$Root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$Encoding = [System.Text.Encoding]::UTF8

function Get-ContentType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".css" { "text/css; charset=utf-8"; break }
    ".js" { "text/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".png" { "image/png"; break }
    ".jpg" { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".webp" { "image/webp"; break }
    ".svg" { "image/svg+xml"; break }
    ".glb" { "model/gltf-binary"; break }
    ".gltf" { "model/gltf+json"; break }
    ".wav" { "audio/wav"; break }
    ".mp3" { "audio/mpeg"; break }
    ".ogg" { "audio/ogg"; break }
    default { "application/octet-stream" }
  }
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body
  )

  $headers = @(
    "HTTP/1.1 $StatusCode $StatusText",
    "Content-Type: $ContentType",
    "Content-Length: $($Body.Length)",
    "Cache-Control: no-store",
    "Connection: close",
    "",
    ""
  ) -join "`r`n"

  $headerBytes = $Encoding.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  $Stream.Write($Body, 0, $Body.Length)
}

function Resolve-RequestPath {
  param([string]$RawPath)

  $pathOnly = $RawPath.Split("?")[0]
  $decoded = [System.Uri]::UnescapeDataString($pathOnly)

  if ($decoded -eq "/") {
    $decoded = "/index.html"
  }

  $relative = $decoded.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))

  if (-not $fullPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  return $fullPath
}

$addresses = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Select-Object -ExpandProperty IPAddress

Write-Host ""
Write-Host "Starting static development server..."
Write-Host "Local:   http://localhost:$Port"

foreach ($address in $addresses) {
  Write-Host "Network: http://$address`:$Port"
}

Write-Host ""
Write-Host "Devices on the same Wi-Fi/LAN can use the Network URL."
Write-Host "For WebXR on a headset, deploy through HTTPS when browser security requires it."
Write-Host "Press Ctrl+C to stop."
Write-Host ""

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, $Encoding, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $rawPath = $parts[1]

      while (-not [string]::IsNullOrWhiteSpace($reader.ReadLine())) {
      }

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = $Encoding.GetBytes("Method not allowed")
        Send-Response $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" $body
        continue
      }

      $filePath = Resolve-RequestPath $rawPath

      if ($null -eq $filePath -or -not [System.IO.File]::Exists($filePath)) {
        $body = $Encoding.GetBytes("Not found")
        Send-Response $stream 404 "Not Found" "text/plain; charset=utf-8" $body
        continue
      }

      $bodyBytes = if ($method -eq "HEAD") { [byte[]]::new(0) } else { [System.IO.File]::ReadAllBytes($filePath) }
      Send-Response $stream 200 "OK" (Get-ContentType $filePath) $bodyBytes
      Write-Host "$method $rawPath -> 200"
    }
    catch {
      Write-Host "Request failed: $($_.Exception.Message)"
    }
    finally {
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
