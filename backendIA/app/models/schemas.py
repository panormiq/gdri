from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from app.core.database import UserRole


# Modèles pour l'authentification
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[UserRole] = UserRole.USER


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str  # MongoDB utilise des ObjectId comme string
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# Modèles pour l'API prompt
class PromptRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    repeat_penalty: Optional[float] = None
    stop: Optional[list] = None
    stream: Optional[bool] = False


class PromptResponse(BaseModel):
    response: str
    model: str
    created_at: datetime
    tokens_used: Optional[int] = None
    processing_time: Optional[float] = None


# Modèles pour les services
class ServiceRequest(BaseModel):
    service_name: str
    action: str
    parameters: Optional[Dict[str, Any]] = None
    service_token: str


class ServiceResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    timestamp: datetime
