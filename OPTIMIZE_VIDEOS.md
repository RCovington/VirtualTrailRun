# Video Optimization Guide for Rat Enemy Assets

## Current Status
- **Total Size**: 26.5 MB (too large for web)
- **Target Size**: 3-6 MB total (~500KB-1MB per video)
- **Display Size**: 60px on canvas (very small)

## Step 1: Install FFmpeg

### Option A: Download Directly
1. Go to: https://www.gyan.dev/ffmpeg/builds/
2. Download: `ffmpeg-release-essentials.zip`
3. Extract to `C:\ffmpeg`
4. Add `C:\ffmpeg\bin` to your PATH environment variable

### Option B: Via Scoop (if installed)
```powershell
scoop install ffmpeg
```

## Step 2: Optimize Videos

Once FFmpeg is installed, run these commands in PowerShell from the project directory:

```powershell
# Create output directory
New-Item -ItemType Directory -Force -Path "resources\enemies\rat\optimized"

# Optimize each video - targeting 500KB-1MB per file
# Using WebM format for better compression and web compatibility

# Approaching animation
ffmpeg -i "resources\enemies\rat\approaching.mp4" -c:v libvpx-vp9 -b:v 400k -crf 35 -vf "scale=-1:120" -an -r 24 "resources\enemies\rat\optimized\approaching.webm"

# Attack 1 animation
ffmpeg -i "resources\enemies\rat\attack1.mp4" -c:v libvpx-vp9 -b:v 400k -crf 35 -vf "scale=-1:120" -an -r 24 "resources\enemies\rat\optimized\attack1.webm"

# Attack 2 animation
ffmpeg -i "resources\enemies\rat\attack2.mp4" -c:v libvpx-vp9 -b:v 400k -crf 35 -vf "scale=-1:120" -an -r 24 "resources\enemies\rat\optimized\attack2.webm"

# Leaving animation
ffmpeg -i "resources\enemies\rat\leaving.mp4" -c:v libvpx-vp9 -b:v 400k -crf 35 -vf "scale=-1:120" -an -r 24 "resources\enemies\rat\optimized\leaving.webm"

# Menacing animation
ffmpeg -i "resources\enemies\rat\menacing.mp4" -c:v libvpx-vp9 -b:v 400k -crf 35 -vf "scale=-1:120" -an -r 24 "resources\enemies\rat\optimized\menacing.webm"

# Pacing animation
ffmpeg -i "resources\enemies\rat\pacing.mp4" -c:v libvpx-vp9 -b:v 400k -crf 35 -vf "scale=-1:120" -an -r 24 "resources\enemies\rat\optimized\pacing.webm"
```

## Step 3: All-in-One Optimization Script

Save this as `optimize-rat-videos.ps1` and run it:

```powershell
# optimize-rat-videos.ps1
$inputDir = "resources\enemies\rat"
$outputDir = "resources\enemies\rat\optimized"

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

Write-Host "Optimizing rat videos for web..." -ForegroundColor Cyan

foreach ($file in $files) {
    $inputPath = Join-Path $inputDir $file
    $outputName = [System.IO.Path]::GetFileNameWithoutExtension($file) + ".webm"
    $outputPath = Join-Path $outputDir $outputName
    
    Write-Host "Processing: $file" -ForegroundColor Yellow
    
    & ffmpeg -i $inputPath -c:v libvpx-vp9 -b:v 400k -crf 35 -vf "scale=-1:120" -an -r 24 $outputPath -y
    
    if (Test-Path $outputPath) {
        $sizeMB = [math]::Round((Get-Item $outputPath).Length / 1MB, 2)
        Write-Host "  ✓ Created: $outputName ($sizeMB MB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed: $file" -ForegroundColor Red
    }
}

Write-Host "`nOptimization complete!" -ForegroundColor Cyan
Write-Host "Check the 'optimized' folder for results." -ForegroundColor Cyan
```

## Optimization Parameters Explained

- **`-c:v libvpx-vp9`**: VP9 codec (better compression than H.264)
- **`-b:v 400k`**: Target bitrate of 400 kbps
- **`-crf 35`**: Quality setting (higher = smaller, 35 is good for small videos)
- **`-vf "scale=-1:120"`**: Scale to 120px height (maintain aspect ratio)
- **`-an`**: Remove audio (not needed for enemy animations)
- **`-r 24`**: 24 fps (lower than typical 30/60, sufficient for small animations)

## Expected Results

- **approaching.webm**: ~600KB (down from 4.96 MB) = **88% reduction**
- **attack1.webm**: ~600KB (down from 4.64 MB) = **87% reduction**
- **attack2.webm**: ~500KB (down from 3.90 MB) = **87% reduction**
- **leaving.webm**: ~400KB (down from 2.92 MB) = **86% reduction**
- **menacing.webm**: ~600KB (down from 4.87 MB) = **88% reduction**
- **pacing.webm**: ~650KB (down from 5.27 MB) = **88% reduction**

**Total: ~3.5 MB** (down from 26.5 MB) = **87% reduction**

## Alternative: Even More Aggressive Compression

If you need smaller files, use these settings:

```powershell
# Ultra-compressed version (targeting 200-300KB per file)
ffmpeg -i "input.mp4" -c:v libvpx-vp9 -b:v 200k -crf 40 -vf "scale=-1:80" -an -r 20 "output.webm"
```

Changes:
- Bitrate: 400k → 200k
- CRF: 35 → 40 (lower quality)
- Scale: 120px → 80px height
- Framerate: 24 → 20 fps

## Step 4: Integration

Once optimized, I can help you integrate these WebM videos into the game to replace the emoji. The code will:

1. Preload videos on game start
2. Use `<video>` elements rendered to canvas
3. Play appropriate animations for each enemy state
4. Fallback to emoji if video fails to load

Ready to proceed with integration after you optimize the videos!
