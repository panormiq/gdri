@echo off
REM Script de démarrage pour BackendIA sur Windows
setlocal EnableDelayedExpansion

REM Configuration par défaut
set HOST=0.0.0.0
set PORT=8000
set RELOAD=false
set WORKERS=1
set SKIP_CHECKS=false
set DEV_MODE=false

REM Parser les arguments
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="-h" goto show_help
if "%~1"=="--help" goto show_help
if "%~1"=="-H" (
    set HOST=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--host" (
    set HOST=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="-p" (
    set PORT=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--port" (
    set PORT=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="-r" (
    set RELOAD=true
    shift
    goto parse_args
)
if "%~1"=="--reload" (
    set RELOAD=true
    shift
    goto parse_args
)
if "%~1"=="-d" (
    set DEV_MODE=true
    set RELOAD=true
    set WORKERS=1
    shift
    goto parse_args
)
if "%~1"=="--dev" (
    set DEV_MODE=true
    set RELOAD=true
    set WORKERS=1
    shift
    goto parse_args
)
if "%~1"=="--skip-checks" (
    set SKIP_CHECKS=true
    shift
    goto parse_args
)
echo ❌ Option inconnue: %~1
goto show_help

:end_parse

REM Affichage de l'aide
:show_help
echo.
echo 🌟 BackendIA - Script de démarrage Windows
echo.
echo Usage: %~nx0 [OPTIONS]
echo.
echo Options:
echo   -h, --help          Afficher cette aide
echo   -H, --host HOST     Adresse d'écoute (défaut: 0.0.0.0)
echo   -p, --port PORT     Port d'écoute (défaut: 8000)
echo   -r, --reload        Activer le rechargement automatique
echo   -d, --dev           Mode développement (reload activé)
echo   --skip-checks       Ignorer les vérifications
echo.
echo Exemples:
echo   %~nx0                # Démarrage standard
echo   %~nx0 --dev         # Mode développement
echo   %~nx0 -p 9000       # Port personnalisé
echo   %~nx0 --skip-checks # Sans vérifications
echo.
if "%~1"=="-h" exit /b 0
if "%~1"=="--help" exit /b 0
exit /b 1

REM Fonction de vérification Python
:check_python
echo 🔍 Vérification de Python...
where py >nul 2>&1
if %errorlevel%==0 (
    set PYTHON_CMD=py
    echo ✅ Python trouvé: py
    goto :eof
)

where python >nul 2>&1
if %errorlevel%==0 (
    set PYTHON_CMD=python
    echo ✅ Python trouvé: python
    goto :eof
)

where python3 >nul 2>&1
if %errorlevel%==0 (
    set PYTHON_CMD=python3
    echo ✅ Python trouvé: python3
    goto :eof
)

echo ❌ Python non trouvé
exit /b 1

REM Fonction de vérification des dépendances
:check_dependencies
echo 🔍 Vérification des dépendances...

if not exist "requirements.txt" (
    echo ❌ Fichier requirements.txt non trouvé
    exit /b 1
)

%PYTHON_CMD% -c "import fastapi, uvicorn, mongoengine" >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Installation des dépendances...
    %PYTHON_CMD% -m pip install -r requirements.txt
    if !errorlevel! neq 0 (
        echo ❌ Erreur lors de l'installation des dépendances
        exit /b 1
    )
)

echo ✅ Dépendances vérifiées
goto :eof

REM Fonction de vérification de la structure
:check_structure
echo 🔍 Vérification de la structure du projet...

if not exist "main.py" (
    echo ❌ Fichier main.py manquant
    exit /b 1
)

if not exist "app\core\config.py" (
    echo ❌ Fichier app\core\config.py manquant
    exit /b 1
)

if not exist "app\routers" (
    echo ❌ Dossier app\routers manquant
    exit /b 1
)

if not exist "app\services" (
    echo ❌ Dossier app\services manquant
    exit /b 1
)

echo ✅ Structure du projet validée
goto :eof

REM Fonction de vérification MongoDB
:check_mongodb
echo 🔍 Vérification de MongoDB...

%PYTHON_CMD% -c "from app.core.config import settings; from mongoengine import connect; connect(host=settings.database_url, serverSelectionTimeoutMS=3000); print('OK')" >nul 2>&1
if %errorlevel%==0 (
    echo ✅ MongoDB accessible
) else (
    echo ⚠️  MongoDB non accessible - vérifiez la configuration
)
goto :eof

REM Fonction de vérification Ollama
:check_ollama
echo 🔍 Vérification d'Ollama...

curl -s "http://localhost:11434/api/tags" >nul 2>&1
if %errorlevel%==0 (
    echo ✅ Ollama accessible
) else (
    echo ⚠️  Ollama non accessible - vérifiez qu'il est démarré
)
goto :eof

REM Fonction principale
:main
echo.
echo 🌟 BACKENDIA - DÉMARRAGE DU SERVEUR
echo ==================================
echo.

REM Vérifications
if "%SKIP_CHECKS%"=="false" (
    echo ℹ️  Exécution des vérifications préliminaires...
    
    call :check_python
    if %errorlevel% neq 0 exit /b 1
    
    call :check_structure
    if %errorlevel% neq 0 exit /b 1
    
    call :check_dependencies
    if %errorlevel% neq 0 exit /b 1
    
    call :check_mongodb
    call :check_ollama
    
    echo.
    echo ✅ Vérifications terminées
) else (
    call :check_python
    if %errorlevel% neq 0 exit /b 1
    echo ℹ️  Vérifications ignorées (--skip-checks)
)

echo.
echo ==================================
echo ℹ️  Configuration du serveur:
echo   📡 Host: %HOST%
echo   🔌 Port: %PORT%
echo   🔄 Reload: %RELOAD%
echo   👥 Workers: %WORKERS%
if "%DEV_MODE%"=="true" echo   🛠️  Mode: Développement
echo ==================================
echo.

REM Construire la commande uvicorn
set CMD=%PYTHON_CMD% -m uvicorn main:app --host %HOST% --port %PORT%

if "%RELOAD%"=="true" (
    set CMD=!CMD! --reload
)

if "%WORKERS%" neq "1" if "%RELOAD%"=="false" (
    set CMD=!CMD! --workers %WORKERS%
)

echo ℹ️  Démarrage du serveur...
echo ℹ️  Commande: !CMD!
echo.
echo ✅ 🚀 Serveur BackendIA en cours de démarrage...
echo.
echo ℹ️  📖 Documentation: http://%HOST%:%PORT%/docs
echo ℹ️  🏥 Health check: http://%HOST%:%PORT%/health
echo.
echo ℹ️  Appuyez sur Ctrl+C pour arrêter
echo.

REM Exécuter la commande
!CMD!

goto :eof

REM Point d'entrée
call :main %*


