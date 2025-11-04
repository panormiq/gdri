"""
Routeur pour l'API de génération de prompts
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import User
from app.models.schemas import PromptRequest, PromptResponse
from app.core.auth import get_current_active_user
from app.services.ollama_client import ollama_client

router = APIRouter(
    prefix="/api",
    tags=["prompt"],
    responses={404: {"description": "Not found"}},
)


@router.post("/prompt", response_model=PromptResponse)
async def generate_prompt(
    prompt_request: PromptRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Générer une réponse via Ollama/Mistral
    
    Cette route est accessible aux utilisateurs authentifiés (user et admin).
    Elle accepte un prompt et des paramètres optionnels pour l'IA.
    """
    try:
        # Générer la réponse via Ollama
        response = ollama_client.generate_response(prompt_request)
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération de la réponse: {str(e)}"
        )

