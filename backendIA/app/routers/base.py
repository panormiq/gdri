"""
Routeur pour les routes de base (health check, informations générales)
"""
from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(
    tags=["base"],
    responses={404: {"description": "Not found"}},
)


@router.get("/health")
async def health_check():
    """Vérifier l'état de l'API"""
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": "1.0.0"
    }


@router.get("/")
async def root():
    """Route racine avec informations de base"""
    return {
        "message": f"Bienvenue sur {settings.app_name}",
        "description": "Backend API pour l'intégration avec Ollama et Mistral",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }

