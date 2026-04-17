"""
Point d'entrée principal de l'application BackendIA

Ce fichier contient uniquement l'initialisation de l'application FastAPI
et l'inclusion des routeurs. La logique métier est déplacée dans les modules appropriés.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import create_tables
from app.routers import auth, prompt, admin, services, base, generate


def create_application() -> FastAPI:
    """
    Créer et configurer l'application FastAPI
    
    Returns:
        FastAPI: L'application configurée
    """
    # Créer l'application FastAPI
    application = FastAPI(
        title=settings.app_name,
        description="Backend API pour l'intégration avec Ollama et Mistral",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # Configuration CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # En production, spécifiez les domaines autorisés
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Inclure les routeurs
    application.include_router(base.router)
    application.include_router(auth.router)
    application.include_router(prompt.router)
    application.include_router(admin.router)
    application.include_router(services.router)
    application.include_router(generate.router)

    return application


# Créer l'instance de l'application
app = create_application()


@app.on_event("startup")
async def startup_event():
    """Événement de démarrage de l'application"""
    print("=" * 50)
    print(f"🚀 {settings.app_name} démarré")
    print(f"📡 Ollama URL: {settings.ollama_base_url}")
    print(f"🤖 Modèle par défaut: {settings.ollama_model}")
    print(f"🔧 Mode debug: {settings.debug}")
    print(f"🗄️  Base de données: MongoDB")
    print("=" * 50)
    
    # Créer les index MongoDB
    create_tables()
    print("✅ Connexion à la base de données établie")


@app.on_event("shutdown")
async def shutdown_event():
    """Événement d'arrêt de l'application"""
    print("🛑 Arrêt de l'application BackendIA")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=settings.debug,
        log_level="info"
    )
