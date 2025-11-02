# Script PowerShell pour copier le logo - GDRI
# Fichier : install/copy-logo.ps1

Write-Host "=== Copie du logo GDR-Innovation ===" -ForegroundColor Cyan
Write-Host ""

$sourceLogo = "C:\Users\guyvarchc\Documents\programation\front_end\public\logo-gdri.png"
$destinationLogo = "$PSScriptRoot\..\assets\images\logo-gdri.png"

# Vérifier si le fichier source existe
if (Test-Path $sourceLogo) {
    Write-Host "✓ Logo trouvé : $sourceLogo" -ForegroundColor Green
    
    # Créer le dossier de destination si nécessaire
    $destinationDir = Split-Path -Parent $destinationLogo
    if (-not (Test-Path $destinationDir)) {
        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        Write-Host "✓ Dossier créé : $destinationDir" -ForegroundColor Green
    }
    
    # Copier le fichier
    Copy-Item -Path $sourceLogo -Destination $destinationLogo -Force
    Write-Host "✓ Logo copié avec succès vers : $destinationLogo" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le logo est maintenant disponible pour le site !" -ForegroundColor Green
} else {
    Write-Host "✗ Logo non trouvé à l'emplacement : $sourceLogo" -ForegroundColor Red
    Write-Host ""
    Write-Host "Veuillez copier manuellement votre logo vers :" -ForegroundColor Yellow
    Write-Host "$destinationLogo" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")




