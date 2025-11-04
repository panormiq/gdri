"""
Service pour la gestion des utilisateurs
"""
from typing import Optional, List
from app.core.database import User, UserRole
from app.models.schemas import UserCreate, UserResponse
from app.core.auth import get_password_hash


class UserService:
    """Service pour les opérations sur les utilisateurs"""
    
    @staticmethod
    def create_user(user_data: UserCreate) -> User:
        """Créer un nouvel utilisateur"""
        # Vérifier si l'utilisateur existe déjà
        existing_user = User.objects(username=user_data.username).first() or User.objects(email=user_data.email).first()
        
        if existing_user:
            raise ValueError("Username ou email déjà utilisé")
        
        # Créer le nouvel utilisateur
        hashed_password = get_password_hash(user_data.password)
        db_user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            role=user_data.role.value if user_data.role else "user"
        )
        
        db_user.save()
        return db_user
    
    @staticmethod
    def get_user_by_username(username: str) -> Optional[User]:
        """Récupérer un utilisateur par son nom d'utilisateur"""
        try:
            return User.objects(username=username).first()
        except Exception:
            return None
    
    @staticmethod
    def get_user_by_email(email: str) -> Optional[User]:
        """Récupérer un utilisateur par son email"""
        try:
            return User.objects(email=email).first()
        except Exception:
            return None
    
    @staticmethod
    def get_all_users() -> List[User]:
        """Récupérer tous les utilisateurs"""
        return list(User.objects.all())
    
    @staticmethod
    def update_user_status(username: str, is_active: bool) -> Optional[User]:
        """Mettre à jour le statut d'un utilisateur"""
        user = User.objects(username=username).first()
        if not user:
            return None
        
        user.is_active = is_active
        user.save()
        return user
    
    @staticmethod
    def delete_user(username: str) -> bool:
        """Supprimer un utilisateur"""
        user = User.objects(username=username).first()
        if not user:
            return False
        
        user.delete()
        return True
    
    @staticmethod
    def get_user_stats() -> dict:
        """Récupérer les statistiques des utilisateurs"""
        total_users = User.objects.count()
        active_users = User.objects(is_active=True).count()
        admin_users = User.objects(role="admin").count()
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": total_users - active_users,
            "admin_users": admin_users,
            "regular_users": total_users - admin_users
        }
    
    @staticmethod
    def to_response_model(user: User) -> UserResponse:
        """Convertir un modèle User en UserResponse"""
        return UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at
        )

