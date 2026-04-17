"""
Routeur pour l'API gateway : proxy brut vers Ollama.
Utilisé par le backend Node (module ia) sans JWT utilisateur.
Authentification par token de service (IA_SERVICE_TOKEN ou DEV_TOKEN).
"""
import json
import threading
from typing import Dict, Any

import requests
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings
from app.models.schemas import PromptRequest, PromptResponse
from app.services.ollama_client import ollama_client

# État des installations en cours (model_name -> { status, completed, total, message })
_pull_status: Dict[str, Dict[str, Any]] = {}
_pull_lock = threading.Lock()


def _run_pull(model_name: str) -> None:
    """Lance le pull Ollama en arrière-plan et met à jour _pull_status (stream NDJSON)."""
    base = settings.ollama_base_url.rstrip("/")
    url = f"{base}/api/pull"
    with _pull_lock:
        _pull_status[model_name] = {
            "status": "downloading",
            "completed": 0,
            "total": 0,
            "message": "Démarrage…",
        }
    try:
        r = requests.post(url, json={"name": model_name}, timeout=3600, stream=True)
        r.raise_for_status()
        completed_total = 0
        total_total = 0
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            status_str = data.get("status", "")
            completed = data.get("completed") or 0
            total = data.get("total") or 0
            if total > 0:
                completed_total = completed
                total_total = total
            msg = status_str or data.get("message", "")
            with _pull_lock:
                _pull_status[model_name] = {
                    "status": "downloading",
                    "completed": completed_total,
                    "total": total_total,
                    "message": msg or f"{completed_total} / {total_total}",
                }
        with _pull_lock:
            _pull_status[model_name] = {
                "status": "completed",
                "completed": completed_total,
                "total": total_total,
                "message": "Modèle installé",
            }
    except requests.RequestException as e:
        with _pull_lock:
            _pull_status[model_name] = {
                "status": "error",
                "completed": 0,
                "total": 0,
                "message": str(e),
            }
    except Exception as e:
        with _pull_lock:
            _pull_status[model_name] = {
                "status": "error",
                "completed": 0,
                "total": 0,
                "message": str(e),
            }


router = APIRouter(
    prefix="/api",
    tags=["generate"],
    responses={404: {"description": "Not found"}},
)

security = HTTPBearer(auto_error=False)


def verify_gateway_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> None:
    """Accepte IA_SERVICE_TOKEN ou DEV_TOKEN pour les appels depuis le backend Node."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer requis",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    if token != settings.IA_SERVICE_TOKEN and not (
        settings.enable_dev_token and token == settings.DEV_TOKEN
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get("/models")
async def list_models(_: None = Depends(verify_gateway_token)):
    """
    Liste des modèles Ollama disponibles (appel GET à Ollama /api/tags).
    Permet au backoffice GDRI de lister les LLM locaux après avoir testé le serveur.
    """
    try:
        r = requests.get(
            f"{settings.ollama_base_url.rstrip('/')}/api/tags",
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        models = [
            {"name": m.get("name"), "size": m.get("size")}
            for m in data.get("models", [])
        ]
        return {"success": True, "models": models}
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ollama injoignable: {str(e)}",
        )


@router.post("/models/add")
async def add_model(
    payload: dict,
    background_tasks: BackgroundTasks,
    _: None = Depends(verify_gateway_token),
):
    """
    Démarre l'installation d'un modèle Ollama en arrière-plan (équivalent `ollama pull`).
    Répond immédiatement. Suivre la progression via GET /api/models/install-status?model=...
    Convention: body { "name": "<model>" }.
    """
    name = (payload or {}).get("name")
    if not name or not str(name).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Champ 'name' requis",
        )
    model_name = str(name).strip()
    with _pull_lock:
        if model_name in _pull_status and _pull_status[model_name].get("status") == "downloading":
            return {
                "success": True,
                "started": True,
                "message": "Installation déjà en cours",
                "model": model_name,
            }
    background_tasks.add_task(_run_pull, model_name)
    return {
        "success": True,
        "started": True,
        "message": "Installation démarrée. Consultez le statut pour la progression.",
        "model": model_name,
    }


@router.get("/models/install-status")
async def install_status(
    model: str,
    _: None = Depends(verify_gateway_token),
):
    """
    Retourne l'état de l'installation d'un modèle (pull en cours ou terminé).
    Réponse: { status: "idle"|"downloading"|"completed"|"error", completed?, total?, message? }
    """
    if not model or not model.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Paramètre 'model' requis",
        )
    key = model.strip()
    with _pull_lock:
        state = _pull_status.get(key)
    if not state:
        return {"success": True, "status": "idle", "model": key}
    return {
        "success": True,
        "status": state.get("status", "idle"),
        "model": key,
        "completed": state.get("completed", 0),
        "total": state.get("total", 0),
        "message": state.get("message", ""),
    }


@router.post("/models/delete")
async def delete_model(payload: dict, _: None = Depends(verify_gateway_token)):
    """
    Supprime un modèle Ollama (équivalent d'un `ollama delete`).
    Convention: body { "name": "<model>" }.
    """
    name = (payload or {}).get("name")
    if not name or not str(name).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Champ 'name' requis",
        )
    try:
        r = requests.post(
            f"{settings.ollama_base_url.rstrip('/')}/api/delete",
            json={"name": str(name).strip()},
            timeout=600,
        )
        r.raise_for_status()
        raw = r.text or ""
        data = {}
        try:
            data = r.json()
        except ValueError:
            if raw:
                data = {"raw": raw}
        return {"success": True, "message": "Modèle supprimé", "data": data}
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ollama injoignable lors du delete: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la suppression du modèle: {str(e)}",
        )


@router.post("/generate", response_model=PromptResponse)
async def generate(
    prompt_request: PromptRequest,
    _: None = Depends(verify_gateway_token),
):
    """
    Proxy brut vers Ollama. Utilisé par le module ia (backend Node).
    Même contrat que l'appel direct Ollama : prompt + options, retourne la réponse.
    """
    try:
        response = ollama_client.generate_response(prompt_request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'appel Ollama: {str(e)}",
        )


@router.post("/generate/stream")
def generate_stream(
    prompt_request: PromptRequest,
    _: None = Depends(verify_gateway_token),
):
    """
    Génération en flux (SSE) : événements data: {"token":"..."} puis data: {"done":true,"full":"..."}.
    Même corps JSON que POST /api/generate. Utilisé par le module Chat (proxy Node).
    """
    return StreamingResponse(
        ollama_client.iter_generate_sse(prompt_request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
