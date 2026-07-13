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

  const sceneMessagesEl = document.getElementById('sceneMessages');
  const sceneInput = document.getElementById('sceneInput');
  const sceneSendBtn = document.getElementById('sceneSendBtn');
  const scenePlanBtn = document.getElementById('scenePlanBtn');
  const sceneTypingEl = document.getElementById('sceneTyping');
  const layerContextEl = document.getElementById('layerContext');
  const layerChipEl = document.getElementById('layerChip');
  const layerContextClear = document.getElementById('layerContextClear');
  const sceneNewBtn = document.getElementById('sceneNewBtn');
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

  let conversationId = loadSimpleConversationId();
  let sceneConversationId = null;
  let sceneEditor = null;
  let extractEditor = null;
  let animateEditor = null;
  let animateConversationId = null;
  let layerContextPinned = true;

  const ANIMATION_CHAT_SYSTEM = `Tu es l'assistant animation Studio Média GDRI.
Convertis la demande en JSON UNIQUEMENT :
{"effects":[{"type":"glow|button|pulse|float|shake|rotate","target":"full|zones","zones":[{"x":0.1,"y":0.2,"w":0.15,"h":0.1}],"speed":1,"intensity":0.8,"depth":5,"amount":0.04}],"summary":"..."}
Zones x,y,w,h = fractions 0-1. glow=rune/lumière, button=pression, pulse, float, shake, rotate.`;

  const SCENE_SYSTEM = `Tu es l'assistant du Studio Média multi-calques GDRI (workflow en 3 étapes).
Quand on te demande un brouillon / plan de scène, réponds UNIQUEMENT avec un JSON SceneManifest :
{"version":1,"title":"...","canvas":{"width":1200,"height":630,"background":"#ffffff"},"layers":[...]}
Chaque calque image doit avoir : id, type:"image", title, description (courte en français), role ("background" ou "object"), zIndex, bbox, status:"brouillon".
NE PAS rédiger de prompt Flux à cette étape (pas de champ prompt, ou prompt vide).
Calque texte : type:"text", title, content, style, bbox.
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

MODIFICATIONS FINES (calque actif fourni) :
{"layerPatch":{"id":"...","title":"...","description":"...","role":"...","prompt":"...","content":"...","style":{},"bbox":{}}}

Règles : texte toujours en calque séparé. Les objets sont générés sur fond chroma uni puis détourés ; chromaColor ne doit pas apparaître dans le sujet.`;

  const SIMPLE_CHAT_SYSTEM = `Tu es l'assistant du Studio Média GDRI (onglet Chat simple).

GÉNÉRATION D'IMAGES :
- Tu ne produis pas d'images toi-même. La génération est faite par Flux/ComfyUI via l'application.
- Si l'utilisateur demande une image, un dessin, une illustration, un coloriage, un logo, une affiche, etc., réponds UNIQUEMENT avec ce JSON (aucun texte avant ou après) :
{"generateImage":"<prompt détaillé en anglais, adapté à Flux Schnell>"}
- Pour une conversation normale (sans demande d'image), réponds en français de façon concise.
- Ne invente JAMAIS de placeholder du type [nom_image] ni de lien vers une image inexistante.`;

  const SIMPLE_CHAT_CTX_VERSION = '2';
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
    scenePlanBtn.disabled = busy;
    sceneInput.disabled = busy;
    if (sceneRefineBtn) sceneRefineBtn.disabled = busy;
    if (sceneGenAllBtn) sceneGenAllBtn.disabled = busy;
    if (sceneRefineBtnSide) sceneRefineBtnSide.disabled = busy;
    if (sceneGenAllBtnSide) sceneGenAllBtnSide.disabled = busy;
    if (sceneRegenBtn) sceneRegenBtn.disabled = busy || !sceneEditor || !sceneEditor.getSelectedLayer() || sceneEditor.getSelectedLayer().type !== 'image';
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

  function addGalleryThumb(data) {
    const empty = galleryEl.querySelector('.ms-empty');
    if (empty) empty.remove();
    const thumb = document.createElement('div');
    thumb.className = 'ms-thumb';
    thumb.title = data.prompt || '';
    const img = document.createElement('img');
    img.src = resolveImageUrl(data);
    img.alt = data.prompt || '';
    img.loading = 'lazy';
    img.onerror = () => { thumb.classList.add('ms-thumb--error'); };
    thumb.appendChild(img);
    galleryEl.prepend(thumb);
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
    if (layer.type === 'text') {
      header.push(`content: ${layer.content}`);
      header.push(`style: ${JSON.stringify(layer.style)}`);
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
    header.push(`Demande utilisateur: ${userText}`);
    return header.join('\n');
  }

  function updateLayerContextUI(layer) {
    if (!layer || !layerContextPinned) {
      layerContextEl.hidden = true;
      return;
    }
    layerContextEl.hidden = false;
    const label = layer.type === 'text'
      ? `Texte — ${MediaStudioScene.getLayerTitle(layer).slice(0, 40)}`
      : `Image — ${MediaStudioScene.getLayerTitle(layer).slice(0, 40)}`;
    layerChipEl.textContent = label;
    layerChipEl.title = layer.id;
    sceneInput.placeholder = `Modifier « ${layer.id} » ou décrire le changement…`;
  }

  function applySceneAiResponse(response, options = {}) {
    const parsed = MediaStudioScene.parseJsonFromText(response);
    if (!parsed) return false;

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
      addTextMessage(sceneMessagesEl, `Brouillon « ${sceneEditor.manifest.title} » — ${n} calque(s). Ajustez les positions puis : 2. Prompts Flux.`, 'bot');
      return true;
    }

    if (Array.isArray(parsed.fluxPrompts) && parsed.fluxPrompts.length) {
      const n = sceneEditor.applyFluxPrompts(parsed.fluxPrompts);
      if (n > 0) {
        addTextMessage(sceneMessagesEl, `${n} prompt(s) Flux prêts. Vérifiez dans Propriétés puis : 3. Générer images.`, 'bot');
        return true;
      }
    }

    if (parsed.layerPatch && parsed.layerPatch.id) {
      const ok = sceneEditor.applyLayerPatch(parsed.layerPatch.id, parsed.layerPatch);
      if (ok) {
        addTextMessage(sceneMessagesEl, `Calque « ${parsed.layerPatch.id} » mis à jour.`, 'bot');
        updateLayerContextUI(sceneEditor.getSelectedLayer());
        return true;
      }
    }

    return false;
  }

  function isBackgroundLayer(layer) {
    return layer.role === 'background';
  }

  async function regenerateLayer(layer, force = false) {
    if (sceneEditor) sceneEditor.flushPropsFromDom();
    layer = layer && sceneEditor ? sceneEditor.getSelectedLayer() || layer : layer;
    const isCharacter = layer && layer.type === 'character';
    if (!layer || (layer.type !== 'image' && !isCharacter)) {
      if (force) {
        addTextMessage(sceneMessagesEl, 'Sélectionnez un calque image ou personnage à régénérer.', 'bot');
      }
      return;
    }
    const prompt = String(layer.prompt || '').trim();
    if (!prompt) {
      addTextMessage(sceneMessagesEl, isCharacter
        ? `Personnage « ${layer.id} » : décrivez l'apparence dans le prompt Flux.`
        : `Calque « ${layer.id} » : pas de prompt Flux. Lancez l'étape 2.`, 'bot');
      return;
    }
    if (!force && layer.asset && layer.asset.filename) return;
    const size = sceneEditor.getGenerationSize(layer);
    const isBackground = !isCharacter && isBackgroundLayer(layer);
    const refNote = layer.referenceImage && layer.referenceImage.filename ? ' + photo réf.' : '';
    setSceneBusy(true, isCharacter
      ? `Génération personnage Flux${refNote} (${size.width}×${size.height})…`
      : (isBackground
        ? `Génération Flux (${size.width}×${size.height})…`
        : `Génération Flux + détourage (${size.width}×${size.height})…`));
    addTextMessage(sceneMessagesEl, `Flux « ${layer.id} » — ${prompt.slice(0, 120)}${prompt.length > 120 ? '…' : ''}${refNote}`, 'bot');
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
      const chromaNote = img.chroma_color
        ? ` · détourage fond ${img.chroma_color}${img.chroma_detected_from_image ? ' (couleur détectée sur l\'image)' : ''}`
        : ' · ATTENTION: couleur chroma non transmise';
      if (img.generation_prompt) {
        addTextMessage(sceneMessagesEl, `ComfyUI (extrait) : ${img.generation_prompt.slice(0, 140)}…${chromaNote}`, 'bot');
      } else if (img.chroma_color) {
        addTextMessage(sceneMessagesEl, `Détourage appliqué — fond chroma ${img.chroma_color}`, 'bot');
      }
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
      addTextMessage(sceneMessagesEl, `Calque « ${layer.id} » généré${isBackground ? '' : ' (fond retiré)'}${img.used_reference ? ' · guidé par photo réf.' : ''}.`, 'bot');
      addImageMessage(img, sceneMessagesEl, true);
      setStatus('Calque régénéré (Flux).');
    } catch (e) {
      addTextMessage(sceneMessagesEl, 'Erreur génération: ' + e.message, 'bot');
    } finally {
      setSceneBusy(false);
      updateLayerContextUI(sceneEditor.getSelectedLayer());
    }
  }

  async function generateAllImageLayers(force = false) {
    if (sceneEditor) sceneEditor.flushPropsFromDom();
    const layers = sceneEditor.manifest.layers.filter((l) => l.type === 'image');
    const todo = layers.filter((l) => l.prompt && (force || !(l.asset && l.asset.filename)));
    if (!todo.length) {
      addTextMessage(sceneMessagesEl, 'Aucun calque image à générer. Étape 2 : Prompts Flux.', 'bot');
      return;
    }
    addTextMessage(sceneMessagesEl, `Génération Flux : ${todo.length} calque(s)…`, 'bot');
    for (const layer of todo) {
      await regenerateLayer(layer, true);
    }
  }

  async function handleRefinePrompts() {
    const imageLayers = sceneEditor.manifest.layers.filter((l) => l.type === 'image');
    if (!imageLayers.length) {
      addTextMessage(sceneMessagesEl, 'Aucun calque image. Commencez par l\'étape 1 (Brouillon).', 'bot');
      return;
    }
    setSceneBusy(true, 'Rédaction des prompts Flux…');
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
      const applied = applySceneAiResponse(reply);
      if (!applied) addTextMessage(sceneMessagesEl, reply, 'bot');
      setStatus('Prompts Flux prêts.');
    } catch (e) {
      addTextMessage(sceneMessagesEl, 'Erreur: ' + e.message, 'bot');
    } finally {
      setSceneBusy(false);
    }
  }

  async function handleSceneSend(planMode) {
    const text = sceneInput.value.trim();
    if (!text) return;
    sceneInput.value = '';

    const layer = layerContextPinned ? sceneEditor.getSelectedLayer() : null;
    const displayText = layer ? `[${layer.id}] ${text}` : text;
    addTextMessage(sceneMessagesEl, displayText, 'user');

    const payload = planMode
      ? `Étape 1 BROUILLON — découpe en calques (JSON SceneManifest uniquement, sans prompts Flux) : ${text}`
      : buildLayerContextMessage(text, layer);

    setSceneBusy(true, planMode ? 'Découpage en calques (brouillon)…' : 'L\'IA répond…');
    try {
      if (!sceneConversationId) {
        sceneConversationId = await ensureConversation(SCENE_SYSTEM);
      }
      const reply = await sendChat(sceneConversationId, payload);
      const applied = applySceneAiResponse(reply, { brouillonOnly: planMode });
      if (!applied) addTextMessage(sceneMessagesEl, reply, 'bot');
      setStatus(planMode ? 'Brouillon prêt.' : 'Réponse reçue.');
    } catch (e) {
      addTextMessage(sceneMessagesEl, 'Erreur: ' + e.message, 'bot');
    } finally {
      setSceneBusy(false);
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
  }

  function openAnimationForAsset(data) {
    if (!animateEditor) {
      setStatus('Éditeur animation indisponible.');
      return;
    }
    animateEditor.addAssetItem(data);
    animateEditor.loadAsset(data);
    switchTab('animate');
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
        if (layerContextPinned) updateLayerContextUI(layer);
        else updateLayerContextUI(null);
      },
    });
    sceneEditor.onRegenerateLayer = regenerateLayer;
    sceneEditor.onUploadReference = uploadReferenceImage;

    if (sceneRefineBtn) sceneRefineBtn.addEventListener('click', handleRefinePrompts);
    if (sceneRefineBtnSide) sceneRefineBtnSide.addEventListener('click', handleRefinePrompts);
    if (sceneGenAllBtn) sceneGenAllBtn.addEventListener('click', () => generateAllImageLayers(false));
    if (sceneGenAllBtnSide) sceneGenAllBtnSide.addEventListener('click', () => generateAllImageLayers(false));

    sceneNewBtn.addEventListener('click', () => {
      if (confirm('Nouveau projet ? Les calques non exportés seront remplacés.')) {
        sceneEditor.newProject();
        addTextMessage(sceneMessagesEl, 'Nouveau projet créé.', 'bot');
        updateLayerContextUI(null);
      }
    });

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

    layerContextClear.addEventListener('click', () => {
      layerContextPinned = false;
      updateLayerContextUI(null);
      sceneInput.placeholder = 'Planifier une scène ou message libre…';
    });

    layerContextEl.addEventListener('click', (e) => {
      if (e.target === layerContextClear) return;
      const layer = sceneEditor.getSelectedLayer();
      if (layer) {
        layerContextPinned = true;
        updateLayerContextUI(layer);
        sceneInput.focus();
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

    extractEditor = new global.MediaStudioExtract.ExtractEditor({
      stageEl: document.getElementById('extractStage'),
      previewEl: document.getElementById('extractPreview'),
      savedListEl: document.getElementById('extractSavedList'),
      dropZoneEl: document.getElementById('extractMain'),
      cropInputs,
      onStatus: setStatus,
      onImportFile: handleExtractImportFile,
      onAnimateAsset: (data) => openAnimationForAsset(data),
    });

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
          extractEditor.setResult(data);
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
    animateEditor = new global.MediaStudioAnimate.AnimationEditor({
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
      msApi,
      parseApiResponse,
      onGeneratePrompt: requestAnimationLlm,
      onStatus: setStatus,
    });

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
      data.data.forEach((item) => addGalleryThumb(item));
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

  sceneSendBtn.addEventListener('click', () => handleSceneSend(false));
  scenePlanBtn.addEventListener('click', () => handleSceneSend(true));
  sceneInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSceneSend(false);
    }
  });

  initTabs();
  initSceneEditor();
  initExtractEditor();
  initAnimateEditor();
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
