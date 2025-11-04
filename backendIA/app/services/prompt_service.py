"""
Service pour la gestion des prompts et l'interaction avec Ollama
"""
from typing import Optional
from app.models.schemas import PromptRequest, PromptResponse
from app.services.ollama_client import ollama_client


class PromptService:
    """Service pour les opérations sur les prompts"""
    
    @staticmethod
    async def generate_response(prompt_request: PromptRequest, user_id: str) -> PromptResponse:
        """
        Générer une réponse via Ollama
        
        Args:
            prompt_request: La requête de prompt
            user_id: L'ID de l'utilisateur qui fait la requête
            
        Returns:
            PromptResponse: La réponse générée
            
        Raises:
            Exception: Si une erreur survient lors de la génération
        """
        try:
            # Ici on pourrait ajouter de la logique métier :
            # - Logging de la requête
            # - Validation du prompt
            # - Limitation du taux de requêtes par utilisateur
            # - Personnalisation selon l'utilisateur
            
            # Pour l'instant, on délègue directement à ollama_client
            response = ollama_client.generate_response(prompt_request)
            
            # Ici on pourrait ajouter :
            # - Sauvegarde de la conversation
            # - Mise à jour des statistiques utilisateur
            # - Post-traitement de la réponse
            
            return response
            
        except Exception as e:
            # Logging de l'erreur
            raise Exception(f"Erreur lors de la génération de la réponse: {str(e)}")
    
    @staticmethod
    def validate_prompt(prompt: str) -> bool:
        """
        Valider un prompt avant de l'envoyer à Ollama
        
        Args:
            prompt: Le prompt à valider
            
        Returns:
            bool: True si le prompt est valide, False sinon
        """
        if not prompt or not prompt.strip():
            return False
        
        # Vérifier la longueur
        if len(prompt) > 10000:  # Limite arbitraire
            return False
        
        # Ici on pourrait ajouter d'autres validations :
        # - Filtrage de contenu inapproprié
        # - Validation de la structure
        # - etc.
        
        return True
    
    @staticmethod
    def get_available_models() -> list:
        """
        Récupérer la liste des modèles disponibles
        
        Returns:
            list: Liste des modèles disponibles
        """
        # Pour l'instant, on retourne une liste statique
        # Dans une version plus avancée, on pourrait interroger Ollama
        return [
            "mistral:latest",
            "llama2:latest", 
            "codellama:latest",
            "vicuna:latest"
        ]
    
    @staticmethod
    def get_default_parameters() -> dict:
        """
        Récupérer les paramètres par défaut pour les prompts
        
        Returns:
            dict: Paramètres par défaut
        """
        return {
            "temperature": 0.7,
            "max_tokens": 1000,
            "top_p": 0.9,
            "top_k": 40,
            "repeat_penalty": 1.1,
            "stream": False
        }

