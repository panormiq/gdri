(function (global) {
  const isEmbedded = new URLSearchParams(window.location.search).get('embedded') === '1';
  if (isEmbedded) document.body.classList.add('embedded');

  const MODEL = 'flux';

  const statusEl = document.getElementById('status');
  const messagesEl = document.getElementById('messages');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const genBtn = document.getElementById('genBtn');
  const modelHints = document.getElementById('modelHints');
  const typingEl = document.getElementById('typing');
  const galleryEl = document.getElementById('gallery');
  const gallerySelectAllBtn = document.getElementById('gallerySelectAllBtn');
  const galleryDeleteSelectedBtn = document.getElementById('galleryDeleteSelectedBtn');
  const gallerySelectionInfo = document.getElementById('gallerySelectionInfo');

  const sceneMessagesEl = document.getElementById('sceneMessages');
  const sceneInput = document.getElementById('sceneInput');
  const sceneSendBtn = document.getElementById('sceneSendBtn');
  const sceneCreateBtn = document.getElementById('sceneCreateBtn');
  const scenePlanBtn = document.getElementById('scenePlanBtn');
  const sceneTypingEl = document.getElementById('sceneTyping');
  const layerContextEl = document.getElementById('layerContext');
  const layerChipEl = document.getElementById('layerChip');
  const layerContextClear = document.getElementById('layerContextClear');
  const sceneNewBtn = document.getElementById('sceneNewBtn');
  const sceneSaveBtn = document.getElementById('sceneSaveBtn');
  const sceneProjectListEl = document.getElementById('sceneProjectList');
  const sceneSaveStateEl = document.getElementById('sceneSaveState');
  const sceneExportSvg = document.getElementById('sceneExportSvg');
  const sceneAddText = document.getElementById('sceneAddText');
  const sceneAddCharacter = document.getElementById('sceneAddCharacter');
  const sceneRegenBtn = document.getElementById('sceneRegenBtn');
  const sceneRefineBtn = document.getElementById('sceneRefineBtn');
  const sceneGenAllBtn = document.getElementById('sceneGenAllBtn');
  const sceneRefineBtnSide = document.getElementById('sceneRefineBtnSide');
  const sceneGenAllBtnSide = document.getElementById('sceneGenAllBtnSide');

  const extractImportBtn = document.getElementById('extractImportBtn');
  const extractFileInput = document.getElementById('extractFileInput');
  const extractRunBtn = document.getElementById('extractRunBtn');
  const extractTitle = document.getElementById('extractTitle');
  const extractDownloadBtn = document.getElementById('extractDownloadBtn');
  const extractPreviewActions = document.getElementById('extractPreviewActions');
  const extractAnimateBtn = document.getElementById('extractAnimateBtn');

  const SCENE_PROJECT_ID_KEY = 'gdri-ms-scene-project-id';

  let conversationId = loadSimpleConversationId();
  let sceneConversationId = null;
  let sceneEditor = null;
  let extractEditor = null;
  let animateEditor = null;
  let clipEditor = null;
  let animateConversationId = null;
  let layerContextPinned = true;
  let currentProjectId = null;
  let sceneDirty = false;
  let sceneProjects = [];
  let suppressSceneDirty = false;

  const ANIMATION_CHAT_SYSTEM = `Tu es l'assistant animation Studio Média GDRI.
Convertis la demande en JSON UNIQUEMENT :
{"effects":[{"type":"glow|button|pulse|float|shake|rotate","target":"full|zones","zones":[{"x":0.1,"y":0.2,"w":0.15,"h":0.1}],"speed":1,"intensity":0.8,"depth":5,"amount":0.04}],"summary":"..."}
Zones x,y,w,h = fractions 0-1. glow=rune/lumière, button=pression, pulse, float, shake, rotate.`;

  const SCENE_SYSTEM = `Tu es l'assistant du Studio Média multi-calques GDRI (workflow en 3 étapes).
Quand on te demande un brouillon / plan de scène, réponds UNIQUEMENT avec un JSON SceneManifest :
{"version":1,"title":"...","canvas":{"width":1200,"height":630,"background":"#ffffff"},"layers":[...]}
Chaque calque image doit avoir : id, type:"image", title, description (courte en français), role ("background" ou "object"), zIndex, bbox, status:"brouillon".
NE PAS rédiger de prompt Flux à cette étape (pas de champ prompt, ou prompt vide).
Calque texte : type:"text", title, content, style, textPath, bbox.
bbox = emplacement exact en pixels sur le canvas ; respecter les proportions voulues (ex. drapeau 3:2, bannière fond = taille du canvas).
role background = fond plein (ciel, dégradé). role object = élément superposable (drapeau, logo, personnage).

ÉTAPE 2 — PROMPTS FLUX
Quand on te demande des prompts Flux pour un manifest, réponds UNIQUEMENT :
{"fluxPrompts":[{"id":"...","role":"background|object","prompt":"...","chromaColor":"#FF00FF"}]}
- role object : prompt = sujet seul (objet, matière, style). chromaColor = couleur de fond UNIE pour le détourage, ABSENTE du dessin.
  NE JAMAIS écrire dans prompt : fond chroma, fond uni, transparent background, green screen, couleur hex de fond — l'application injecte automatiquement le fond chroma à la génération.
  Choisis chromaColor selon les couleurs du sujet : drapeau bleu/blanc/rouge → #FF00FF magenta ; sujet vert → #FF00FF ; sujet orange → #00FFFF cyan.
  Ne jamais mettre chromaColor sur role background.
- role background : pas de chromaColor.

ÉTAPE 3 — génération : faite par l'application, pas par toi.

MODIFICATIONS FINES (calque actif fourni) — JSON uniquement :
{"layerPatch":{"id":"...","title":"...","content":"...","prompt":"...","style":{},"textPath":{"preset":"arcUp|arcDown|wave|circle|straight","strength":55},"bbox":{},"groupId":"..."}}
Cadre autour d'un texte :
{"layerPatch":{"id":"<id-texte>","groupId":"grp-1"},"addFrame":{"padding":18,"shape":"roundedRect","stroke":"#1a1a1a","strokeWidth":4,"fill":"transparent","effect":"shadow"}}
Ou {"addLayers":[{"type":"shape","title":"Cadre","groupId":"grp-1","zIndex":0,"bbox":{...},"style":{"shape":"roundedRect","stroke":"#1a1a1a","strokeWidth":4,"fill":"transparent","rx":16,"effect":"shadow|glow|none"}}]}
textPath.preset : straight, arcUp, arcDown, wave, circle (strength 0-100).
style texte : fontSize, fontWeight, color, align, fontId.

Règles : texte toujours en calque séparé. Cadre = type shape regroupé (groupId) sous le texte. Objets image : fond chroma puis détourage.`;

  const SIMPLE_CHAT_SYSTEM = `Tu es l'assistant du Studio Média GDRI (onglet Chat simple).

GÉNÉRATION D'IMAGES :
- Tu ne produis pas d'images toi-même. La génération est faite par Flux/ComfyUI via l'application.
- Si l'utilisateur demande une image, un dessin, une illustration, un coloriage, un logo, une affiche, etc., réponds UNIQUEMENT avec ce JSON (aucun texte avant ou après) :
{"generateImage":"<prompt en anglais, adapté à Flux Schnell>"}
- Le prompt doit rester FIDÈLE à la demande : précise le sujet, le style et le cadrage demandés.
- N'ajoute PAS de factions, personnages, objets ou scènes non demandés (ex. si on demande un Space Marine seul, ne pas inventer bataille, Necrons, Mechanicus, etc.).
- Tu peux clarifier en anglais (armure power armor, bolter, etc.) sans élargir le sujet.
- Pour une conversation normale (sans demande d'image), réponds en français de façon concise.
- Ne invente JAMAIS de placeholder du type [nom_image] ni de lien vers une image inexistante.`;

  const SIMPLE_CHAT_CTX_VERSION = '3';
  const SIMPLE_CHAT_CTX_KEY = 'gdri-ms-simple-chat';

  function loadSimpleConversationId() {
    try {
      const raw = sessionStorage.getItem(SIMPLE_CHAT_CTX_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.v === SIMPLE_CHAT_CTX_VERSION && parsed.id) return parsed.id;
    } catch (_) { /* ignore */ }
    return null;
  }

  function saveSimpleConversationId(id) {
    try {
      sessionStorage.setItem(SIMPLE_CHAT_CTX_KEY, JSON.stringify({ v: SIMPLE_CHAT_CTX_VERSION, id }));
    } catch (_) { /* ignore */ }
  }

  function tryParseImageGenerationRequest(reply) {
    const trimmed = String(reply || '').trim();
    if (!trimmed) return null;
    const tryJson = (raw) => {
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.generateImage === 'string' && obj.generateImage.trim()) {
          return obj.generateImage.trim();
        }
      } catch (_) { /* ignore */ }
      return null;
    };
    const direct = tryJson(trimmed);
    if (direct) return direct;
    const codeMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) {
      const fromBlock = tryJson(codeMatch[1].trim());
      if (fromBlock) return fromBlock;
    }
    const inline = trimmed.match(/\{[\s\S]*"generateImage"\s*:\s*"([^"]+)"[\s\S]*\}/);
    if (inline && inline[1]) return inline[1].trim();
    return null;
  }

  function looksLikeImageRequest(text) {
    return /\b(image|dessin|illustration|coloriage|logo|affiche|photo|portrait|génère|genere|générer|generer|crée|cree|créer|creer|dessine|dessiner|fais[- ]moi|faire un|fais un)\b/i.test(text);
  }

  function resolveApiBase() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('apiBase');
    if (fromQuery) return String(fromQuery).replace(/\/$/, '');
    try {
      if (window.parent !== window && window.parent.API_BASE_URL) {
        return String(window.parent.API_BASE_URL).replace(/\/$/, '');
      }
    } catch (_) { /* iframe cross-origin */ }
    if (window.API_BASE_URL) return String(window.API_BASE_URL).replace(/\/$/, '');
    return `${window.location.origin}/api`;
  }

  const API_BASE = resolveApiBase();

  function msApi(path) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}/media-studio${p}`;
  }

  function chatApi(path) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}/chat${p}`;
  }

  async function parseApiResponse(res) {
    const text = await res.text();
    if (!text) {
      throw new Error(`Réponse vide du serveur (HTTP ${res.status}). Redémarrez le backend Node si la route vient d'être ajoutée.`);
    }
    try {
      return JSON.parse(text);
    } catch (_) {
      const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 160);
      if (res.status === 413 || /request entity too large/i.test(snippet)) {
        throw new Error('Image trop volumineuse pour le serveur (max ~10 Mo). Réessayez avec une image plus petite.');
      }
      if (res.status === 404 || /^Cannot (GET|POST|PUT|DELETE)/i.test(snippet)) {
        throw new Error(`Route API introuvable (HTTP ${res.status}). Redémarrez le backend Node.js.`);
      }
      if (res.status === 502 && /proxy error|error reading from remote server/i.test(snippet)) {
        throw new Error(
          'Timeout ou coupure serveur pendant la génération IA (502). '
          + 'Redémarrez le backend Node.js et réessayez — le clip LTX peut prendre plusieurs minutes.'
        );
      }
      throw new Error(`Réponse serveur invalide (HTTP ${res.status}): ${snippet}`);
    }
  }

  function resolveImageUrl(data) {
    const filename = data.filename || String(data.url || '').split('/').pop();
    if (!filename) return '';
    if (data.url && /^https?:\/\//i.test(data.url)) return data.url;
    return msApi(`/media/${encodeURIComponent(filename)}`);
  }

  function resolveDownloadUrl(data) {
    const filename = data.filename || String(data.url || '').split('/').pop();
    if (!filename) return '#';
    return msApi(`/download/${encodeURIComponent(filename)}`);
  }

  function scrollBottom(el) {
    el.scrollTop = el.scrollHeight;
  }

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  function setSimpleBusy(busy, label) {
    sendBtn.disabled = busy;
    genBtn.disabled = busy;
    userInput.disabled = busy;
    typingEl.style.display = busy ? 'block' : 'none';
    if (label) typingEl.textContent = label;
  }

  function setSceneBusy(busy, label) {
    sceneSendBtn.disabled = busy;
    if (sceneCreateBtn) sceneCreateBtn.disabled = busy;
    if (sceneSaveBtn) sceneSaveBtn.disabled = busy;
    if (sceneNewBtn) sceneNewBtn.disabled = busy;
    if (scenePlanBtn) scenePlanBtn.disabled = busy;
    sceneInput.disabled = busy;
    if (sceneRefineBtn) sceneRefineBtn.disabled = busy;
    if (sceneGenAllBtn) sceneGenAllBtn.disabled = busy;
    if (sceneRefineBtnSide) sceneRefineBtnSide.disabled = busy;
    if (sceneGenAllBtnSide) sceneGenAllBtnSide.disabled = busy;
    if (sceneRegenBtn) {
      const sel = sceneEditor && sceneEditor.getSelectedLayer();
      const canRegen = sel && (sel.type === 'image' || sel.type === 'character');
      sceneRegenBtn.disabled = busy || !canRegen;
    }
    const propAiAsk = document.getElementById('propAiAsk');
    const propAiAskBtn = document.getElementById('propAiAskBtn');
    if (propAiAsk) propAiAsk.disabled = busy;
    if (propAiAskBtn) propAiAskBtn.disabled = busy;
    sceneTypingEl.style.display = busy ? 'block' : 'none';
    if (label) sceneTypingEl.textContent = label;
  }

  function addTextMessage(el, text, role) {
    const div = document.createElement('div');
    div.className = `ms-msg ${role}`;
    div.textContent = text;
    el.appendChild(div);
    scrollBottom(el);
    return div;
  }

  /** Carte de validation : l'utilisateur peut éditer le prompt Flux avant génération. */
  function showPromptValidation(targetEl, prompt, options = {}) {
    const initial = String(prompt || '').trim();
    if (!initial) return null;

    const div = document.createElement('div');
    div.className = 'ms-msg bot ms-prompt-review';

    const title = document.createElement('div');
    title.className = 'ms-prompt-review-title';
    title.textContent = options.title || 'Valider le prompt avant génération';

    const hint = document.createElement('div');
    hint.className = 'ms-prompt-review-hint';
    hint.textContent = options.hint
      || 'Modifiez le texte si besoin, puis validez. Rien n\'est envoyé à Flux tant que vous n\'avez pas confirmé.';

    const ta = document.createElement('textarea');
    ta.className = 'ms-prompt-review-input';
    ta.rows = 4;
    ta.value = initial;
    ta.setAttribute('aria-label', 'Prompt Flux à valider');

    const actions = document.createElement('div');
    actions.className = 'ms-prompt-review-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ms-btn ms-btn-ghost';
    cancelBtn.textContent = 'Annuler';

    const genBtnLocal = document.createElement('button');
    genBtnLocal.type = 'button';
    genBtnLocal.className = 'ms-btn ms-btn-primary';
    genBtnLocal.textContent = 'Valider et générer';

    actions.appendChild(cancelBtn);
    actions.appendChild(genBtnLocal);
    div.appendChild(title);
    div.appendChild(hint);
    div.appendChild(ta);
    div.appendChild(actions);
    targetEl.appendChild(div);
    scrollBottom(targetEl);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    const lock = (busy) => {
      cancelBtn.disabled = busy;
      genBtnLocal.disabled = busy;
      ta.disabled = busy;
    };

    cancelBtn.addEventListener('click', () => {
      div.remove();
      setStatus('Génération annulée.');
    });

    genBtnLocal.addEventListener('click', async () => {
      const finalPrompt = ta.value.trim();
      if (!finalPrompt) {
        ta.focus();
        return;
      }
      lock(true);
      genBtnLocal.textContent = 'Génération…';
      setSimpleBusy(true, 'Génération Flux en cours…');
      try {
        const img = await generateImage(finalPrompt);
        div.remove();
        addImageMessage(img, targetEl, true);
        setStatus('Image générée.');
      } catch (e) {
        lock(false);
        genBtnLocal.textContent = 'Valider et générer';
        addTextMessage(targetEl, 'Erreur image: ' + e.message, 'bot');
      } finally {
        setSimpleBusy(false);
      }
    });

    return div;
  }

  function addImageMessage(data, targetEl, withGallery) {
    const div = document.createElement('div');
    div.className = 'ms-msg image-msg bot';
    const img = document.createElement('img');
    img.src = resolveImageUrl(data);
    img.alt = data.prompt || 'Image générée';
    img.onerror = () => { img.alt = 'Image non chargée'; };
    const cap = document.createElement('div');
    cap.style.fontSize = '0.85rem';
    cap.style.color = 'var(--ms-muted)';
    cap.style.marginBottom = '8px';
    cap.textContent = data.generation_prompt || data.prompt || '';
    const actions = document.createElement('div');
    actions.className = 'ms-img-actions';
    const dl = document.createElement('a');
    dl.href = resolveDownloadUrl(data);
    dl.className = 'ms-btn ms-btn-secondary';
    dl.textContent = 'Télécharger';
    dl.setAttribute('download', '');
    actions.appendChild(dl);
    div.appendChild(img);
    div.appendChild(cap);
    div.appendChild(actions);
    targetEl.appendChild(div);
    scrollBottom(targetEl);
    if (withGallery) addGalleryThumb(data);
  }

  function generationId(data) {
    if (!data) return '';
    if (data.id != null && data.id !== '') return String(data.id);
    const raw = data._id;
    if (raw == null || raw === '') return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw.$oid) return String(raw.$oid);
    return String(raw);
  }

  function ensureGalleryEmptyState() {
    if (!galleryEl) return;
    const thumbs = galleryEl.querySelectorAll('.ms-thumb');
    if (thumbs.length === 0 && !galleryEl.querySelector('.ms-empty')) {
      const empty = document.createElement('div');
      empty.className = 'ms-empty';
      empty.textContent = 'Vos images apparaîtront ici';
      galleryEl.appendChild(empty);
    }
    updateGallerySelectionUI();
  }

  function getGalleryThumbs() {
    return galleryEl ? Array.from(galleryEl.querySelectorAll('.ms-thumb[data-id]')) : [];
  }

  function getSelectedGalleryIds() {
    return getGalleryThumbs()
      .filter((thumb) => thumb.classList.contains('is-selected'))
      .map((thumb) => thumb.dataset.id)
      .filter(Boolean);
  }

  function updateGallerySelectionUI() {
    const thumbs = getGalleryThumbs();
    const selected = getSelectedGalleryIds();
    const count = selected.length;
    const allSelected = thumbs.length > 0 && count === thumbs.length;

    if (gallerySelectionInfo) {
      gallerySelectionInfo.hidden = count === 0;
      gallerySelectionInfo.textContent = count === 0
        ? '0 sélectionnée(s)'
        : `${count} sélectionnée(s)`;
    }
    if (galleryDeleteSelectedBtn) {
      galleryDeleteSelectedBtn.disabled = count === 0;
      galleryDeleteSelectedBtn.textContent = count > 0 ? `Supprimer (${count})` : 'Supprimer';
    }
    if (gallerySelectAllBtn) {
      gallerySelectAllBtn.disabled = thumbs.length === 0;
      gallerySelectAllBtn.textContent = allSelected ? 'Aucun' : 'Tout';
      gallerySelectAllBtn.title = allSelected ? 'Tout désélectionner' : 'Tout sélectionner';
    }
  }

  function setThumbSelected(thumb, selected) {
    if (!thumb || !thumb.dataset.id) return;
    thumb.classList.toggle('is-selected', !!selected);
    thumb.setAttribute('aria-selected', selected ? 'true' : 'false');
  }

  function toggleThumbSelected(thumb) {
    if (!thumb || !thumb.dataset.id) return;
    setThumbSelected(thumb, !thumb.classList.contains('is-selected'));
    updateGallerySelectionUI();
  }

  function selectAllGalleryThumbs(select) {
    getGalleryThumbs().forEach((thumb) => setThumbSelected(thumb, select));
    updateGallerySelectionUI();
  }

  async function deleteGeneration(id) {
    const res = await fetch(msApi(`/generations/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await parseApiResponse(res);
    if (!data.success) throw new Error(data.message || 'Suppression impossible.');
    return data.data;
  }

  async function deleteGenerationsBulk(ids) {
    const res = await fetch(msApi('/generations/delete'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await parseApiResponse(res);
    if (!data.success) throw new Error(data.message || 'Suppression impossible.');
    return data.data;
  }

  function removeGalleryThumbsByIds(ids) {
    const idSet = new Set((ids || []).map(String));
    getGalleryThumbs().forEach((thumb) => {
      if (idSet.has(String(thumb.dataset.id))) thumb.remove();
    });
    ensureGalleryEmptyState();
  }

  function removeAssetEverywhere(refs) {
    const list = Array.isArray(refs) ? refs : [refs];
    list.forEach((ref) => {
      if (!ref) return;
      if (extractEditor && extractEditor.removeSavedItem) extractEditor.removeSavedItem(ref);
      if (animateEditor && animateEditor.removeAssetItem) animateEditor.removeAssetItem(ref);
      if (ref.id) removeGalleryThumbsByIds([ref.id]);
    });
    const previewActions = document.getElementById('extractPreviewActions');
    if (previewActions && extractEditor && !extractEditor.result) {
      previewActions.hidden = true;
    }
  }

  async function deletePersistedAssets(refs) {
    const list = (Array.isArray(refs) ? refs : [refs]).filter(Boolean);
    const withId = list.filter((r) => r.id);
    const withoutId = list.filter((r) => !r.id && r.filename);
    if (withId.length) {
      const result = await deleteGenerationsBulk(withId.map((r) => r.id));
      const deletedIds = new Set(((result && result.deleted) || withId.map((r) => r.id)).map(String));
      removeAssetEverywhere(withId.filter((r) => deletedIds.has(String(r.id))));
    }
    if (withoutId.length) {
      removeAssetEverywhere(withoutId);
    }
    return list.length;
  }

  function bindListSelectionControls(options) {
    const {
      selectAllBtn,
      deleteBtn,
      getSelected,
      getTotal,
      selectAll,
      confirmLabel,
    } = options;
    const sync = (selected, total) => {
      const count = (selected || []).length;
      const allSelected = total > 0 && count === total;
      if (deleteBtn) {
        deleteBtn.disabled = count === 0;
        deleteBtn.textContent = count > 0 ? `Supprimer (${count})` : 'Supprimer';
      }
      if (selectAllBtn) {
        selectAllBtn.disabled = total === 0;
        selectAllBtn.textContent = allSelected ? 'Aucun' : 'Tout';
        selectAllBtn.title = allSelected ? 'Tout désélectionner' : 'Tout sélectionner';
      }
    };
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        const total = getTotal();
        if (!total) return;
        const selected = getSelected();
        selectAll(!(selected.length === total));
      });
    }
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const selected = getSelected();
        if (!selected.length) return;
        const label = typeof confirmLabel === 'function'
          ? confirmLabel(selected.length)
          : `Supprimer ${selected.length} élément(s) ?`;
        if (!confirm(label)) return;
        deleteBtn.disabled = true;
        if (selectAllBtn) selectAllBtn.disabled = true;
        setStatus(`Suppression de ${selected.length} élément(s)…`);
        try {
          await deletePersistedAssets(selected);
          setStatus(`${selected.length} élément(s) supprimé(s).`);
        } catch (err) {
          setStatus('Suppression: ' + err.message);
          sync(getSelected(), getTotal());
        }
      });
    }
    return sync;
  }

  function addGalleryThumb(data) {
    const empty = galleryEl.querySelector('.ms-empty');
    if (empty) empty.remove();
    const id = generationId(data);
    const thumb = document.createElement('div');
    thumb.className = 'ms-thumb';
    thumb.title = data.prompt || data.title || '';
    thumb.setAttribute('role', 'option');
    thumb.setAttribute('aria-selected', 'false');
    if (id) thumb.dataset.id = id;
    const img = document.createElement('img');
    img.src = resolveImageUrl(data);
    img.alt = data.prompt || data.title || '';
    img.loading = 'lazy';
    img.onerror = () => { thumb.classList.add('ms-thumb--error'); };
    thumb.appendChild(img);
    if (id) {
      const check = document.createElement('span');
      check.className = 'ms-thumb-check';
      check.setAttribute('aria-hidden', 'true');
      thumb.appendChild(check);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'ms-thumb-delete';
      delBtn.title = 'Supprimer';
      delBtn.setAttribute('aria-label', 'Supprimer cette création');
      delBtn.textContent = '×';
      delBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Supprimer cette création ?')) return;
        delBtn.disabled = true;
        try {
          await deleteGeneration(id);
          thumb.remove();
          ensureGalleryEmptyState();
          setStatus('Création supprimée.');
        } catch (err) {
          delBtn.disabled = false;
          setStatus('Suppression: ' + err.message);
        }
      });
      thumb.appendChild(delBtn);

      thumb.addEventListener('click', (e) => {
        if (e.target.closest('.ms-thumb-delete')) return;
        toggleThumbSelected(thumb);
      });
    }
    galleryEl.prepend(thumb);
    updateGallerySelectionUI();
  }

  function initGallerySelection() {
    if (gallerySelectAllBtn) {
      gallerySelectAllBtn.addEventListener('click', () => {
        const thumbs = getGalleryThumbs();
        if (!thumbs.length) return;
        const allSelected = thumbs.every((t) => t.classList.contains('is-selected'));
        selectAllGalleryThumbs(!allSelected);
      });
    }
    if (galleryDeleteSelectedBtn) {
      galleryDeleteSelectedBtn.addEventListener('click', async () => {
        const ids = getSelectedGalleryIds();
        if (!ids.length) return;
        const label = ids.length === 1
          ? 'Supprimer cette création ?'
          : `Supprimer les ${ids.length} créations sélectionnées ?`;
        if (!confirm(label)) return;
        galleryDeleteSelectedBtn.disabled = true;
        gallerySelectAllBtn && (gallerySelectAllBtn.disabled = true);
        setStatus(`Suppression de ${ids.length} création(s)…`);
        try {
          const result = await deleteGenerationsBulk(ids);
          const deleted = (result && result.deleted) || ids;
          removeGalleryThumbsByIds(deleted);
          setStatus(`${(result && result.deletedCount) || deleted.length} création(s) supprimée(s).`);
        } catch (err) {
          setStatus('Suppression: ' + err.message);
          updateGallerySelectionUI();
        }
      });
    }
    updateGallerySelectionUI();
  }

  async function ensureConversation(context) {
    const res = await fetch(chatApi('/conversations'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    });
    const data = await parseApiResponse(res);
    if (!data.success) throw new Error(data.message || 'Impossible de créer la conversation.');
    return data.data._id;
  }

  async function sendChat(convId, message) {
    const res = await fetch(chatApi(`/conversations/${convId}/messages`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, memory_size: 30 }),
    });
    const data = await parseApiResponse(res);
    if (!data.success) throw new Error(data.message || 'Erreur chat');
    return data.data.response;
  }

  function estimateDataUrlBytes(dataUrl) {
    const i = String(dataUrl).indexOf(',');
    if (i < 0) return 0;
    return Math.ceil((dataUrl.length - i - 1) * 3 / 4);
  }

  function resizeDataUrl(dataUrl, maxDim) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(w, h, 1));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Image illisible'));
      img.src = dataUrl;
    });
  }

  async function fileToPngDataUrl(file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Lecture fichier impossible'));
      reader.readAsDataURL(file);
    });
    if (String(file.type).toLowerCase() === 'image/png') return dataUrl;
    return resizeDataUrl(dataUrl, 8192);
  }

  async function prepareImportDataUrl(file, maxBytes = 7 * 1024 * 1024) {
    let dataUrl = await fileToPngDataUrl(file);
    let maxDim = 4096;
    while (maxDim >= 640) {
      dataUrl = await resizeDataUrl(dataUrl, maxDim);
      if (estimateDataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
      maxDim = Math.round(maxDim * 0.72);
    }
    throw new Error('Image trop volumineuse même après réduction.');
  }

  async function uploadReferenceImage(file) {
    const dataUrl = await fileToPngDataUrl(file);
    const res = await fetch(msApi('/upload-reference'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, filename: file.name }),
    });
    const data = await parseApiResponse(res);
    if (!data.success) throw new Error(data.message || 'Upload référence échoué');
    return data.data;
  }

  async function uploadImportImage(file) {
    const dataUrl = await prepareImportDataUrl(file);
    const res = await fetch(msApi('/upload-import'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, filename: file.name }),
    });
    const data = await parseApiResponse(res);
    if (!data.success) throw new Error(data.message || 'Import échoué');
    return data.data;
  }

  async function extractObjectFromCrop(sourceFilename, crop, title) {
    const res = await fetch(msApi('/extract-object'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFilename, crop, title }),
    });
    const data = await parseApiResponse(res);
    if (!data.success) throw new Error(data.message || 'Extraction échouée');
    return data.data;
  }

  async function generateImage(prompt, options = {}) {
    const res = await fetch(msApi('/generate'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: MODEL,
        width: options.width,
        height: options.height,
        seed: options.seed,
        transparent: options.transparent === true,
        layer: options.layer === true,
        character: options.character === true,
        orientation: options.orientation || null,
        referenceFilename: options.referenceFilename || null,
        chromaColor: options.chromaColor || null,
        layerId: options.layerId,
        layerTitle: options.layerTitle,
        layerDescription: options.layerDescription,
      }),
    });
    const data = await parseApiResponse(res);
    if (!data.success) throw new Error(data.message || 'Erreur génération');
    return data.data;
  }

  function buildLayerContextMessage(userText, layer) {
    if (!layer) return userText;
    const bbox = layer.bbox;
    const header = [
      '[CALQUE ACTIF]',
      `id: ${layer.id}`,
      `type: ${layer.type}`,
      `bbox: x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}`,
    ];
    if (layer.groupId) header.push(`groupId: ${layer.groupId}`);
    if (layer.type === 'text') {
      header.push(`content: ${layer.content}`);
      header.push(`style: ${JSON.stringify(layer.style)}`);
      header.push(`textPath: ${JSON.stringify(layer.textPath || { preset: 'straight', strength: 55 })}`);
      header.push('Actions possibles: textPath (arcUp/arcDown/wave/circle), style, addFrame (cadre regroupé), content.');
    } else if (layer.type === 'shape') {
      header.push(`style shape: ${JSON.stringify(layer.style)}`);
      header.push('Actions possibles: style.shape/stroke/strokeWidth/fill/rx/effect (none|shadow|glow).');
    } else if (layer.type === 'character') {
      header.push(`prompt personnage: ${layer.prompt}`);
      if (layer.orientation) header.push(`orientation: ${JSON.stringify(layer.orientation)}`);
      if (layer.referenceImage) header.push(`reference: ${layer.referenceImage.filename}`);
      if (layer.asset) header.push(`asset: ${layer.asset.filename || 'oui'}`);
    } else {
      header.push(`prompt: ${layer.prompt}`);
      if (layer.asset) header.push(`asset: ${layer.asset.filename || 'oui'}`);
    }
    header.push('[/CALQUE ACTIF]');
    header.push('');
    header.push('Réponds UNIQUEMENT en JSON (layerPatch et/ou addFrame et/ou addLayers).');
    header.push(`Demande utilisateur: ${userText}`);
    return header.join('\n');
  }

  /** Modifications texte/cadre fréquentes sans attendre le LLM. */
  function tryLocalLayerEdit(layer, text) {
    const t = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!layer || !t) return null;

    if (layer.type === 'text') {
      if (/(courbe|courber|arc|suivre.*(chemin|courbe)|bandeau)/.test(t)) {
        let preset = 'arcUp';
        if (/bas|down|inverse/.test(t)) preset = 'arcDown';
        else if (/vague|wave|ondul/.test(t)) preset = 'wave';
        else if (/cercle|circle|rond/.test(t)) preset = 'circle';
        return { layerPatch: { id: layer.id, textPath: { preset, strength: 65 } }, summary: `Texte courbé (${preset}).` };
      }
      if (/(cadre|encadr|entoure|bordure|frame)/.test(t)) {
        const effect = /lueur|glow|brill/.test(t) ? 'glow' : 'shadow';
        const stroke = /or|dore|gold/.test(t) ? '#c9a227' : (/blanc|white/.test(t) ? '#ffffff' : '#1a1a1a');
        return {
          addFrame: {
            padding: 18,
            shape: 'roundedRect',
            stroke,
            strokeWidth: /epais|thick/.test(t) ? 7 : 4,
            fill: 'transparent',
            effect,
          },
          layerPatch: { id: layer.id },
          summary: 'Cadre ajouté et regroupé avec le texte.',
        };
      }
      if (/(plus grand|agrand|bigger|larger)/.test(t)) {
        const size = Math.min(200, (Number(layer.style?.fontSize) || 32) + 8);
        return { layerPatch: { id: layer.id, style: { fontSize: size } }, summary: `Taille ${size}px.` };
      }
      if (/(plus petit|reduire|smaller)/.test(t)) {
        const size = Math.max(8, (Number(layer.style?.fontSize) || 32) - 8);
        return { layerPatch: { id: layer.id, style: { fontSize: size } }, summary: `Taille ${size}px.` };
      }
      const colorHit = t.match(/(?:couleur|color|texte)\s+(rouge|bleu|vert|blanc|noir|or|red|blue|green|white|black|gold)\b/);
      if (colorHit) {
        const colorMap = {
          rouge: '#c0392b', red: '#c0392b', bleu: '#2980b9', blue: '#2980b9',
          vert: '#27ae60', green: '#27ae60', blanc: '#ffffff', white: '#ffffff',
          noir: '#1a1a1a', black: '#1a1a1a', or: '#c9a227', gold: '#c9a227',
        };
        const hex = colorMap[colorHit[1]];
        if (hex) {
          return { layerPatch: { id: layer.id, style: { color: hex } }, summary: `Couleur ${hex}.` };
        }
      }
    }

    if (layer.type === 'shape') {
      if (/(lueur|glow|brill)/.test(t)) {
        return { layerPatch: { id: layer.id, style: { effect: 'glow' } }, summary: 'Effet lueur.' };
      }
      if (/(ombre|shadow)/.test(t)) {
        return { layerPatch: { id: layer.id, style: { effect: 'shadow' } }, summary: 'Effet ombre.' };
      }
      if (/(rond|arrondi|coin)/.test(t)) {
        const rx = Math.min(80, (Number(layer.style?.rx) || 16) + 12);
        return { layerPatch: { id: layer.id, style: { shape: 'roundedRect', rx } }, summary: `Arrondi ${rx}px.` };
      }
      if (/(epais|thick|bordure)/.test(t)) {
        const strokeWidth = Math.min(24, (Number(layer.style?.strokeWidth) || 4) + 2);
        return { layerPatch: { id: layer.id, style: { strokeWidth } }, summary: `Contour ${strokeWidth}px.` };
      }
    }

    return null;
  }

  function applyLayerEditResult(parsed, targetLayer) {
    if (!parsed || !sceneEditor) return false;
    let ok = false;
    if (parsed.layerPatch && parsed.layerPatch.id) {
      ok = sceneEditor.applyLayerPatch(parsed.layerPatch.id, parsed.layerPatch) || ok;
    } else if (parsed.layerPatch && targetLayer) {
      ok = sceneEditor.applyLayerPatch(targetLayer.id, parsed.layerPatch) || ok;
    }
    if (parsed.addFrame && targetLayer) {
      const frame = sceneEditor.addFrameAroundLayer(targetLayer, parsed.addFrame);
      ok = !!frame || ok;
    }
    if (Array.isArray(parsed.addLayers) && parsed.addLayers.length) {
      // Lier au calque cible si groupId manquant
      const groupId = targetLayer?.groupId
        || parsed.layerPatch?.groupId
        || parsed.addLayers.find((l) => l.groupId)?.groupId
        || `grp-${Date.now().toString(36)}`;
      if (targetLayer && !targetLayer.groupId) {
        sceneEditor.applyLayerPatch(targetLayer.id, { groupId });
      }
      const layers = parsed.addLayers.map((l) => ({
        ...l,
        groupId: l.groupId || groupId,
        zIndex: l.zIndex != null ? l.zIndex : Math.max(0, (targetLayer?.zIndex || 1) - 1),
      }));
      ok = sceneEditor.addLayers(layers) > 0 || ok;
    }
    return ok;
  }

  function updateSceneCoach(layer) {
    const coach = document.getElementById('sceneCoach');
    if (!coach) return;
    if (!layer) {
      coach.textContent = 'Cliquez un élément pour le modifier à droite · glissez pour le déplacer';
      coach.classList.remove('is-active');
      return;
    }
    const title = MediaStudioScene.getLayerTitle(layer);
    coach.textContent = `Sélection : « ${title} » — modifiez à droite, ou glissez sur le canevas`;
    coach.classList.add('is-active');
  }

  function updateLayerContextUI(layer) {
    // Le bas sert uniquement à créer ; le contexte d'édition est à droite.
    if (layerContextEl) layerContextEl.hidden = true;
    if (sceneInput) sceneInput.placeholder = 'Décrivez la scène à créer…';
    updateSceneCoach(layerContextPinned ? layer : null);
  }

  function applySceneAiResponse(response, options = {}) {
    const parsed = MediaStudioScene.parseJsonFromText(response);
    if (!parsed) return false;
    const silent = options.silent === true;

    if (parsed.version === 1 && Array.isArray(parsed.layers)) {
      sceneEditor.setManifest(parsed);
      if (options.brouillonOnly) {
        sceneEditor.manifest.layers.forEach((l) => {
          if (l.type === 'image') {
            l.prompt = '';
            l.status = 'brouillon';
          }
        });
        sceneEditor.render();
        sceneEditor.persist();
      }
      const n = sceneEditor.manifest.layers.length;
      if (!silent) {
        addTextMessage(
          sceneMessagesEl,
          `Scène « ${sceneEditor.manifest.title} » — ${n} élément(s). Vous pouvez les déplacer.`,
          'bot'
        );
      }
      return true;
    }

    if (Array.isArray(parsed.fluxPrompts) && parsed.fluxPrompts.length) {
      const n = sceneEditor.applyFluxPrompts(parsed.fluxPrompts);
      if (n > 0) {
        if (!silent) {
          addTextMessage(sceneMessagesEl, `${n} élément(s) prêts à générer.`, 'bot');
        }
        return true;
      }
    }

    if (parsed.layerPatch || parsed.addFrame || Array.isArray(parsed.addLayers)) {
      const target = parsed.layerPatch?.id
        ? sceneEditor.manifest.layers.find((l) => l.id === parsed.layerPatch.id)
        : sceneEditor.getSelectedLayer();
      const ok = applyLayerEditResult(parsed, target);
      if (ok) {
        const label = target ? MediaStudioScene.getLayerTitle(target) : 'Élément';
        if (!silent) {
          addTextMessage(sceneMessagesEl, `« ${label} » mis à jour.`, 'bot');
        }
        updateLayerContextUI(sceneEditor.getSelectedLayer());
        return true;
      }
    }

    return false;
  }

  function isBackgroundLayer(layer) {
    return layer.role === 'background';
  }

  async function regenerateLayer(layer, force = false, options = {}) {
    const manageBusy = options.manageBusy !== false;
    const quiet = options.quiet === true;
    if (sceneEditor) sceneEditor.flushPropsFromDom();
    // En génération en lot, utiliser le calque passé ; sinon le calque sélectionné.
    if (!options.usePassedLayer && sceneEditor) {
      layer = sceneEditor.getSelectedLayer() || layer;
    }
    const isCharacter = layer && layer.type === 'character';
    if (!layer || (layer.type !== 'image' && !isCharacter)) {
      if (force && !quiet) {
        addTextMessage(sceneMessagesEl, 'Sélectionnez une image ou un personnage à régénérer.', 'bot');
      }
      return false;
    }
    const prompt = String(layer.prompt || '').trim();
    const title = MediaStudioScene.getLayerTitle(layer);
    if (!prompt) {
      if (!quiet) {
        addTextMessage(sceneMessagesEl, isCharacter
          ? `« ${title} » : décrivez l'apparence dans Propriétés.`
          : `« ${title} » n'est pas encore prêt — recréez la scène ou régénérez les images.`, 'bot');
      }
      return false;
    }
    if (!force && layer.asset && layer.asset.filename) return true;
    const size = sceneEditor.getGenerationSize(layer);
    const isBackground = !isCharacter && isBackgroundLayer(layer);
    const refNote = layer.referenceImage && layer.referenceImage.filename ? ' + photo réf.' : '';
    if (manageBusy) {
      setSceneBusy(true, `Génération « ${title} » (${size.width}×${size.height})…`);
    } else if (sceneTypingEl) {
      sceneTypingEl.textContent = `Génération « ${title} »…`;
    }
    if (!quiet) {
      addTextMessage(sceneMessagesEl, `Génération « ${title} »…${refNote}`, 'bot');
    }
    try {
      const img = await generateImage(prompt, {
        ...size,
        transparent: !isBackground,
        layer: !isBackground,
        character: isCharacter,
        orientation: isCharacter ? (layer.orientation || null) : null,
        referenceFilename: isCharacter && layer.referenceImage
          ? layer.referenceImage.filename
          : null,
        chromaColor: layer.chromaColor || null,
      });
      if (img.chroma_color) {
        layer.chromaColor = img.chroma_color;
        sceneEditor.persist();
        if (sceneEditor.getSelectedLayer()?.id === layer.id) {
          sceneEditor.renderProps();
        }
      }
      sceneEditor.setLayerAsset(layer.id, {
        filename: img.filename,
        url: img.url,
      }, {
        seed: img.seed,
        width: img.width,
        height: img.height,
        bboxWidth: layer.bbox.width,
        bboxHeight: layer.bbox.height,
        generatedAt: new Date().toISOString(),
      });
      if (!quiet) {
        addTextMessage(
          sceneMessagesEl,
          `« ${title} » généré${isBackground ? '' : ' (détouré)'}${img.used_reference ? ' · guidé par photo' : ''}.`,
          'bot'
        );
        addImageMessage(img, sceneMessagesEl, true);
      }
      setStatus(`« ${title} » prêt.`);
      return true;
    } catch (e) {
      addTextMessage(sceneMessagesEl, `Erreur « ${title} » : ${e.message}`, 'bot');
      return false;
    } finally {
      if (manageBusy) {
        setSceneBusy(false);
        updateLayerContextUI(sceneEditor.getSelectedLayer());
      }
    }
  }

  async function generateAllImageLayers(force = false, options = {}) {
    const manageBusy = options.manageBusy !== false;
    if (sceneEditor) sceneEditor.flushPropsFromDom();
    const layers = sceneEditor.manifest.layers.filter((l) => l.type === 'image' || l.type === 'character');
    const todo = layers.filter((l) => l.prompt && (force || !(l.asset && l.asset.filename)));
    if (!todo.length) {
      const needPrep = layers.some((l) => !String(l.prompt || '').trim());
      addTextMessage(
        sceneMessagesEl,
        needPrep
          ? 'Aucun élément prêt. Décrivez un visuel puis cliquez Créer la scène.'
          : 'Toutes les images sont déjà générées.',
        'bot'
      );
      return false;
    }
    if (manageBusy) setSceneBusy(true, `Génération de ${todo.length} image(s)…`);
    addTextMessage(sceneMessagesEl, `Génération de ${todo.length} image(s)…`, 'bot');
    let ok = 0;
    try {
      for (const layer of todo) {
        const done = await regenerateLayer(layer, true, {
          manageBusy: false,
          quiet: true,
          usePassedLayer: true,
        });
        if (done) ok += 1;
      }
      addTextMessage(sceneMessagesEl, `${ok}/${todo.length} image(s) générée(s).`, 'bot');
      setStatus(`${ok} image(s) prête(s).`);
      return ok > 0;
    } finally {
      if (manageBusy) {
        setSceneBusy(false);
        updateLayerContextUI(sceneEditor.getSelectedLayer());
      }
    }
  }

  async function handleRefinePrompts(options = {}) {
    const manageBusy = options.manageBusy !== false;
    const silent = options.silent === true;
    const imageLayers = sceneEditor.manifest.layers.filter((l) => l.type === 'image');
    if (!imageLayers.length) {
      if (!silent) {
        addTextMessage(sceneMessagesEl, 'Aucun élément image. Créez d\'abord une scène.', 'bot');
      }
      return false;
    }
    if (manageBusy) setSceneBusy(true, 'Préparation des images…');
    try {
      if (!sceneConversationId) {
        sceneConversationId = await ensureConversation(SCENE_SYSTEM);
      }
      const manifestSummary = JSON.stringify({
        title: sceneEditor.manifest.title,
        canvas: sceneEditor.manifest.canvas,
        layers: imageLayers.map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description,
          role: l.role,
          bbox: l.bbox,
        })),
      });
      const reply = await sendChat(sceneConversationId, `Étape 2 PROMPTS FLUX — rédige les prompts (SUJET SEUL, sans mention de fond/chroma/transparent) et chromaColor (#hex) pour chaque calque OBJET.
chromaColor = fond uni pour détourage, couleur absente du sujet. Drapeau FR → #FF00FF. Pas de chromaColor sur les fonds. Ne décris jamais le fond dans le prompt : le serveur l'ajoute seul.
${manifestSummary}`);
      const applied = applySceneAiResponse(reply, { silent });
      if (!applied && !silent) addTextMessage(sceneMessagesEl, reply, 'bot');
      if (applied) setStatus('Préparation terminée.');
      return applied;
    } catch (e) {
      addTextMessage(sceneMessagesEl, 'Erreur: ' + e.message, 'bot');
      return false;
    } finally {
      if (manageBusy) setSceneBusy(false);
    }
  }

  /** Pipeline unique : découpe → prompts → génération images. */
  async function handleCreateScene(textFromInput) {
    const text = String(textFromInput != null ? textFromInput : sceneInput.value).trim();
    if (!text) {
      addTextMessage(sceneMessagesEl, 'Décrivez d\'abord le visuel dans le champ ci-dessous.', 'bot');
      return;
    }
    if (textFromInput == null) sceneInput.value = '';

    layerContextPinned = false;
    updateLayerContextUI(null);
    addTextMessage(sceneMessagesEl, text, 'user');

    setSceneBusy(true, 'Création de la scène…');
    try {
      if (!sceneConversationId) {
        sceneConversationId = await ensureConversation(SCENE_SYSTEM);
      }

      const planReply = await sendChat(
        sceneConversationId,
        `Étape 1 BROUILLON — découpe en calques (JSON SceneManifest uniquement, sans prompts Flux) : ${text}`
      );
      const planned = applySceneAiResponse(planReply, { brouillonOnly: true, silent: true });
      if (!planned) {
        addTextMessage(sceneMessagesEl, planReply, 'bot');
        setStatus('Création incomplète.');
        return;
      }

      const n = sceneEditor.manifest.layers.length;
      addTextMessage(
        sceneMessagesEl,
        `Scène « ${sceneEditor.manifest.title} » — ${n} élément(s). Génération des images…`,
        'bot'
      );

      const refined = await handleRefinePrompts({ manageBusy: false, silent: true });
      if (!refined) {
        addTextMessage(
          sceneMessagesEl,
          'La découpe est prête, mais la préparation des images a échoué. Réessayez « Régénérer images ».',
          'bot'
        );
        return;
      }

      await generateAllImageLayers(true, { manageBusy: false });
      addTextMessage(
        sceneMessagesEl,
        'Scène prête. Déplacez les éléments, modifiez à droite, puis cliquez Sauvegarder pour la conserver.',
        'bot'
      );
      setStatus('Scène prête — pensez à sauvegarder.');
      markSceneDirty();
    } catch (e) {
      addTextMessage(sceneMessagesEl, 'Erreur: ' + e.message, 'bot');
    } finally {
      setSceneBusy(false);
      updateLayerContextUI(sceneEditor.getSelectedLayer());
    }
  }

  async function handleSceneSend() {
    // Zone du bas = création uniquement.
    await handleCreateScene();
  }

  /** Modification IA d'un élément — panneau droit uniquement. */
  async function handleLayerAiAsk(layer, text) {
    if (!layer || !String(text || '').trim()) return;
    const title = MediaStudioScene.getLayerTitle(layer);
    addTextMessage(sceneMessagesEl, `Modifier « ${title} » : ${text}`, 'user');

    if (sceneEditor.getSelectedLayer()?.id !== layer.id) {
      sceneEditor.selectLayer(layer.id, true);
    }

    // Raccourcis locaux (courbe, cadre, taille…) — immédiat.
    const local = tryLocalLayerEdit(layer, text);
    if (local) {
      const ok = applyLayerEditResult(local, layer);
      if (ok) {
        addTextMessage(sceneMessagesEl, local.summary || `« ${title} » mis à jour.`, 'bot');
        setStatus(local.summary || 'Élément mis à jour.');
        updateLayerContextUI(sceneEditor.getSelectedLayer());
        return;
      }
    }

    setSceneBusy(true, `Modification de « ${title} »…`);
    try {
      // Nouvelle conversation pour intégrer les consignes texte/cadre à jour.
      sceneConversationId = await ensureConversation(SCENE_SYSTEM);
      const reply = await sendChat(sceneConversationId, buildLayerContextMessage(text, layer));
      const applied = applySceneAiResponse(reply);
      if (!applied) addTextMessage(sceneMessagesEl, reply, 'bot');
      const updated = sceneEditor.manifest.layers.find((l) => l.id === layer.id) || sceneEditor.getSelectedLayer();
      if (
        applied
        && updated
        && (updated.type === 'image' || updated.type === 'character')
        && String(updated.prompt || '').trim()
      ) {
        await regenerateLayer(updated, true, { usePassedLayer: true, manageBusy: false });
      } else if (applied) {
        setStatus('Élément mis à jour.');
      }
    } catch (e) {
      addTextMessage(sceneMessagesEl, 'Erreur: ' + e.message, 'bot');
    } finally {
      setSceneBusy(false);
      updateLayerContextUI(sceneEditor.getSelectedLayer());
    }
  }

  function initTabs() {
    document.querySelectorAll('.ms-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.ms-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === name);
      t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false');
    });
    document.querySelectorAll('.ms-tab-panel').forEach((p) => {
      p.classList.toggle('active', p.dataset.panel === name);
    });
    if (name === 'animate' && animateEditor) {
      animateEditor.layoutCanvas();
    }
    if (name === 'clip' && clipEditor) {
      clipEditor.layoutCanvas();
    }
  }

  function openAnimationForAsset(data) {
    if (!animateEditor) {
      setStatus('Éditeur animation objets indisponible.');
      return;
    }
    animateEditor.addAssetItem(data);
    animateEditor.loadAsset(data);
    switchTab('animate');
  }

  function openClipForAsset(data) {
    if (!clipEditor) {
      setStatus('Éditeur clip hybride indisponible.');
      return;
    }
    clipEditor.addAssetItem(data);
    clipEditor.loadAsset(data);
    switchTab('clip');
  }

  function loadStoredProjectId() {
    try {
      return localStorage.getItem(SCENE_PROJECT_ID_KEY) || null;
    } catch (_) {
      return null;
    }
  }

  function setCurrentProjectId(id) {
    currentProjectId = id || null;
    try {
      if (currentProjectId) localStorage.setItem(SCENE_PROJECT_ID_KEY, currentProjectId);
      else localStorage.removeItem(SCENE_PROJECT_ID_KEY);
    } catch (_) { /* ignore */ }
    renderProjectList();
    updateSaveStateUI();
  }

  function markSceneDirty() {
    if (suppressSceneDirty) return;
    sceneDirty = true;
    updateSaveStateUI();
  }

  function updateSaveStateUI() {
    if (!sceneSaveStateEl) return;
    sceneSaveStateEl.classList.remove('is-dirty', 'is-saved');
    if (!currentProjectId) {
      sceneSaveStateEl.textContent = sceneDirty ? 'Non sauvegardée' : 'Nouvelle scène';
      if (sceneDirty) sceneSaveStateEl.classList.add('is-dirty');
      return;
    }
    if (sceneDirty) {
      sceneSaveStateEl.textContent = 'Modifications non sauvées';
      sceneSaveStateEl.classList.add('is-dirty');
    } else {
      sceneSaveStateEl.textContent = 'Sauvegardée';
      sceneSaveStateEl.classList.add('is-saved');
    }
  }

  function formatProjectDate(value) {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function renderProjectList() {
    if (!sceneProjectListEl) return;
    sceneProjectListEl.innerHTML = '';
    if (!sceneProjects.length) {
      const li = document.createElement('li');
      li.className = 'ms-project-empty';
      li.textContent = 'Aucune scène sauvegardée.';
      sceneProjectListEl.appendChild(li);
      return;
    }
    sceneProjects.forEach((project) => {
      const li = document.createElement('li');
      li.className = 'ms-project-item';
      if (project.id === currentProjectId) li.classList.add('active');
      const meta = [
        `${project.layerCount || 0} élém.`,
        formatProjectDate(project.updated_at),
      ].filter(Boolean).join(' · ');
      li.innerHTML = `
        <button type="button" class="ms-project-select" data-action="open" title="Ouvrir">
          <span class="ms-project-name"></span>
          <span class="ms-project-meta"></span>
        </button>
        <button type="button" class="ms-project-delete" data-action="delete" title="Supprimer">×</button>`;
      li.querySelector('.ms-project-name').textContent = project.title || 'Sans titre';
      li.querySelector('.ms-project-meta').textContent = meta;
      li.querySelector('[data-action="open"]').addEventListener('click', () => openSceneProject(project.id));
      li.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSceneProject(project.id, project.title);
      });
      sceneProjectListEl.appendChild(li);
    });
  }

  async function refreshProjectList() {
    try {
      const res = await fetch(msApi('/projects'), { credentials: 'include' });
      const data = await parseApiResponse(res);
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error(data.message || 'Liste des scènes indisponible.');
      }
      sceneProjects = data.data;
      renderProjectList();
    } catch (e) {
      setStatus('Scènes: ' + e.message);
    }
  }

  async function saveCurrentScene() {
    if (!sceneEditor) return;
    sceneEditor.flushPropsFromDom();
    const title = (document.getElementById('sceneTitle')?.value || sceneEditor.manifest.title || 'Sans titre').trim()
      || 'Sans titre';
    sceneEditor.manifest.title = title;
    if (document.getElementById('sceneTitle')) {
      document.getElementById('sceneTitle').value = title;
    }

    if (sceneSaveBtn) sceneSaveBtn.disabled = true;
    setStatus('Sauvegarde…');
    try {
      const payload = { title, manifest: sceneEditor.manifest, status: 'draft' };
      let res;
      if (currentProjectId) {
        res = await fetch(msApi(`/projects/${encodeURIComponent(currentProjectId)}`), {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(msApi('/projects'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const data = await parseApiResponse(res);
      if (!data.success || !data.data) {
        throw new Error(data.message || 'Échec de la sauvegarde.');
      }
      setCurrentProjectId(data.data.id);
      sceneDirty = false;
      updateSaveStateUI();
      await refreshProjectList();
      addTextMessage(sceneMessagesEl, `Scène « ${data.data.title} » sauvegardée.`, 'bot');
      setStatus('Scène sauvegardée.');
    } catch (e) {
      addTextMessage(sceneMessagesEl, 'Erreur sauvegarde: ' + e.message, 'bot');
      setStatus('Erreur sauvegarde.');
    } finally {
      if (sceneSaveBtn) sceneSaveBtn.disabled = false;
    }
  }

  async function openSceneProject(projectId) {
    if (!projectId || projectId === currentProjectId) return;
    if (sceneDirty && !confirm('Des modifications ne sont pas sauvegardées. Ouvrir quand même ?')) {
      return;
    }
    setStatus('Ouverture de la scène…');
    try {
      const res = await fetch(msApi(`/projects/${encodeURIComponent(projectId)}`), { credentials: 'include' });
      const data = await parseApiResponse(res);
      if (!data.success || !data.data || !data.data.manifest) {
        throw new Error(data.message || 'Scène introuvable.');
      }
      suppressSceneDirty = true;
      sceneEditor.setManifest(data.data.manifest);
      setCurrentProjectId(data.data.id);
      sceneDirty = false;
      suppressSceneDirty = false;
      updateSaveStateUI();
      updateLayerContextUI(null);
      addTextMessage(sceneMessagesEl, `Scène « ${data.data.title} » ouverte.`, 'bot');
      setStatus('Scène ouverte.');
    } catch (e) {
      suppressSceneDirty = false;
      addTextMessage(sceneMessagesEl, 'Erreur ouverture: ' + e.message, 'bot');
      setStatus('Erreur ouverture.');
    }
  }

  async function deleteSceneProject(projectId, title) {
    if (!projectId) return;
    const label = title || 'cette scène';
    if (!confirm(`Supprimer « ${label} » ?`)) return;
    try {
      const res = await fetch(msApi(`/projects/${encodeURIComponent(projectId)}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await parseApiResponse(res);
      if (!data.success) throw new Error(data.message || 'Suppression impossible.');
      if (currentProjectId === projectId) {
        suppressSceneDirty = true;
        sceneEditor.newProject();
        setCurrentProjectId(null);
        sceneDirty = false;
        suppressSceneDirty = false;
        updateSaveStateUI();
        updateLayerContextUI(null);
        addTextMessage(sceneMessagesEl, 'Scène supprimée. Nouvelle scène vide.', 'bot');
      } else {
        addTextMessage(sceneMessagesEl, `Scène « ${label} » supprimée.`, 'bot');
      }
      await refreshProjectList();
      setStatus('Scène supprimée.');
    } catch (e) {
      addTextMessage(sceneMessagesEl, 'Erreur suppression: ' + e.message, 'bot');
    }
  }

  function startNewScene(force = false) {
    if (!force && sceneDirty && !confirm('Nouvelle scène ? Les modifications non sauvegardées seront perdues.')) {
      return;
    }
    if (!force && !sceneDirty && sceneEditor.manifest.layers.length && !confirm('Nouvelle scène ? Remplacer le canevas actuel ?')) {
      return;
    }
    suppressSceneDirty = true;
    sceneEditor.newProject();
    setCurrentProjectId(null);
    sceneDirty = false;
    suppressSceneDirty = false;
    updateSaveStateUI();
    updateLayerContextUI(null);
    addTextMessage(sceneMessagesEl, 'Nouvelle scène. Décrivez un visuel puis cliquez Créer la scène, ou Sauvegarder.', 'bot');
    setStatus('Nouvelle scène.');
  }

  function initSceneEditor() {
    sceneEditor = new MediaStudioScene.SceneEditor({
      svgEl: document.getElementById('sceneSvg'),
      layerListEl: document.getElementById('layerList'),
      propsBodyEl: document.getElementById('scenePropsBody'),
      titleEl: document.getElementById('sceneTitle'),
      canvasSizeLabel: document.getElementById('canvasSizeLabel'),
      regenBtn: sceneRegenBtn,
      onLayerSelect: (layer) => {
        layerContextPinned = !!layer;
        updateLayerContextUI(layer);
      },
      onAskLayerAi: handleLayerAiAsk,
      onManifestChange: () => markSceneDirty(),
    });
    sceneEditor.onRegenerateLayer = regenerateLayer;
    sceneEditor.onUploadReference = uploadReferenceImage;

    if (sceneRefineBtn) sceneRefineBtn.addEventListener('click', () => handleRefinePrompts());
    if (sceneRefineBtnSide) sceneRefineBtnSide.addEventListener('click', () => handleRefinePrompts());
    if (sceneGenAllBtn) sceneGenAllBtn.addEventListener('click', () => generateAllImageLayers(true));
    if (sceneGenAllBtnSide) sceneGenAllBtnSide.addEventListener('click', () => generateAllImageLayers(true));
    if (sceneCreateBtn) {
      sceneCreateBtn.addEventListener('click', () => handleCreateScene());
    }
    if (sceneSaveBtn) {
      sceneSaveBtn.addEventListener('click', () => saveCurrentScene());
    }
    if (sceneNewBtn) {
      sceneNewBtn.addEventListener('click', () => startNewScene());
    }

    const titleEl = document.getElementById('sceneTitle');
    if (titleEl) {
      titleEl.addEventListener('input', () => markSceneDirty());
    }

    sceneAddText.addEventListener('click', () => sceneEditor.addTextLayer());
    if (sceneAddCharacter) {
      sceneAddCharacter.addEventListener('click', () => sceneEditor.addCharacterLayer());
    }

    sceneExportSvg.addEventListener('click', () => {
      const svg = sceneEditor.exportSvgString((asset) => resolveImageUrl(asset));
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(sceneEditor.manifest.title || 'scene').replace(/\s+/g, '-')}.svg`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    currentProjectId = loadStoredProjectId();
    sceneDirty = false;
    updateSaveStateUI();
    updateSceneCoach(null);
    refreshProjectList().then(() => {
      if (currentProjectId && sceneProjects.some((p) => p.id === currentProjectId)) {
        // Brouillon local déjà chargé par SceneEditor ; on garde l'id actif.
        renderProjectList();
      } else if (currentProjectId) {
        setCurrentProjectId(null);
      }
    });
  }

  function initExtractEditor() {
    if (!global.MediaStudioExtract || !global.MediaStudioExtract.ExtractEditor) {
      console.warn('[media-studio] MediaStudioExtract indisponible');
      return;
    }

    async function handleExtractImportFile(file) {
      if (!file || !String(file.type || '').startsWith('image/')) {
        setStatus('Fichier image requis (PNG, JPEG, WebP).');
        return;
      }
      setStatus('Import en cours…');
      if (extractImportBtn) extractImportBtn.disabled = true;
      if (extractRunBtn) extractRunBtn.disabled = true;
      try {
        const data = await uploadImportImage(file);
        data.url = msApi(`/import/${encodeURIComponent(data.filename)}`);
        extractEditor.setSource(data);
        if (extractRunBtn) extractRunBtn.disabled = false;
        setStatus(`Image importée (${data.width}×${data.height}). Placez le cadre puis extrayez.`);
      } catch (e) {
        setStatus('Erreur import: ' + e.message);
      } finally {
        if (extractImportBtn) extractImportBtn.disabled = false;
      }
    }

    const cropInputs = {
      x: document.getElementById('extractCropX'),
      y: document.getElementById('extractCropY'),
      width: document.getElementById('extractCropW'),
      height: document.getElementById('extractCropH'),
    };

    const syncExtractSelection = bindListSelectionControls({
      selectAllBtn: document.getElementById('extractSelectAllBtn'),
      deleteBtn: document.getElementById('extractDeleteSelectedBtn'),
      getSelected: () => (extractEditor ? extractEditor.getSelectedAssets() : []),
      getTotal: () => (extractEditor ? extractEditor.getSavedItems().length : 0),
      selectAll: (select) => extractEditor && extractEditor.selectAllSaved(select),
      confirmLabel: (n) => (n === 1
        ? 'Supprimer cet objet extrait ?'
        : `Supprimer les ${n} objets extraits sélectionnés ?`),
    });

    extractEditor = new global.MediaStudioExtract.ExtractEditor({
      stageEl: document.getElementById('extractStage'),
      previewEl: document.getElementById('extractPreview'),
      savedListEl: document.getElementById('extractSavedList'),
      dropZoneEl: document.getElementById('extractMain'),
      cropInputs,
      onStatus: setStatus,
      onImportFile: handleExtractImportFile,
      onAnimateAsset: (data) => openAnimationForAsset(data),
      onDeleteAsset: async (ref) => {
        await deletePersistedAssets([ref]);
        setStatus('Objet extrait supprimé.');
      },
      onSelectionChange: syncExtractSelection,
    });
    syncExtractSelection([], 0);

    Object.values(cropInputs).forEach((el) => {
      if (!el) return;
      el.addEventListener('change', () => extractEditor.setCropFromInputs());
    });

    if (extractImportBtn && extractFileInput) {
      extractImportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        extractFileInput.click();
      });
      extractFileInput.addEventListener('change', async () => {
        const file = extractFileInput.files && extractFileInput.files[0];
        extractFileInput.value = '';
        if (!file) return;
        await handleExtractImportFile(file);
      });
    }

    if (extractRunBtn) {
      extractRunBtn.addEventListener('click', async () => {
        if (!extractEditor.source) return;
        const crop = extractEditor.getCrop();
        if (!crop) return;
        extractRunBtn.disabled = true;
        setStatus('Détourage IA (rembg u2net)… 30 s à 2 min selon la zone');
        try {
          const title = (extractTitle && extractTitle.value.trim()) || 'Objet extrait';
          const data = await extractObjectFromCrop(extractEditor.source.filename, crop, title);
          data.url = resolveImageUrl(data);
          data.downloadUrl = resolveDownloadUrl(data);
          extractEditor.setResult(data);
          if (animateEditor) animateEditor.addAssetItem(data);
          if (extractDownloadBtn) {
            extractDownloadBtn.href = resolveDownloadUrl(data);
            extractDownloadBtn.setAttribute('download', data.filename);
          }
          if (extractPreviewActions) extractPreviewActions.hidden = false;
          setStatus(`Objet enregistré (${data.width}×${data.height}, fond ${data.background_mode}).`);
        } catch (e) {
          setStatus('Erreur extraction: ' + e.message);
        } finally {
          extractRunBtn.disabled = false;
        }
      });
    }

    if (extractAnimateBtn) {
      extractAnimateBtn.addEventListener('click', () => {
        if (!extractEditor || !extractEditor.result) return;
        openAnimationForAsset(extractEditor.result);
      });
    }
  }

  function initAnimateEditor() {
    if (!global.MediaStudioAnimate || !global.MediaStudioAnimate.AnimationEditor) {
      console.warn('[media-studio] MediaStudioAnimate indisponible');
      return;
    }

    async function requestAnimationLlm(layer, prompt, cadre) {
      if (!animateConversationId) {
        animateConversationId = await ensureConversation(ANIMATION_CHAT_SYSTEM);
      }
      const msg = [
        `Calque: ${layer.asset.title}`,
        `Taille image: ${layer.img.naturalWidth}×${layer.img.naturalHeight}px`,
        `Cadre: ${cadre.label} (${cadre.start}–${cadre.end}s)`,
        `Prompt: ${prompt}`,
      ].join('\n');
      return sendChat(animateConversationId, msg);
    }

    const stageEl = document.getElementById('animateStage');
    const syncAnimateSelection = bindListSelectionControls({
      selectAllBtn: document.getElementById('animateSelectAllBtn'),
      deleteBtn: document.getElementById('animateDeleteSelectedBtn'),
      getSelected: () => (animateEditor ? animateEditor.getSelectedAssets() : []),
      getTotal: () => (animateEditor ? animateEditor.getAssetItems().length : 0),
      selectAll: (select) => animateEditor && animateEditor.selectAllAssets(select),
      confirmLabel: (n) => (n === 1
        ? 'Supprimer cet objet ?'
        : `Supprimer les ${n} objets sélectionnés ?`),
    });

    animateEditor = new global.MediaStudioAnimate.AnimationEditor({
      workflow: 'objects',
      panelId: 'panel-animate',
      stageEl,
      zoneListEl: document.getElementById('animateZoneList'),
      layerListEl: document.getElementById('animateLayerList'),
      cadreListEl: document.getElementById('animateCadreList'),
      assetListEl: document.getElementById('animateAssetList'),
      toolGlowBtn: document.getElementById('animateToolGlow'),
      toolButtonBtn: document.getElementById('animateToolButton'),
      toolMoveBtn: document.getElementById('animateToolMove'),
      toolDeleteBtn: document.getElementById('animateToolDelete'),
      playBtn: document.getElementById('animatePlayBtn'),
      exportBtn: document.getElementById('animateExportBtn'),
      exportFormatSelect: document.getElementById('animateExportFormat'),
      durationInput: document.getElementById('animateDuration'),
      workspaceWInput: document.getElementById('animateWorkspaceW'),
      workspaceHInput: document.getElementById('animateWorkspaceH'),
      outputWInput: document.getElementById('animateOutputW'),
      outputHInput: document.getElementById('animateOutputH'),
      outputXInput: document.getElementById('animateOutputX'),
      outputYInput: document.getElementById('animateOutputY'),
      addCadreBtn: document.getElementById('animateAddCadreBtn'),
      splitCadresBtn: document.getElementById('animateSplitCadresBtn'),
      assignCadresBtn: document.getElementById('animateAssignCadresBtn'),
      promptPanelEl: document.getElementById('animatePromptPanel'),
      promptInputEl: document.getElementById('animatePromptInput'),
      promptLlmCheckEl: document.getElementById('animatePromptLlm'),
      promptGenerateBtn: document.getElementById('animatePromptGenerateBtn'),
      i2vGenerateBtn: document.getElementById('animateI2vGenerateBtn'),
      onDeleteAsset: async (ref) => {
        await deletePersistedAssets([ref]);
        setStatus('Objet supprimé.');
      },
      onSelectionChange: syncAnimateSelection,
      msApi,
      parseApiResponse,
      onGeneratePrompt: requestAnimationLlm,
      onStatus: setStatus,
    });
    syncAnimateSelection([], 0);

    const animateImportBtn = document.getElementById('animateImportBtn');
    const animateFileInput = document.getElementById('animateFileInput');
    if (animateImportBtn && animateFileInput) {
      animateImportBtn.addEventListener('click', () => animateFileInput.click());
      animateFileInput.addEventListener('change', async () => {
        const file = animateFileInput.files && animateFileInput.files[0];
        animateFileInput.value = '';
        if (!file) return;
        try {
          const dataUrl = await fileToPngDataUrl(file);
          const png = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => reject(new Error('Image illisible'));
            img.src = dataUrl;
          });
          const saved = await uploadImportImage(file);
          openAnimationForAsset({
            filename: saved.filename,
            url: msApi(`/import/${encodeURIComponent(saved.filename)}`),
            title: file.name.replace(/\.[^.]+$/, ''),
            width: png.width,
            height: png.height,
          });
        } catch (e) {
          setStatus('Import animation: ' + e.message);
        }
      });
    }
  }

  function initClipEditor() {
    if (!global.MediaStudioAnimate || !global.MediaStudioAnimate.AnimationEditor) return;

    clipEditor = new global.MediaStudioAnimate.AnimationEditor({
      workflow: 'clip',
      panelId: 'panel-clip',
      stageEl: document.getElementById('clipStage'),
      zoneListEl: document.getElementById('clipZoneList'),
      layerListEl: document.getElementById('clipLayerList'),
      cadreListEl: document.getElementById('clipCadreList'),
      assetListEl: document.getElementById('clipAssetList'),
      toolGlowBtn: document.getElementById('clipToolGlow'),
      toolButtonBtn: document.getElementById('clipToolButton'),
      toolMoveBtn: document.getElementById('clipToolMove'),
      toolDeleteBtn: document.getElementById('clipToolDelete'),
      playBtn: document.getElementById('clipPlayBtn'),
      exportBtn: document.getElementById('clipExportBtn'),
      exportFormatSelect: document.getElementById('clipExportFormat'),
      durationInput: document.getElementById('clipDuration'),
      workspaceWInput: document.getElementById('clipWorkspaceW'),
      workspaceHInput: document.getElementById('clipWorkspaceH'),
      outputWInput: document.getElementById('clipOutputW'),
      outputHInput: document.getElementById('clipOutputH'),
      outputXInput: document.getElementById('clipOutputX'),
      outputYInput: document.getElementById('clipOutputY'),
      addCadreBtn: document.getElementById('clipAddCadreBtn'),
      splitCadresBtn: document.getElementById('clipSplitCadresBtn'),
      assignCadresBtn: document.getElementById('clipAssignCadresBtn'),
      promptPanelEl: document.getElementById('clipPromptPanel'),
      promptInputEl: document.getElementById('clipPromptInput'),
      promptLlmCheckEl: document.getElementById('clipPromptLlm'),
      promptGenerateBtn: document.getElementById('clipPromptGenerateBtn'),
      i2vGenerateBtn: document.getElementById('clipI2vGenerateBtn'),
      addKeyframeBtn: document.getElementById('clipAddKeyframeBtn'),
      playheadInput: document.getElementById('clipPlayhead'),
      playheadLabel: document.getElementById('clipPlayheadLabel'),
      keyframeListEl: document.getElementById('clipKeyframeList'),
      msApi,
      parseApiResponse,
      onStatus: setStatus,
    });

    const clipCreateBtn = document.getElementById('clipCreateBtn');
    const clipCreatePrompt = document.getElementById('clipCreatePrompt');
    const clipCreateType = document.getElementById('clipCreateType');
    const clipCreateHint = document.getElementById('clipCreateHint');

    async function generateSubjectForClip() {
      const prompt = (clipCreatePrompt && clipCreatePrompt.value.trim()) || '';
      if (!prompt) {
        setStatus('Clip hybride : décrivez le sujet à générer.');
        return;
      }
      const isCharacter = !clipCreateType || clipCreateType.value === 'character';
      if (clipCreateBtn) clipCreateBtn.disabled = true;
      if (clipCreatePrompt) clipCreatePrompt.disabled = true;
      if (clipCreateType) clipCreateType.disabled = true;
      if (clipCreateHint) {
        clipCreateHint.textContent = isCharacter
          ? 'Génération personnage Flux + détourage…'
          : 'Génération objet Flux + détourage…';
      }
      setStatus('Clip hybride : génération du sujet…');
      try {
        const img = await generateImage(prompt, {
          transparent: true,
          layer: true,
          character: isCharacter,
          layerTitle: prompt.slice(0, 48),
        });
        addGalleryThumb(img);
        openClipForAsset({
          id: generationId(img),
          filename: img.filename,
          url: resolveImageUrl(img),
          downloadUrl: resolveDownloadUrl(img),
          title: (img.title || prompt).slice(0, 64),
          width: img.width,
          height: img.height,
        });
        if (clipCreateHint) clipCreateHint.textContent = 'Sujet prêt — keyframes, puis LTX optionnel.';
        setStatus(`Clip hybride : ${prompt.slice(0, 40)} prêt.`);
      } catch (e) {
        setStatus('Clip hybride: ' + e.message);
        if (clipCreateHint) clipCreateHint.textContent = 'Échec — vérifiez ComfyUI.';
      } finally {
        if (clipCreateBtn) clipCreateBtn.disabled = false;
        if (clipCreatePrompt) clipCreatePrompt.disabled = false;
        if (clipCreateType) clipCreateType.disabled = false;
      }
    }

    if (clipCreateBtn) clipCreateBtn.addEventListener('click', () => generateSubjectForClip());
    if (clipCreatePrompt) {
      clipCreatePrompt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          generateSubjectForClip();
        }
      });
    }
  }

  async function loadExtractedItems() {
    if (!extractEditor) return;
    try {
      const res = await fetch(msApi('/generations'), { credentials: 'include' });
      const data = await parseApiResponse(res);
      if (!data.success || !Array.isArray(data.data)) return;
      data.data
        .filter((item) => item.type === 'extract')
        .forEach((item) => {
          const asset = {
            id: item.id || (item._id != null ? String(item._id) : ''),
            filename: item.filename,
            url: item.url && /^https?:\/\//i.test(item.url)
              ? item.url
              : msApi(`/media/${encodeURIComponent(item.filename)}`),
            downloadUrl: msApi(`/download/${encodeURIComponent(item.filename)}`),
            title: item.title,
            width: item.width,
            height: item.height,
          };
          extractEditor.addSavedItem(asset);
          if (animateEditor) animateEditor.addAssetItem(asset);
        });
    } catch { /* ignore */ }
  }

  async function loadHealth() {
    try {
      const res = await fetch(msApi('/health'), { credentials: 'include' });
      const data = await parseApiResponse(res);
      if (!data.success) throw new Error(data.message);
      const comfy = data.data.comfyui;
      const flux = (data.data.models || []).find((m) => m.id === 'flux');
      const w = flux ? flux.width : 768;
      const h = flux ? flux.height : 768;
      if (modelHints) modelHints.textContent = `${w}×${h} · Flux Schnell · ComfyUI local`;
      const extract = data.data.extract;
      let statusParts = [];
      if (comfy.ok) {
        statusParts.push(`ComfyUI OK (${comfy.url})`);
      } else {
        statusParts.push('ComfyUI hors ligne');
      }
      if (extract && extract.rembg) {
        statusParts.push(extract.rembg.available
          ? `rembg OK (${extract.rembg.model})`
          : 'rembg absent — lancez Install-RemBG.ps1');
      }
      setStatus(statusParts.join(' · '));
    } catch {
      setStatus('Chargement…');
    }
  }

  async function loadGallery() {
    try {
      const res = await fetch(msApi('/generations'), { credentials: 'include' });
      const data = await parseApiResponse(res);
      if (!data.success || !Array.isArray(data.data)) return;
      data.data
        .filter((item) => !item.type || item.type === 'image')
        .forEach((item) => addGalleryThumb(item));
    } catch { /* ignore */ }
  }

  async function handleSimpleSend() {
    const text = userInput.value.trim();
    if (!text) return;
    userInput.value = '';
    addTextMessage(messagesEl, text, 'user');

    if (text.toLowerCase().startsWith('/image ') || text.toLowerCase().startsWith('/img ')) {
      const prompt = text.replace(/^\/(image|img)\s+/i, '').trim();
      if (!prompt) {
        addTextMessage(messagesEl, 'Usage: /image votre description', 'bot');
        return;
      }
      setSimpleBusy(true, 'Génération Flux en cours…');
      try {
        const img = await generateImage(prompt);
        addImageMessage(img, messagesEl, true);
        setStatus('Image générée.');
      } catch (e) {
        addTextMessage(messagesEl, 'Erreur image: ' + e.message, 'bot');
      } finally {
        setSimpleBusy(false);
      }
      return;
    }

    setSimpleBusy(true, 'L\'IA répond…');
    try {
      if (!conversationId) {
        conversationId = await ensureConversation(SIMPLE_CHAT_SYSTEM);
        saveSimpleConversationId(conversationId);
      }
      const reply = await sendChat(conversationId, text);
      const fluxPrompt = tryParseImageGenerationRequest(reply);

      if (fluxPrompt || looksLikeImageRequest(text)) {
        const prompt = fluxPrompt || text;
        addTextMessage(messagesEl, 'Génération Flux en cours…', 'bot');
        setSimpleBusy(true, 'Génération Flux en cours…');
        try {
          const img = await generateImage(prompt);
          addImageMessage(img, messagesEl, true);
          setStatus('Image générée.');
        } catch (e) {
          if (reply.trim() && !fluxPrompt) addTextMessage(messagesEl, reply, 'bot');
          addTextMessage(messagesEl, 'Erreur image: ' + e.message, 'bot');
        }
      } else {
        addTextMessage(messagesEl, reply, 'bot');
        setStatus('Réponse reçue.');
      }
    } catch (e) {
      addTextMessage(messagesEl, 'Erreur: ' + e.message, 'bot');
    } finally {
      setSimpleBusy(false);
    }
  }

  async function handleSimpleGenerate() {
    const text = userInput.value.trim();
    if (!text) {
      addTextMessage(messagesEl, 'Décrivez l\'image dans le champ de saisie, puis cliquez Générer.', 'bot');
      return;
    }
    addTextMessage(messagesEl, text, 'user');
    userInput.value = '';
    setSimpleBusy(true, 'Génération Flux en cours…');
    try {
      const img = await generateImage(text);
      addImageMessage(img, messagesEl, true);
      setStatus('Image générée.');
    } catch (e) {
      addTextMessage(messagesEl, 'Erreur image: ' + e.message, 'bot');
    } finally {
      setSimpleBusy(false);
    }
  }

  sendBtn.addEventListener('click', handleSimpleSend);
  genBtn.addEventListener('click', handleSimpleGenerate);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSimpleSend();
    }
  });

  if (sceneSendBtn) sceneSendBtn.addEventListener('click', () => handleCreateScene());
  sceneInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateScene();
    }
  });

  initTabs();
  initSceneEditor();
  initExtractEditor();
  initAnimateEditor();
  initClipEditor();
  initGallerySelection();
  loadHealth();
  loadGallery();
  loadExtractedItems();

  sceneEditor.selectLayer = ((orig) => function patched(id, notify) {
    orig.call(this, id, notify);
    layerContextPinned = true;
    updateLayerContextUI(this.getSelectedLayer());
  })(sceneEditor.selectLayer.bind(sceneEditor));

  sceneEditor.clearSelection = ((orig) => function patched(notify) {
    orig.call(this, notify);
    updateLayerContextUI(null);
  })(sceneEditor.clearSelection.bind(sceneEditor));
})(window);
