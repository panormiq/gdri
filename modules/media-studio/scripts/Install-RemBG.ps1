# Installe rembg pour le détourage IA (onglet Extraction Studio Média)
# Usage: .\Install-RemBG.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Installation rembg (détourage IA) ===" -ForegroundColor Cyan

$python = $null
foreach ($cmd in @("python", "py", "python3")) {
    try {
        $v = & $cmd --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $python = $cmd
            Write-Host "Python: $v ($cmd)"
            break
        }
    } catch { }
}

if (-not $python) {
    Write-Host "Python introuvable. Installez Python 3.10+ depuis python.org" -ForegroundColor Red
    exit 1
}

Write-Host "Installation des paquets (premier lancement telecharge le modele ~170 Mo)..." -ForegroundColor Yellow
& $python -m pip install --upgrade pip
& $python -m pip install rembg onnxruntime pillow

Write-Host "Verification + telechargement modele u2net (~170 Mo)..." -ForegroundColor Yellow
& $python -c "from rembg import new_session; new_session('u2net'); print('rembg OK (u2net pret)')"

Write-Host ""
Write-Host "Termine. Redemarrez le backend Node.js puis testez l'onglet Extraction." -ForegroundColor Green
Write-Host "Option GPU (plus rapide): pip install onnxruntime-gpu" -ForegroundColor DarkGray
