/**
 * FICHIER : modules/chat/frontend/assets/js/chat-app.js
 * RÔLE : App Chat IA — bootstrap, conversation, messages sync/stream, sélecteurs serveur/modèle.
 *
 * ENTRÉES : window.CHAT_CONFIG { apiBase, jwt } injecté par chat.php
 * SORTIES : appels /api/chat/* et /api/ia/servers*
 */

(function () {
  var CONFIG = window.CHAT_CONFIG || {};
  var API_BASE = (CONFIG.apiBase || '').replace(/\/$/, '');
  var JWT = CONFIG.jwt || '';

  var conversationId = null;
  var messagesDiv = document.getElementById('messages');
  var userInput = document.getElementById('userInput');
  var sendBtn = document.getElementById('sendBtn');
  var typingIndicator = document.getElementById('typing');
  var contextInput = document.getElementById('contextInput');
  var chatMeta = document.getElementById('chatMeta');
  var statusLine = document.getElementById('statusLine');
  var responseMode = document.getElementById('responseMode');
  var runtimeSelectors = document.getElementById('runtimeSelectors');
  var serverSelect = document.getElementById('serverSelect');
  var modelSelect = document.getElementById('modelSelect');
  var runtimeDefaults = { default_server_id: null, default_model: null };

  if (!messagesDiv || !userInput || !sendBtn) return;

  function apiUrl(path) {
    return API_BASE + path;
  }

  function authHeaders(extra) {
    var headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
    if (JWT) headers.Authorization = 'Bearer ' + JWT;
    return headers;
  }

  function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function addMessage(text, sender) {
    var div = document.createElement('div');
    div.className = 'chat-message ' + sender;
    div.textContent = text;
    messagesDiv.appendChild(div);
    scrollToBottom();
  }

  function setStatus(text) {
    if (statusLine) statusLine.textContent = text || '';
  }

  async function ensureConversation() {
    if (conversationId) return conversationId;
    var response = await fetch(apiUrl('/api/chat/conversations'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders(),
      body: JSON.stringify({
        context: contextInput ? contextInput.value.trim() : '',
        server_id: serverSelect && serverSelect.value ? serverSelect.value : undefined,
        model: modelSelect && modelSelect.value ? modelSelect.value : undefined
      })
    });
    var data = await response.json();
    if (!data.success || !data.data || !data.data._id) {
      throw new Error(data.message || 'Impossible de créer la conversation.');
    }
    conversationId = data.data._id;
    return conversationId;
  }

  async function loadBootstrap() {
    try {
      var response = await fetch(apiUrl('/api/chat/bootstrap'), {
        credentials: 'same-origin',
        headers: authHeaders()
      });
      var data = await response.json();
      if (!data.success) {
        chatMeta.textContent = 'Chat indisponible: ' + (data.message || 'configuration manquante');
        sendBtn.disabled = true;
        userInput.disabled = true;
        return;
      }
      var info = data.data || {};
      runtimeDefaults = {
        default_server_id: info.default_server_id || null,
        default_model: info.default_model || null
      };
      chatMeta.textContent =
        'Serveur: ' + (runtimeDefaults.default_server_id || '-') +
        ' | Modèle: ' + (runtimeDefaults.default_model || '-');
      setStatus('Configuration prête.');
      await loadServersAndModels();
    } catch (error) {
      chatMeta.textContent = 'Erreur de chargement de la configuration.';
      sendBtn.disabled = true;
      userInput.disabled = true;
    }
  }

  function updateMeta() {
    var sid = serverSelect && serverSelect.value
      ? serverSelect.value
      : (runtimeDefaults.default_server_id || '-');
    var mid = modelSelect && modelSelect.value
      ? modelSelect.value
      : (runtimeDefaults.default_model || '-');
    chatMeta.textContent = 'Serveur: ' + (sid || '-') + ' | Modèle: ' + (mid || '-');
  }

  function setSelectOptions(selectEl, items, getValue, getLabel) {
    selectEl.innerHTML = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var opt = document.createElement('option');
      opt.value = getValue(it);
      opt.textContent = getLabel(it);
      selectEl.appendChild(opt);
    }
  }

  async function fetchJson(url) {
    var r = await fetch(url, {
      credentials: 'same-origin',
      headers: authHeaders()
    });
    var j = await r.json();
    if (!j || j.success !== true) throw new Error(j && j.message ? j.message : 'Erreur API');
    return j;
  }

  async function loadServersAndModels() {
    try {
      var j = await fetchJson(apiUrl('/api/ia/servers'));
      var servers = Array.isArray(j.servers) ? j.servers : [];
      if (!servers.length) {
        runtimeSelectors.style.display = 'none';
        return;
      }
      runtimeSelectors.style.display = 'flex';
      setSelectOptions(
        serverSelect,
        servers,
        function (s) { return String(s._id || ''); },
        function (s) { return (s.name || 'Serveur') + ' (' + (s.provider || '-') + ')'; }
      );
      if (runtimeDefaults.default_server_id) {
        serverSelect.value = runtimeDefaults.default_server_id;
      }
      await loadModelsForServer(serverSelect.value);
      if (runtimeDefaults.default_model) {
        modelSelect.value = runtimeDefaults.default_model;
      }
      updateMeta();
    } catch (e) {
      runtimeSelectors.style.display = 'none';
    }
  }

  async function loadModelsForServer(serverId) {
    if (!serverId) {
      modelSelect.innerHTML = '';
      return;
    }
    modelSelect.disabled = true;
    modelSelect.innerHTML = '<option value="">Chargement...</option>';
    try {
      var j = await fetchJson(apiUrl('/api/ia/servers/' + encodeURIComponent(serverId) + '/models'));
      var models = Array.isArray(j.models) ? j.models : [];
      var names = models
        .map(function (m) { return (typeof m === 'string' ? m : (m.name || '')).trim(); })
        .filter(Boolean);
      if (!names.length) {
        modelSelect.innerHTML = '<option value="">Aucun modèle</option>';
        return;
      }
      setSelectOptions(modelSelect, names, function (x) { return x; }, function (x) { return x; });
    } finally {
      modelSelect.disabled = false;
    }
  }

  function parseSseBlocks(buffer, onEvent) {
    var rest = buffer;
    var idx;
    while ((idx = rest.indexOf('\n\n')) >= 0) {
      var block = rest.slice(0, idx);
      rest = rest.slice(idx + 2);
      var lines = block.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.startsWith('data:')) continue;
        var raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          onEvent(JSON.parse(raw));
        } catch (_) { /* ignore */ }
      }
    }
    return rest;
  }

  async function sendMessageStream(text) {
    var convId = await ensureConversation();
    var response = await fetch(apiUrl('/api/chat/conversations/' + convId + '/messages/stream'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders({ Accept: 'text/event-stream' }),
      body: JSON.stringify({
        message: text,
        memory_size: 20,
        server_id: serverSelect && serverSelect.value ? serverSelect.value : undefined,
        model: modelSelect && modelSelect.value ? modelSelect.value : undefined
      })
    });

    if (!response.ok) {
      var msg = 'HTTP ' + response.status;
      try {
        var j = await response.json();
        if (j.message) msg = j.message;
      } catch (_) { /* keep */ }
      addMessage('Erreur: ' + msg, 'bot');
      setStatus('Erreur API.');
      return;
    }

    var botEl = document.createElement('div');
    botEl.className = 'chat-message bot';
    botEl.textContent = '';
    messagesDiv.appendChild(botEl);
    scrollToBottom();

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';
    var sawFatalError = false;

    function handleEvent(j) {
      if (j.token) {
        botEl.textContent += j.token;
        scrollToBottom();
      }
      if (j.error) {
        sawFatalError = true;
        botEl.textContent += (botEl.textContent ? '\n\n' : '') + '[Erreur] ' + j.error;
      }
      if (j.done && j.conversation) {
        setStatus('Réponse reçue (' + (j.model || 'modèle inconnu') + ')');
      }
    }

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      buf = parseSseBlocks(buf, handleEvent);
    }
    buf = parseSseBlocks(buf, handleEvent);
    if (!botEl.textContent.trim() && !sawFatalError) {
      botEl.textContent = 'Aucune réponse.';
    }
  }

  async function sendMessage() {
    var text = userInput.value.trim();
    if (!text) return;

    var mode = responseMode && responseMode.value === 'stream' ? 'stream' : 'complete';

    addMessage(text, 'user');
    userInput.value = '';
    userInput.disabled = true;
    sendBtn.disabled = true;
    if (typingIndicator) typingIndicator.style.display = mode === 'complete' ? 'block' : 'none';
    setStatus(mode === 'stream' ? 'Génération en flux…' : 'Envoi en cours...');

    try {
      if (mode === 'stream') {
        await sendMessageStream(text);
      } else {
        var convId = await ensureConversation();
        var response = await fetch(apiUrl('/api/chat/conversations/' + convId + '/messages'), {
          method: 'POST',
          credentials: 'same-origin',
          headers: authHeaders(),
          body: JSON.stringify({
            message: text,
            memory_size: 20,
            server_id: serverSelect && serverSelect.value ? serverSelect.value : undefined,
            model: modelSelect && modelSelect.value ? modelSelect.value : undefined
          })
        });

        var data = await response.json();
        if (data.success) {
          addMessage(data.data.response || 'Aucune réponse.', 'bot');
          setStatus('Réponse reçue (' + (data.data.model || 'modèle inconnu') + ')');
        } else {
          addMessage('Erreur: ' + (data.message || 'Problème inconnu'), 'bot');
          setStatus('Erreur API.');
        }
      }
    } catch (e) {
      console.error(e);
      addMessage('Erreur de connexion au serveur.', 'bot');
      setStatus('Erreur de connexion.');
    } finally {
      userInput.disabled = false;
      sendBtn.disabled = false;
      if (typingIndicator) typingIndicator.style.display = 'none';
      userInput.focus();
      scrollToBottom();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  if (contextInput) {
    contextInput.addEventListener('change', function () {
      if (!conversationId) return;
      setStatus('Le nouveau contexte sera pris en compte après nouvelle conversation.');
    });
  }

  if (serverSelect) {
    serverSelect.addEventListener('change', async function () {
      try {
        await loadModelsForServer(serverSelect.value);
        updateMeta();
      } catch (_) { /* ignore */ }
      if (conversationId) setStatus('Serveur/LLM modifié: appliqué au prochain message.');
    });
  }
  if (modelSelect) {
    modelSelect.addEventListener('change', function () {
      updateMeta();
      if (conversationId) setStatus('Serveur/LLM modifié: appliqué au prochain message.');
    });
  }

  loadBootstrap();
  userInput.focus();
})();
