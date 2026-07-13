# Installe SDXL Turbo dans ComfyUI Desktop (adapté 8 Go VRAM).
# Usage: powershell -ExecutionPolicy Bypass -File Install-SDXL.ps1

$ErrorActionPreference = 'Stop'

$defaultModelsRoot = Join-Path $env:LOCALAPPDATA 'Comfy-Desktop\ComfyUI-Shared\models'
$modelsRoot = if ($env:COMFYUI_MODELS_DIR) { $env:COMFYUI_MODELS_DIR } else { $defaultModelsRoot }
$checkpointsDir = Join-Path $modelsRoot 'checkpoints'
$checkpointName = 'sd_xl_turbo_1.0_fp16.safetensors'
$checkpointPath = Join-Path $checkpointsDir $checkpointName
$downloadUrl = 'https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/sd_xl_turbo_1.0_fp16.safetensors'
$minSizeBytes = 6.5GB

Write-Host "=== Installation SDXL Turbo pour GDRI Media Studio ===" -ForegroundColor Cyan
Write-Host "Dossier modeles: $modelsRoot"

New-Item -ItemType Directory -Force -Path $checkpointsDir | Out-Null

if (Test-Path $checkpointPath) {
    $size = (Get-Item $checkpointPath).Length
    if ($size -ge $minSizeBytes) {
        Write-Host "Deja installe: $checkpointName ($([math]::Round($size / 1GB, 2)) Go)" -ForegroundColor Green
        exit 0
    }
    Write-Host "Fichier incomplet detecte, re-telechargement..." -ForegroundColor Yellow
    Remove-Item $checkpointPath -Force
}

Write-Host "Telechargement de $checkpointName (~6,9 Go)..." -ForegroundColor Yellow
Write-Host "URL: $downloadUrl"

$tmpPath = "$checkpointPath.download"
if (Test-Path $checkpointPath) { Remove-Item $checkpointPath -Force }

$resumeFlag = @()
if (Test-Path $tmpPath) {
    $partial = (Get-Item $tmpPath).Length
    if ($partial -gt 0 -and $partial -lt $minSizeBytes) {
        Write-Host "Reprise du telechargement ($([math]::Round($partial / 1GB, 2)) Go deja presents)..." -ForegroundColor Yellow
        $resumeFlag = @('-C', '-')
    } else {
        Remove-Item $tmpPath -Force
    }
}

curl.exe -L --progress-bar @resumeFlag -o $tmpPath $downloadUrl
if ($LASTEXITCODE -ne 0) {
    if (Test-Path $tmpPath) { Remove-Item $tmpPath -Force }
    throw "Echec du telechargement (curl exit $LASTEXITCODE)"
}

$size = (Get-Item $tmpPath).Length
if ($size -lt $minSizeBytes) {
    Remove-Item $tmpPath -Force
    throw "Fichier telecharge trop petit ($([math]::Round($size / 1GB, 2)) Go). Verifiez la connexion."
}

Move-Item -Path $tmpPath -Destination $checkpointPath -Force
Write-Host "SDXL Turbo installe: $checkpointPath ($([math]::Round($size / 1GB, 2)) Go)" -ForegroundColor Green
Write-Host "Relancez ComfyUI Desktop si necessaire, puis testez depuis Studio Media." -ForegroundColor Cyan
