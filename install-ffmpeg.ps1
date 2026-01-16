# install-ffmpeg.ps1
# Downloads and installs FFmpeg for Windows

$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
$downloadPath = "$env:TEMP\ffmpeg.zip"
$extractPath = "C:\ffmpeg"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  FFmpeg Installation for Windows" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if already installed
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host "FFmpeg is already installed and in PATH!" -ForegroundColor Green
    & ffmpeg -version | Select-Object -First 1
    exit 0
}

Write-Host "Step 1: Downloading FFmpeg..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $downloadPath -UseBasicParsing
    Write-Host "  Download complete!" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Failed to download FFmpeg" -ForegroundColor Red
    Write-Host "  Please download manually from: https://www.gyan.dev/ffmpeg/builds/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Extracting FFmpeg to $extractPath..." -ForegroundColor Yellow
try {
    if (Test-Path $extractPath) {
        Remove-Item $extractPath -Recurse -Force
    }
    Expand-Archive -Path $downloadPath -DestinationPath "$env:TEMP\ffmpeg-extract" -Force
    
    # Find the bin folder (it's nested in a versioned folder)
    $binFolder = Get-ChildItem -Path "$env:TEMP\ffmpeg-extract" -Recurse -Directory | Where-Object { $_.Name -eq "bin" } | Select-Object -First 1
    
    if ($binFolder) {
        # Move the parent folder to C:\ffmpeg
        Move-Item -Path $binFolder.Parent.FullName -Destination $extractPath -Force
        Write-Host "  Extraction complete!" -ForegroundColor Green
    } else {
        throw "Could not find bin folder in archive"
    }
    
    # Cleanup
    Remove-Item "$env:TEMP\ffmpeg-extract" -Recurse -Force
    Remove-Item $downloadPath -Force
} catch {
    Write-Host "  ERROR: Failed to extract FFmpeg" -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Adding FFmpeg to PATH..." -ForegroundColor Yellow

# Get current PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$ffmpegBinPath = "$extractPath\bin"

# Check if already in PATH
if ($currentPath -like "*$ffmpegBinPath*") {
    Write-Host "  FFmpeg is already in PATH!" -ForegroundColor Green
} else {
    # Add to user PATH
    $newPath = "$currentPath;$ffmpegBinPath"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "  Added to PATH!" -ForegroundColor Green
    Write-Host "  NOTE: You may need to restart your terminal for PATH changes to take effect" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "FFmpeg installed to: $extractPath" -ForegroundColor White
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "1. Close and reopen your PowerShell terminal" -ForegroundColor White
Write-Host "2. Run: .\optimize-rat-videos.ps1" -ForegroundColor White
Write-Host ""
