"""
Routeur pour l'authentification des utilisateurs
"""
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import timedelta
from typing import List

from app.core.database import User
from app.models.schemas import UserCreate, UserLogin, UserResponse, Token
from app.core.auth import (
    authenticate_user, 
    create_access_token, 
    get_current_active_user, 
    get_password_hash,
    require_admin
)
from app.core.config import settings

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
    responses={404: {"description": "Not found"}},
)


@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate):
    """Créer un nouvel utilisateur"""
    # Vérifier si l'utilisateur existe déjà
    existing_user = User.objects(username=user.username).first() or User.objects(email=user.email).first()
    
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username ou email déjà utilisé"
        )
    
    # Créer le nouvel utilisateur
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role.value if user.role else "user"
    )
    
    db_user.save()
    
    return UserResponse(
        id=str(db_user.id),
        username=db_user.username,
        email=db_user.email,
        role=db_user.role,
        is_active=db_user.is_active,
        created_at=db_user.created_at
    )


@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
    """Se connecter et obtenir un token JWT"""
    user = authenticate_user(user_credentials.username, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Obtenir les informations de l'utilisateur actuel"""
    return UserResponse(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )

