#!/usr/bin/env python3
"""
Script de test pour la nouvelle fonctionnalité AI via l'API Service
"""
import requests
import json
from datetime import datetime

def test_service_ai():
    """Tester la fonctionnalité AI via l'API service"""
    
    # Configuration
    api_url = "http://localhost:8000/service"
    service_token = "cron-service-token-987654321-xyz"
    
    # Payload pour tester l'action ai_task
    payload = {
        "service_name": "cron",
        "action": "ai_task",
        "service_token": service_token,
        "parameters": {
            "prompt": "Génère un petit résumé de 50 mots sur l'importance de l'automatisation dans les entreprises modernes.",
            "task_type": "test_automation",
            "temperature": 0.7,
            "max_tokens": 100
        }
    }
    
    try:
        print("🚀 Test de l'API Service AI...")
        print(f"URL: {api_url}")
        print(f"Action: ai_task")
        print(f"Prompt: {payload['parameters']['prompt'][:50]}...")
        
        # Faire la requête
        response = requests.post(
            api_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        print(f"\n📡 Code de réponse: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("success"):
                print("✅ Requête réussie!")
                print(f"Message: {data.get('message')}")
                
                response_data = data.get("data", {})
                print(f"\n📊 Détails de la réponse:")
                print(f"  - Type de tâche: {response_data.get('task_type')}")
                print(f"  - Modèle utilisé: {response_data.get('model')}")
                print(f"  - Temps de traitement: {response_data.get('processing_time'):.2f}s")
                print(f"  - Tokens utilisés: {response_data.get('tokens_used')}")
                
                print(f"\n🤖 Réponse IA:")
                print("-" * 50)
                print(response_data.get('response', 'Pas de réponse'))
                print("-" * 50)
                
                return True
            else:
                print("❌ Requête échouée!")
                print(f"Message d'erreur: {data.get('message')}")
                return False
        else:
            print(f"❌ Erreur HTTP: {response.status_code}")
            print(f"Réponse: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de requête: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Erreur de décodage JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")
        return False

def test_health_check():
    """Tester le health check via l'API service"""
    
    api_url = "http://localhost:8000/service"
    service_token = "cron-service-token-987654321-xyz"
    
    payload = {
        "service_name": "cron",
        "action": "health_check",
        "service_token": service_token
    }
    
    try:
        print("\n🏥 Test du Health Check...")
        
        response = requests.post(api_url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Health check réussi!")
                print(f"Status: {data.get('data', {}).get('status')}")
                return True
            else:
                print("❌ Health check échoué!")
                return False
        else:
            print(f"❌ Erreur HTTP: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

def test_stats():
    """Tester la récupération des statistiques"""
    
    api_url = "http://localhost:8000/service"
    service_token = "cron-service-token-987654321-xyz"
    
    payload = {
        "service_name": "cron",
        "action": "stats",
        "service_token": service_token
    }
    
    try:
        print("\n📊 Test des Statistiques...")
        
        response = requests.post(api_url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Statistiques récupérées!")
                stats = data.get('data', {})
                print(f"  - Utilisateurs totaux: {stats.get('total_users', 0)}")
                print(f"  - Utilisateurs actifs: {stats.get('active_users', 0)}")
                return True
            else:
                print("❌ Récupération des statistiques échouée!")
                return False
        else:
            print(f"❌ Erreur HTTP: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

def main():
    """Fonction principale de test"""
    print("🧪 TEST DE L'API SERVICE BACKENDAI")
    print("=" * 50)
    
    tests = [
        ("Health Check", test_health_check),
        ("Statistiques", test_stats),
        ("Tâche IA", test_service_ai)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"❌ Erreur dans {test_name}: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 RÉSULTATS: {passed}/{total} tests réussis")
    
    if passed == total:
        print("🎉 Tous les tests sont passés!")
        print("✅ L'API Service AI est fonctionnelle!")
    else:
        print("⚠️  Certains tests ont échoué.")
        print("💡 Vérifiez que BackendIA est en cours d'exécution sur localhost:8000")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)

