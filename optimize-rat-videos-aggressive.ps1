# optimize-rat-videos-aggressive.ps1
# More aggressive transparency conversion for checkerboard backgrounds

$inputDir = "resources\enemies\rat"
$outputDir = "resources\enemies\rat\optimized"

# Check if FFmpeg is installed
try {
    $null = & ffmpeg -version 2>&1
} catch {
    Write-Host "ERROR: FFmpeg is not installed or not in PATH" -ForegroundColor Red
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
Write-Host "  Aggressive Transparency Conversion" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

$successCount = 0

foreach ($file in $files) {
    $inputPath = Join-Path $inputDir $file
    
    if (-not (Test-Path $inputPath)) {
        Write-Host "WARNING: Skipping $file (not found)" -ForegroundColor Yellow
        continue
    }
    
    $outputName = [System.IO.Path]::GetFileNameWithoutExtension($file) + ".webm"
    $outputPath = Join-Path $outputDir $outputName
    
    Write-Host "Processing: $file" -ForegroundColor Yellow
    Write-Host "  -> Removing checkerboard and converting to transparent WebM..." -ForegroundColor Gray
    
    # Target the dark gray background (0x3F3F3F = RGB 63,63,63)
    # Use LOWER tolerance to preserve rat details (which may be similar dark colors)
    # Similarity 0.2 = only very close colors, Blend 0.1 = sharp edges
    $ffmpegArgs = @(
        "-i", $inputPath,
        "-c:v", "libvpx-vp9",
        "-b:v", "400k",
        "-crf", "35",
        "-vf", "colorkey=0x3F3F3F:0.2:0.1,scale=-1:120",
        "-auto-alt-ref", "0",
        "-pix_fmt", "yuva420p",
        "-an",
        "-r", "24",
        $outputPath,
        "-y"
    )
    
    $process = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0 -and (Test-Path $outputPath)) {
        $sizeMB = [math]::Round((Get-Item $outputPath).Length / 1MB, 2)
        Write-Host "  SUCCESS: $outputName (${sizeMB}MB)" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  FAILED to optimize: $file" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Files Processed: $successCount of $($files.Count)" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

if ($successCount -eq $files.Count) {
    Write-Host "SUCCESS: All videos converted with transparency!" -ForegroundColor Green
    Write-Host "Open test-transparency.html to verify the results" -ForegroundColor Cyan
}
