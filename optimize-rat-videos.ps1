# optimize-rat-videos.ps1
# Optimizes rat enemy video files for web delivery

$inputDir = "resources\enemies\rat"
$outputDir = "resources\enemies\rat\optimized"

# Check if FFmpeg is installed
try {
    $null = & ffmpeg -version 2>&1
} catch {
    Write-Host "ERROR: FFmpeg is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install FFmpeg first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.gyan.dev/ffmpeg/builds/" -ForegroundColor Cyan
    Write-Host "2. Extract to C:\ffmpeg" -ForegroundColor Cyan
    Write-Host "3. Add C:\ffmpeg\bin to your PATH environment variable" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use Scoop: scoop install ffmpeg" -ForegroundColor Cyan
    exit 1
}

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$files = @(
    "approaching.mp4",
    "attack1.mp4",
    "attack2.mp4",
    "leaving.mp4",
    "menacing.mp4",
    "pacing.mp4"
)

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Rat Video Optimization for Web Delivery" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

$totalOriginal = 0
$totalOptimized = 0
$successCount = 0

foreach ($file in $files) {
    $inputPath = Join-Path $inputDir $file
    
    if (-not (Test-Path $inputPath)) {
        Write-Host "WARNING: Skipping $file (not found)" -ForegroundColor Yellow
        continue
    }
    
    $originalSize = (Get-Item $inputPath).Length
    $totalOriginal += $originalSize
    $originalSizeMB = [math]::Round($originalSize / 1MB, 2)
    
    $outputName = [System.IO.Path]::GetFileNameWithoutExtension($file) + ".webm"
    $outputPath = Join-Path $outputDir $outputName
    
    Write-Host "Processing: $file (${originalSizeMB}MB)" -ForegroundColor Yellow
    Write-Host "  -> Converting to WebM with VP9 codec..." -ForegroundColor Gray
    
    # Run FFmpeg with optimized settings and transparency
    # Convert checkerboard pattern to alpha transparency
    $ffmpegArgs = @(
        "-i", $inputPath,
        "-c:v", "libvpx-vp9",
        "-b:v", "400k",
        "-crf", "35",
        "-vf", "chromakey=0xFFFFFF:0.3:0.2,chromakey=0xCCCCCC:0.3:0.2,chromakey=0xC0C0C0:0.3:0.2,scale=-1:120",
        "-auto-alt-ref", "0",
        "-pix_fmt", "yuva420p",
        "-an",
        "-r", "24",
        $outputPath,
        "-y"
    )
    
    $process = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0 -and (Test-Path $outputPath)) {
        $optimizedSize = (Get-Item $outputPath).Length
        $totalOptimized += $optimizedSize
        $optimizedSizeMB = [math]::Round($optimizedSize / 1MB, 2)
        $reduction = [math]::Round((1 - ($optimizedSize / $originalSize)) * 100, 1)
        
        Write-Host "  SUCCESS: $outputName (${optimizedSizeMB}MB, ${reduction}% reduction)" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  FAILED to optimize: $file" -ForegroundColor Red
    }
    Write-Host ""
}

# Summary
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "              Optimization Summary" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files Processed:    $successCount of $($files.Count)" -ForegroundColor White
Write-Host "Original Total:     $([math]::Round($totalOriginal / 1MB, 2)) MB" -ForegroundColor Yellow
Write-Host "Optimized Total:    $([math]::Round($totalOptimized / 1MB, 2)) MB" -ForegroundColor Green

if ($totalOriginal -gt 0) {
    $overallReduction = [math]::Round((1 - ($totalOptimized / $totalOriginal)) * 100, 1)
    Write-Host "Total Reduction:    ${overallReduction}%" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Optimized files saved to: $outputDir" -ForegroundColor Cyan
Write-Host ""

if ($successCount -eq $files.Count) {
    Write-Host "SUCCESS: All videos optimized successfully!" -ForegroundColor Green
} else {
    Write-Host "WARNING: Some videos failed to optimize. Check the errors above." -ForegroundColor Yellow
}
