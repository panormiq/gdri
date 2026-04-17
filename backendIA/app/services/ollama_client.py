import json
import requests
import time
from typing import Dict, Any, Iterator
from app.models.schemas import PromptRequest, PromptResponse
from app.core.config import settings
from datetime import datetime


class OllamaClient:
    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = base_url or settings.ollama_base_url
        self.model = model or settings.ollama_model
    
    def generate_response(self, prompt_request: PromptRequest) -> PromptResponse:
        """Générer une réponse via Ollama"""
        start_time = time.time()
        
        payload = self._build_ollama_payload(prompt_request, stream=prompt_request.stream)

        try:
            # Faire l'appel à l'API Ollama
            # Timeout de 5 minutes (300 secondes) pour les analyses longues
            # Le test direct montre ~173 secondes, on prévoit une marge
            # Utiliser stream=True pour permettre la collecte progressive des données
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                stream=True,  # Permet de lire les données au fur et à mesure
                timeout=300  # Timeout de 5 minutes (augmenté pour analyses longues)
            )
            response.raise_for_status()
            
            # Traiter la réponse
            # Avec stream=True dans requests, on peut toujours utiliser iter_lines()
            # Ollama retourne soit une ligne JSON (stream=False) soit plusieurs lignes (stream=True)
            full_response = ""
            for line in response.iter_lines():
                if line:
                    try:
                        data = line.decode('utf-8')
                        if data.strip():
                            chunk = json.loads(data)
                            if 'response' in chunk:
                                full_response += chunk['response']
                            # Si done=True, on a fini (pour streaming et non-streaming)
                            if chunk.get('done', False):
                                break
                    except json.JSONDecodeError:
                        continue
            
            response_text = full_response
            
            processing_time = time.time() - start_time
            
            return PromptResponse(
                response=response_text,
                model=prompt_request.model or self.model,
                created_at=datetime.utcnow(),
                processing_time=processing_time
            )
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Erreur lors de l'appel à Ollama: {str(e)}")
        except Exception as e:
            raise Exception(f"Erreur lors du traitement de la réponse: {str(e)}")

    def _build_ollama_payload(self, prompt_request: PromptRequest, stream: bool) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "model": prompt_request.model or self.model,
            "prompt": prompt_request.prompt,
            "stream": stream,
        }
        if prompt_request.temperature is not None:
            payload["options"] = payload.get("options", {})
            payload["options"]["temperature"] = prompt_request.temperature
        if prompt_request.max_tokens is not None:
            payload["options"] = payload.get("options", {})
            payload["options"]["num_predict"] = prompt_request.max_tokens
        if prompt_request.top_p is not None:
            payload["options"] = payload.get("options", {})
            payload["options"]["top_p"] = prompt_request.top_p
        if prompt_request.top_k is not None:
            payload["options"] = payload.get("options", {})
            payload["options"]["top_k"] = prompt_request.top_k
        if prompt_request.repeat_penalty is not None:
            payload["options"] = payload.get("options", {})
            payload["options"]["repeat_penalty"] = prompt_request.repeat_penalty
        if prompt_request.stop is not None:
            payload["options"] = payload.get("options", {})
            payload["options"]["stop"] = prompt_request.stop
        return payload

    def iter_generate_sse(self, prompt_request: PromptRequest) -> Iterator[str]:
        """
        Stream Ollama NDJSON vers des événements SSE : token par token puis done.
        Chaque yield est un bloc SSE complet (ligne data + double saut de ligne).
        """
        payload = self._build_ollama_payload(prompt_request, stream=True)
        try:
            response = requests.post(
                f"{self.base_url.rstrip('/')}/api/generate",
                json=payload,
                stream=True,
                timeout=300,
            )
            response.raise_for_status()
            full_response = ""
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                piece = chunk.get("response") or ""
                if piece:
                    full_response += piece
                    yield f"data: {json.dumps({'token': piece}, ensure_ascii=False)}\n\n"
                if chunk.get("done", False):
                    break
            yield (
                f"data: {json.dumps({'done': True, 'full': full_response, 'model': prompt_request.model or self.model}, ensure_ascii=False)}\n\n"
            )
        except requests.exceptions.RequestException as e:
            yield f"data: {json.dumps({'error': f'Ollama: {str(e)}'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"


# Instance globale du client Ollama
ollama_client = OllamaClient()
