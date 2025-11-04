#!/usr/bin/env python3
"""
Script de démarrage pour BackendIA
"""
import os
import sys
import subprocess
import argparse
from pathlib import Path

def check_dependencies():
    """Vérifier que les dépendances sont installées"""
    print("🔍 Vérification des dépendances...")
    
    try:
        import mongoengine
        import fastapi
        import uvicorn
        import requests
        print("✅ Dépendances Python installées")
        return True
    except ImportError as e:
        print(f"❌ Dépendance manquante: {e}")
        print("💡 Exécutez: pip install -r requirements.txt")
        return False

def check_mongodb():
    """Vérifier la connexion MongoDB"""
    print("🗄️  Vérification de MongoDB...")
    
    try:
        from app.core.config import settings
        from mongoengine import connect
        
        # Tenter la connexion
        connect(host=settings.database_url)
        print("✅ Connexion MongoDB réussie")
        return True
    except Exception as e:
        print(f"❌ Erreur MongoDB: {e}")
        print("💡 Vérifiez que MongoDB est démarré et accessible")
        return False

def check_ollama():
    """Vérifier la connexion Ollama"""
    print("🤖 Vérification d'Ollama...")
    
    try:
        from app.core.config import settings
        import requests
        
        response = requests.get(f"{settings.ollama_base_url}/api/tags", timeout=5)
        response.raise_for_status()
        
        print("✅ Ollama accessible")
        
        # Vérifier si le modèle par défaut est disponible
        data = response.json()
        models = [model['name'] for model in data.get('models', [])]
        
        if settings.ollama_model in models:
            print(f"✅ Modèle '{settings.ollama_model}' disponible")
        else:
            print(f"⚠️  Modèle '{settings.ollama_model}' non trouvé")
            print(f"📥 Modèles disponibles: {', '.join(models[:3])}...")
            
        return True
        
    except Exception as e:
        print(f"❌ Erreur Ollama: {e}")
        print("💡 Vérifiez qu'Ollama est démarré: ollama serve")
        return False

def start_server(host="0.0.0.0", port=8000, reload=False, workers=1):
    """Démarrer le serveur BackendIA"""
    print(f"🚀 Démarrage du serveur BackendIA...")
    print(f"   📡 Host: {host}")
    print(f"   🔌 Port: {port}")
    print(f"   🔄 Reload: {reload}")
    print(f"   👥 Workers: {workers}")
    print()
    
    # Commande uvicorn
    cmd = [
        sys.executable, "-m", "uvicorn",
        "main:app",
        "--host", host,
        "--port", str(port)
    ]
    
    if reload:
        cmd.append("--reload")
    
    if workers > 1 and not reload:
        cmd.extend(["--workers", str(workers)])
    
    # Variables d'environnement
    env = os.environ.copy()
    env["PYTHONPATH"] = str(Path.cwd())
    
    try:
        # Lancer le serveur
        subprocess.run(cmd, env=env, check=True)
    except KeyboardInterrupt:
        print("\n🛑 Arrêt du serveur demandé par l'utilisateur")
    except subprocess.CalledProcessError as e:
        print(f"❌ Erreur lors du démarrage: {e}")
        return False
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")
        return False
    
    return True

def main():
    """Fonction principale"""
    parser = argparse.ArgumentParser(description="Démarrer le serveur BackendIA")
    parser.add_argument("--host", default="0.0.0.0", help="Adresse d'écoute (défaut: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port d'écoute (défaut: 8000)")
    parser.add_argument("--reload", action="store_true", help="Activer le rechargement automatique")
    parser.add_argument("--workers", type=int, default=1, help="Nombre de workers (défaut: 1)")
    parser.add_argument("--no-checks", action="store_true", help="Ignorer les vérifications de dépendances")
    parser.add_argument("--dev", action="store_true", help="Mode développement (équivalent à --reload)")
    
    args = parser.parse_args()
    
    # Mode développement
    if args.dev:
        args.reload = True
        args.workers = 1
    
    print("🌟 BACKENDAI - DÉMARRAGE DU SERVEUR")
    print("=" * 50)
    
    # Vérifications préliminaires
    if not args.no_checks:
        checks = [
            ("Dépendances Python", check_dependencies),
            ("MongoDB", check_mongodb),
            ("Ollama", check_ollama)
        ]
        
        failed_checks = []
        for check_name, check_func in checks:
            if not check_func():
                failed_checks.append(check_name)
        
        if failed_checks:
            print(f"\n❌ Vérifications échouées: {', '.join(failed_checks)}")
            print("💡 Utilisez --no-checks pour ignorer les vérifications")
            return False
        
        print("\n✅ Toutes les vérifications sont passées!")
    
    print("\n" + "=" * 50)
    
    # Démarrer le serveur
    return start_server(
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers
    )

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)


