#!/usr/bin/env python3
"""
Script de validation pour l'architecture modulaire de BackendIA
"""
import sys
from typing import List, Callable


class StructureValidator:
    """Validateur pour l'architecture de l'application"""
    
    def __init__(self):
        self.tests_passed = 0
        self.tests_total = 0
        self.errors = []
    
    def run_test(self, test_func: Callable, test_name: str) -> bool:
        """Exécuter un test et enregistrer le résultat"""
        self.tests_total += 1
        try:
            print(f"🔍 {test_name}...")
            result = test_func()
            if result:
                print(f"✅ {test_name} - RÉUSSI")
                self.tests_passed += 1
                return True
            else:
                print(f"❌ {test_name} - ÉCHEC")
                return False
        except Exception as e:
            print(f"❌ {test_name} - ERREUR: {e}")
            self.errors.append(f"{test_name}: {e}")
            return False
    
    def validate_imports(self) -> bool:
        """Valider tous les imports de la nouvelle structure"""
        try:
            # Core modules
            from app.core.config import settings
            from app.core.database import User, UserRole
            from app.core.auth import get_password_hash, verify_password
            
            # Models
            from app.models.schemas import UserCreate, PromptRequest, ServiceRequest
            
            # Routers
            from app.routers import auth, prompt, admin, services, base
            
            # Services
            from app.services.ollama_client import ollama_client
            from app.services.user_service import UserService
            from app.services.prompt_service import PromptService
            
            # Main app
            from main import app
            
            return True
        except ImportError as e:
            self.errors.append(f"Import error: {e}")
            return False
    
    def validate_fastapi_app(self) -> bool:
        """Valider la création de l'application FastAPI"""
        try:
            from main import app
            from fastapi import FastAPI
            
            if not isinstance(app, FastAPI):
                return False
            
            # Vérifier que les routes sont bien enregistrées
            routes = [route.path for route in app.routes]
            expected_routes = ["/", "/health", "/auth/register", "/auth/login", "/api/prompt"]
            
            for expected in expected_routes:
                if not any(expected in route for route in routes):
                    self.errors.append(f"Route manquante: {expected}")
                    return False
            
            return True
        except Exception as e:
            self.errors.append(f"FastAPI validation error: {e}")
            return False
    
    def validate_services(self) -> bool:
        """Valider les services métier"""
        try:
            from app.services.user_service import UserService
            from app.services.prompt_service import PromptService
            
            # Test UserService
            if not hasattr(UserService, 'get_user_stats'):
                return False
            
            # Test PromptService
            models = PromptService.get_available_models()
            if not isinstance(models, list) or len(models) == 0:
                return False
            
            params = PromptService.get_default_parameters()
            if not isinstance(params, dict) or len(params) == 0:
                return False
            
            return True
        except Exception as e:
            self.errors.append(f"Services validation error: {e}")
            return False
    
    def validate_database_models(self) -> bool:
        """Valider les modèles de base de données"""
        try:
            from app.core.database import User, UserRole
            from mongoengine import Document
            
            # Vérifier que User hérite de Document
            if not issubclass(User, Document):
                return False
            
            # Vérifier les champs requis
            required_fields = ['username', 'email', 'hashed_password', 'role', 'is_active']
            user_fields = [field for field in User._fields.keys()]
            
            for field in required_fields:
                if field not in user_fields:
                    self.errors.append(f"Champ manquant dans User: {field}")
                    return False
            
            return True
        except Exception as e:
            self.errors.append(f"Database models validation error: {e}")
            return False
    
    def validate_configuration(self) -> bool:
        """Valider la configuration"""
        try:
            from app.core.config import settings
            
            required_settings = [
                'app_name', 'database_url', 'secret_key', 
                'ollama_base_url', 'ollama_model'
            ]
            
            for setting in required_settings:
                if not hasattr(settings, setting):
                    self.errors.append(f"Configuration manquante: {setting}")
                    return False
                
                value = getattr(settings, setting)
                if not value:
                    self.errors.append(f"Configuration vide: {setting}")
                    return False
            
            return True
        except Exception as e:
            self.errors.append(f"Configuration validation error: {e}")
            return False
    
    def validate_auth_system(self) -> bool:
        """Valider le système d'authentification"""
        try:
            from app.core.auth import get_password_hash, verify_password
            
            # Test de hachage et vérification
            password = "test123"
            hashed = get_password_hash(password)
            
            if not hashed or len(hashed) < 20:
                return False
            
            if not verify_password(password, hashed):
                return False
            
            if verify_password("wrong_password", hashed):
                return False
            
            return True
        except Exception as e:
            self.errors.append(f"Auth system validation error: {e}")
            return False
    
    def print_summary(self):
        """Afficher le résumé des tests"""
        print("\n" + "=" * 80)
        print(f"📊 RÉSULTATS DE VALIDATION : {self.tests_passed}/{self.tests_total} tests réussis")
        
        if self.tests_passed == self.tests_total:
            print("🎉 SUCCÈS ! L'architecture modulaire est entièrement fonctionnelle.")
            print("\n🏗️  ARCHITECTURE VALIDÉE :")
            print("   ✅ Structure modulaire")
            print("   ✅ Imports fonctionnels")
            print("   ✅ Application FastAPI")
            print("   ✅ Services métier")
            print("   ✅ Modèles de données")
            print("   ✅ Configuration")
            print("   ✅ Système d'authentification")
            print("\n🚀 L'application est prête pour le déploiement !")
            return True
        else:
            print("❌ ÉCHEC ! Certains composants nécessitent des corrections.")
            if self.errors:
                print("\n🔍 ERREURS DÉTECTÉES :")
                for i, error in enumerate(self.errors, 1):
                    print(f"   {i}. {error}")
            return False


def main():
    """Fonction principale de validation"""
    print("🚀 VALIDATION DE L'ARCHITECTURE MODULAIRE - BackendIA")
    print("=" * 80)
    
    validator = StructureValidator()
    
    # Liste des tests à exécuter
    tests = [
        (validator.validate_imports, "Validation des imports"),
        (validator.validate_fastapi_app, "Validation de l'application FastAPI"),
        (validator.validate_services, "Validation des services métier"),
        (validator.validate_database_models, "Validation des modèles de données"),
        (validator.validate_configuration, "Validation de la configuration"),
        (validator.validate_auth_system, "Validation du système d'authentification"),
    ]
    
    # Exécuter tous les tests
    for test_func, test_name in tests:
        validator.run_test(test_func, test_name)
        print()  # Ligne vide pour la lisibilité
    
    # Afficher le résumé
    success = validator.print_summary()
    
    # Code de sortie
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

