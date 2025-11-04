"""
Routeur pour l'administration (admin seulement)
"""
from fastapi import APIRouter, Depends
from typing import List

from app.core.database import User
from app.models.schemas import UserResponse
from app.core.auth import require_admin
from app.core.config import settings

router = APIRouter(
    prefix="/admin",
    tags=["administration"],
    responses={404: {"description": "Not found"}},
)


@router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: User = Depends(require_admin)):
    """Lister tous les utilisateurs (admin seulement)"""
    users = User.objects.all()
    return [
        UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at
        ) for user in users
    ]


@router.get("/stats")
async def get_stats(current_user: User = Depends(require_admin)):
    """Obtenir les statistiques de l'API (admin seulement)"""
    return {
        "message": "Statistiques de l'API",
        "ollama_url": settings.ollama_base_url,
        "default_model": settings.ollama_model,
        "total_users": User.objects.count(),
        "active_users": User.objects(is_active=True).count(),
        "timestamp": "2024-01-01T00:00:00Z"  # À remplacer par des vraies stats
    }

