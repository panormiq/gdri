#Requires -Version 5.1

<#
.SYNOPSIS
    Script de démarrage pour tous les backends GDRI
    À lancer depuis la racine du projet (gdri)

.DESCRIPTION
    Ce script lance tous les backends depuis la racine du projet gdri
#>

# Aller dans le répertoire du script (racine de gdri)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Lancer le script principal
& "$scriptDir\install\Start-All-Backends-Auto.ps1" -ShowWindows


