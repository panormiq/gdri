#!/bin/bash
# Script de démarrage simple pour BackendIA

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration par défaut
HOST="0.0.0.0"
PORT="8000"
RELOAD="false"
WORKERS="1"
SKIP_CHECKS="false"

# Fonction d'aide
show_help() {
    echo "🌟 BackendIA - Script de démarrage"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Afficher cette aide"
    echo "  -H, --host HOST     Adresse d'écoute (défaut: 0.0.0.0)"
    echo "  -p, --port PORT     Port d'écoute (défaut: 8000)"
    echo "  -r, --reload        Activer le rechargement automatique"
    echo "  -w, --workers NUM   Nombre de workers (défaut: 1)"
    echo "  -d, --dev           Mode développement (reload activé)"
    echo "  --skip-checks       Ignorer les vérifications"
    echo ""
    echo "Exemples:"
    echo "  $0                  # Démarrage standard"
    echo "  $0 --dev           # Mode développement"
    echo "  $0 -p 9000         # Port personnalisé"
    echo "  $0 --skip-checks   # Sans vérifications"
}

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -H|--host)
            HOST="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -r|--reload)
            RELOAD="true"
            shift
            ;;
        -w|--workers)
            WORKERS="$2"
            shift 2
            ;;
        -d|--dev)
            RELOAD="true"
            WORKERS="1"
            shift
            ;;
        --skip-checks)
            SKIP_CHECKS="true"
            shift
            ;;
        *)
            echo -e "${RED}❌ Option inconnue: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Fonction de log
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier Python
check_python() {
    log_info "Vérification de Python..."
    
    if ! command -v python3 &> /dev/null && ! command -v py &> /dev/null; then
        log_error "Python non trouvé"
        return 1
    fi
    
    # Utiliser py sur Windows, python3 sur Linux/Mac
    if command -v py &> /dev/null; then
        PYTHON_CMD="py"
    else
        PYTHON_CMD="python3"
    fi
    
    log_success "Python trouvé: $PYTHON_CMD"
    return 0
}

# Vérifier les dépendances
check_dependencies() {
    log_info "Vérification des dépendances..."
    
    if [ ! -f "requirements.txt" ]; then
        log_error "Fichier requirements.txt non trouvé"
        return 1
    fi
    
    # Vérifier quelques dépendances clés
    if ! $PYTHON_CMD -c "import fastapi, uvicorn, mongoengine" &> /dev/null; then
        log_warning "Certaines dépendances semblent manquantes"
        log_info "Installation des dépendances..."
        $PYTHON_CMD -m pip install -r requirements.txt
    fi
    
    log_success "Dépendances vérifiées"
    return 0
}

# Vérifier la structure du projet
check_project_structure() {
    log_info "Vérification de la structure du projet..."
    
    required_files=("main.py" "app/core/config.py" "app/routers" "app/services")
    
    for file in "${required_files[@]}"; do
        if [ ! -e "$file" ]; then
            log_error "Fichier/dossier manquant: $file"
            return 1
        fi
    done
    
    log_success "Structure du projet validée"
    return 0
}

# Vérifier MongoDB
check_mongodb() {
    log_info "Vérification de MongoDB..."
    
    # Test de connexion simple
    if $PYTHON_CMD -c "
from app.core.config import settings
from mongoengine import connect
try:
    connect(host=settings.database_url, serverSelectionTimeoutMS=3000)
    print('OK')
except:
    print('FAIL')
" 2>/dev/null | grep -q "OK"; then
        log_success "MongoDB accessible"
        return 0
    else
        log_warning "MongoDB non accessible - vérifiez la configuration"
        return 1
    fi
}

# Vérifier Ollama
check_ollama() {
    log_info "Vérification d'Ollama..."
    
    if command -v curl &> /dev/null; then
        if curl -s "http://localhost:11434/api/tags" &> /dev/null; then
            log_success "Ollama accessible"
            return 0
        fi
    fi
    
    log_warning "Ollama non accessible - vérifiez qu'il est démarré"
    return 1
}

# Fonction principale
main() {
    echo -e "${BLUE}"
    echo "🌟 BACKENDIA - DÉMARRAGE DU SERVEUR"
    echo "=================================="
    echo -e "${NC}"
    
    # Vérifications
    if [ "$SKIP_CHECKS" = "false" ]; then
        log_info "Exécution des vérifications préliminaires..."
        
        check_python || exit 1
        check_project_structure || exit 1
        check_dependencies || exit 1
        
        # Vérifications optionnelles (ne font pas échouer le démarrage)
        check_mongodb || log_warning "Continuons sans MongoDB..."
        check_ollama || log_warning "Continuons sans Ollama..."
        
        echo ""
        log_success "Vérifications terminées"
    else
        check_python || exit 1
        log_info "Vérifications ignorées (--skip-checks)"
    fi
    
    echo ""
    echo "=================================="
    log_info "Configuration du serveur:"
    echo "  📡 Host: $HOST"
    echo "  🔌 Port: $PORT"
    echo "  🔄 Reload: $RELOAD"
    echo "  👥 Workers: $WORKERS"
    echo "=================================="
    echo ""
    
    # Construire la commande uvicorn
    CMD="$PYTHON_CMD -m uvicorn main:app --host $HOST --port $PORT"
    
    if [ "$RELOAD" = "true" ]; then
        CMD="$CMD --reload"
    fi
    
    if [ "$WORKERS" != "1" ] && [ "$RELOAD" = "false" ]; then
        CMD="$CMD --workers $WORKERS"
    fi
    
    log_info "Démarrage du serveur..."
    log_info "Commande: $CMD"
    echo ""
    log_success "🚀 Serveur BackendIA en cours de démarrage..."
    echo ""
    log_info "📖 Documentation: http://$HOST:$PORT/docs"
    log_info "🏥 Health check: http://$HOST:$PORT/health"
    echo ""
    log_info "Appuyez sur Ctrl+C pour arrêter"
    echo ""
    
    # Exécuter la commande
    exec $CMD
}

# Gestion des signaux
trap 'echo -e "\n${YELLOW}🛑 Arrêt du serveur...${NC}"; exit 0' INT TERM

# Exécuter le script principal
main


