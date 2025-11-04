"""
Routeur pour gérer différents services externes
"""
from fastapi import APIRouter, HTTPException, status
from datetime import datetime

from app.models.schemas import ServiceRequest, ServiceResponse
from app.core.database import User
from app.core.config import settings

router = APIRouter(
    prefix="/service",
    tags=["services"],
    responses={404: {"description": "Not found"}},
)


@router.post("", response_model=ServiceResponse)
async def handle_service_request(service_request: ServiceRequest):
    """
    Gérer les requêtes de différents services
    
    Cette route permet aux services externes (cron, admin, etc.) 
    d'interagir avec le backend via des tokens d'authentification spécifiques.
    """
    # Vérifier le token de service
    valid_tokens = {
        "cron": settings.CRON_SERVICE_TOKEN,
        "admin": settings.ADMIN_SERVICE_TOKEN
    }
    
    # Déterminer le type de service basé sur le nom
    service_type = None
    if service_request.service_name.lower() in ["cron", "scheduler", "task"]:
        service_type = "cron"
    elif service_request.service_name.lower() in ["admin", "management"]:
        service_type = "admin"
    
    if not service_type or service_request.service_token != valid_tokens.get(service_type):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de service invalide"
        )
    
    try:
        # Traitement selon le service et l'action
        if service_type == "cron":
            return await handle_cron_service(service_request)
        elif service_type == "admin":
            return await handle_admin_service(service_request)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Service non supporté"
            )
            
    except Exception as e:
        return ServiceResponse(
            success=False,
            message=f"Erreur lors du traitement de la requête: {str(e)}",
            timestamp=datetime.utcnow()
        )


async def handle_cron_service(service_request: ServiceRequest) -> ServiceResponse:
    """Gérer les requêtes du service cron"""
    if service_request.action == "health_check":
        return ServiceResponse(
            success=True,
            message="Service cron opérationnel",
            data={"service": "cron", "status": "healthy"},
            timestamp=datetime.utcnow()
        )
    elif service_request.action == "cleanup":
        # Exemple de nettoyage de base de données
        return ServiceResponse(
            success=True,
            message="Nettoyage effectué",
            data={"cleaned_items": 0},  # À implémenter
            timestamp=datetime.utcnow()
        )
    elif service_request.action == "stats":
        # Récupérer des statistiques
        user_count = User.objects.count()
        return ServiceResponse(
            success=True,
            message="Statistiques récupérées",
            data={
                "total_users": user_count,
                "active_users": User.objects(is_active=True).count()
            },
            timestamp=datetime.utcnow()
        )
    elif service_request.action == "ai_task":
        # Nouvelle fonctionnalité : exécuter une tâche IA via cron
        return await handle_cron_ai_task(service_request)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Action '{service_request.action}' non supportée pour le service cron"
        )


async def handle_cron_ai_task(service_request: ServiceRequest) -> ServiceResponse:
    """Gérer les tâches IA pour le service cron"""
    from app.services.ollama_client import ollama_client
    from app.models.schemas import PromptRequest
    
    parameters = service_request.parameters or {}
    prompt = parameters.get("prompt")
    
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le paramètre 'prompt' est requis pour les tâches IA"
        )
    
    try:
        # Créer une requête de prompt
        prompt_request = PromptRequest(
            prompt=prompt,
            model=parameters.get("model"),
            temperature=parameters.get("temperature", 0.7),
            max_tokens=parameters.get("max_tokens", 1000),
            top_p=parameters.get("top_p"),
            top_k=parameters.get("top_k"),
            repeat_penalty=parameters.get("repeat_penalty"),
            stop=parameters.get("stop"),
            stream=parameters.get("stream", False)
        )
        
        # Générer la réponse via Ollama
        response = ollama_client.generate_response(prompt_request)
        
        return ServiceResponse(
            success=True,
            message="Tâche IA exécutée avec succès",
            data={
                "task_type": parameters.get("task_type", "general"),
                "prompt": prompt[:100] + "..." if len(prompt) > 100 else prompt,
                "response": response.response,
                "model": response.model,
                "processing_time": response.processing_time,
                "tokens_used": response.tokens_used
            },
            timestamp=datetime.utcnow()
        )
        
    except Exception as e:
        return ServiceResponse(
            success=False,
            message=f"Erreur lors de l'exécution de la tâche IA: {str(e)}",
            timestamp=datetime.utcnow()
        )


async def handle_admin_service(service_request: ServiceRequest) -> ServiceResponse:
    """Gérer les requêtes du service admin"""
    if service_request.action == "user_management":
        parameters = service_request.parameters or {}
        action_type = parameters.get("type")
        
        if action_type == "disable_user":
            username = parameters.get("username")
            if not username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username requis pour désactiver un utilisateur"
                )
            
            user = User.objects(username=username).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Utilisateur non trouvé"
                )
            
            user.is_active = False
            user.save()
            
            return ServiceResponse(
                success=True,
                message=f"Utilisateur '{username}' désactivé",
                data={"username": username, "is_active": False},
                timestamp=datetime.utcnow()
            )
        
        elif action_type == "enable_user":
            username = parameters.get("username")
            if not username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username requis pour activer un utilisateur"
                )
            
            user = User.objects(username=username).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Utilisateur non trouvé"
                )
            
            user.is_active = True
            user.save()
            
            return ServiceResponse(
                success=True,
                message=f"Utilisateur '{username}' activé",
                data={"username": username, "is_active": True},
                timestamp=datetime.utcnow()
            )
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Type d'action '{action_type}' non supporté"
            )
    
    elif service_request.action == "system_info":
        user_count = User.objects.count()
        return ServiceResponse(
            success=True,
            message="Informations système récupérées",
            data={
                "app_name": settings.app_name,
                "total_users": user_count,
                "ollama_url": settings.ollama_base_url,
                "ollama_model": settings.ollama_model
            },
            timestamp=datetime.utcnow()
        )
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Action '{service_request.action}' non supportée pour le service admin"
        )
