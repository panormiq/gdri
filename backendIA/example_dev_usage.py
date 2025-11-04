"""
Exemple d'utilisation du BackendIA en mode développement
"""
import requests

# Configuration
BASE_URL = "http://192.168.1.53:8000"  # Ou "http://localhost:8000" en local
DEV_TOKEN = "dev-token-123456789-quick-access"

# Headers avec le token de développement
headers = {
    "Authorization": f"Bearer {DEV_TOKEN}"
}


def test_prompt_simple():
    """Tester une requête simple"""
    print("🧪 Test 1: Prompt simple")
    
    response = requests.post(
        f"{BASE_URL}/api/prompt",
        headers=headers,
        json={
            "prompt": "Bonjour, comment vas-tu ?"
        }
    )
    
    if response.status_code == 200:
        print("✅ Succès!")
        print(f"Réponse: {response.json()['response'][:100]}...")
    else:
        print(f"❌ Erreur: {response.status_code}")
        print(response.text)
    print()


def test_prompt_avec_parametres():
    """Tester avec des paramètres personnalisés"""
    print("🧪 Test 2: Prompt avec paramètres")
    
    response = requests.post(
        f"{BASE_URL}/api/prompt",
        headers=headers,
        json={
            "prompt": "Explique-moi le concept de l'intelligence artificielle en 3 phrases.",
            "temperature": 0.7,
            "max_tokens": 200,
            "model": "mistral:latest"
        }
    )
    
    if response.status_code == 200:
        print("✅ Succès!")
        data = response.json()
        print(f"Réponse: {data['response']}")
        print(f"Modèle: {data['model']}")
        print(f"Temps de traitement: {data.get('processing_time', 'N/A')}s")
    else:
        print(f"❌ Erreur: {response.status_code}")
        print(response.text)
    print()


def test_user_info():
    """Vérifier les informations de l'utilisateur dev"""
    print("🧪 Test 3: Informations utilisateur")
    
    response = requests.get(
        f"{BASE_URL}/auth/me",
        headers=headers
    )
    
    if response.status_code == 200:
        print("✅ Succès!")
        user = response.json()
        print(f"Username: {user['username']}")
        print(f"Email: {user['email']}")
        print(f"Role: {user['role']}")
    else:
        print(f"❌ Erreur: {response.status_code}")
        print(response.text)
    print()


def test_health_check():
    """Vérifier que le serveur est en ligne"""
    print("🧪 Test 0: Health check")
    
    response = requests.get(f"{BASE_URL}/")
    
    if response.status_code == 200:
        print("✅ Serveur en ligne!")
        print(response.json())
    else:
        print(f"❌ Serveur hors ligne: {response.status_code}")
    print()


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 TESTS DE DÉVELOPPEMENT - BACKENDAI")
    print("=" * 60)
    print()
    
    try:
        test_health_check()
        test_user_info()
        test_prompt_simple()
        test_prompt_avec_parametres()
        
        print("=" * 60)
        print("✅ Tous les tests sont terminés!")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("❌ Impossible de se connecter au serveur.")
        print(f"   Vérifiez que le serveur est démarré sur {BASE_URL}")
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")


