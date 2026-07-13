# Installe le checkpoint LTX-Video pour GDRI Media Studio (8 Go VRAM).
# Usage: powershell -ExecutionPolicy Bypass -File Install-LTX-I2V.ps1
#        powershell -ExecutionPolicy Bypass -File Install-LTX-I2V.ps1 -Download

param(
    [switch]$Download
)

$ErrorActionPreference = 'Stop'

$checkpointName = 'ltx-video-2b-v0.9.1.safetensors'
$downloadUrl = 'https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltx-video-2b-v0.9.1.safetensors'
$minSizeBytes = 3.5GB

Write-Host '=== Installation LTX-Video i2v - GDRI Media Studio ===' -ForegroundColor Cyan

$comfyShared = Join-Path $env:LOCALAPPDATA 'Comfy-Desktop\ComfyUI-Shared'
$modelsRoot = if ($env:COMFYUI_MODELS_DIR) { $env:COMFYUI_MODELS_DIR } else { Join-Path $comfyShared 'models' }
$checkpointsDir = Join-Path $modelsRoot 'checkpoints'
$target = Join-Path $checkpointsDir $checkpointName

New-Item -ItemType Directory -Force -Path $checkpointsDir | Out-Null
Write-Host "Dossier checkpoints: $checkpointsDir" -ForegroundColor Gray

if (Test-Path $target) {
    $size = (Get-Item $target).Length
    if ($size -ge $minSizeBytes) {
        $sizeGb = [math]::Round($size / 1GB, 2)
        Write-Host "Deja installe: $checkpointName (${sizeGb} Go)" -ForegroundColor Green
        Write-Host 'Redemarrez ComfyUI Desktop si le modele n apparait pas encore.' -ForegroundColor Cyan
        exit 0
    }
    Write-Host 'Fichier incomplet, re-telechargement...' -ForegroundColor Yellow
    Remove-Item $target -Force
}

$doDownload = $Download.IsPresent
if (-not $doDownload) {
    Write-Host ''
    Write-Host "Checkpoint absent: $checkpointName" -ForegroundColor Yellow
    Write-Host 'Relancez avec -Download pour telecharger (~4 Go) :' -ForegroundColor White
    Write-Host "  powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Download" -ForegroundColor Gray
    exit 1
}

Write-Host ''
Write-Host "Telechargement de $checkpointName (~4 Go)..." -ForegroundColor Yellow
Write-Host "URL: $downloadUrl"

$tmpPath = "$target.download"
if (Test-Path $tmpPath) { Remove-Item $tmpPath -Force }

$resumeFlag = @()
if (Test-Path "$tmpPath.part") {
    $resumeFlag = @('-C', '-')
    $tmpPath = "$tmpPath.part"
}

curl.exe -L --progress-bar @resumeFlag -o $tmpPath $downloadUrl
if ($LASTEXITCODE -ne 0) {
    if (Test-Path $tmpPath) { Remove-Item $tmpPath -Force }
    throw "Echec du telechargement (curl exit $LASTEXITCODE)"
}

$size = (Get-Item $tmpPath).Length
if ($size -lt $minSizeBytes) {
    Remove-Item $tmpPath -Force
    $sizeGb = [math]::Round($size / 1GB, 2)
    throw "Fichier telecharge trop petit (${sizeGb} Go)."
}

Move-Item -Path $tmpPath -Destination $target -Force
$sizeGb = [math]::Round($size / 1GB, 2)
Write-Host ''
Write-Host "Installe: $target (${sizeGb} Go)" -ForegroundColor Green
Write-Host ''
Write-Host 'IMPORTANT :' -ForegroundColor Cyan
Write-Host '  1. Redemarrez ComfyUI Desktop (obligatoire pour voir le modele)' -ForegroundColor White
Write-Host '  2. Redemarrez le backend Node.js' -ForegroundColor White
Write-Host '  3. Relancez Generer clip IA (LTX) dans Studio Media' -ForegroundColor White
