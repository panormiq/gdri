from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database MongoDB
    database_url: str = "mongodb://backend_user:Bn0n0t4t4!@localhost:27017/backend_ia"
    
    # JWT (pour le mode autonome)
    secret_key: str = "Bonjour je m'appelle backendIA je repond à tes prompt."
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral:latest"
    
    # Backend principal (pour plus tard)
    main_backend_url: str = "http://localhost:3000"
    standalone_mode: bool = True

    
    # Tokens de services spécifiques
    CRON_SERVICE_TOKEN: str = "cron-service-token-987654321-xyz"
    ADMIN_SERVICE_TOKEN: str = "admin-service-token-456789123-abc"
    
    # Token de développement (à désactiver en production !)
    DEV_TOKEN: str = "dev-token-123456789-quick-access"
    enable_dev_token: bool = True  # Mettre à False en production

    # Token pour l'API gateway (backend Node / modules) - appelle /api/generate sans JWT user
    IA_SERVICE_TOKEN: str = "ia-service-token-gdri-gateway"
    
    # App
    app_name: str = "BackendIA"
    debug: bool = True
    
    class Config:
        env_file = ".env"


settings = Settings()