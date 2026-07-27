/**
 * FICHIER : modules/doc-hub/frontend/assets/js/doc-hub-app.js
 * RÔLE : App Doc-Hub — projets, documents (upload/tags), envois par liens sécurisés.
 *
 * ENTRÉES : window.DOC_HUB_CONFIG { apiBase, jwt } injecté par doc-hub.php
 * SORTIES : appels /api/doc-hub/*
 */

(function () {
    var CONFIG = window.DOC_HUB_CONFIG || {};
    var API = (CONFIG.apiBase || '') + '/doc-hub';
    var JWT = CONFIG.jwt || '';
    var UPLOAD_BATCH_SIZE = 15;

    var currentProjectId = null;
    var currentProjectTab = 'documents';
    var slotTemplates = [];
    var projectDocuments = [];
    var tagCatalog = [];

    var toast = document.getElementById('status-toast');
    var modalTags = document.getElementById('modal-tags');
    var modalEnvoi = document.getElementById('modal-envoi');
    var uploadOverlay = document.getElementById('upload-progress-overlay');
    var toastHideTimer = null;

    function toastMsg(msg, isError, persistent) {
        if (isError || persistent) {
            showPersistentAlert(msg, isError ? 'error' : 'info');
            return;
        }
        toast.textContent = msg;
        toast.style.background = '#333';
        toast.classList.remove('hidden');
        if (toastHideTimer) clearTimeout(toastHideTimer);
        toastHideTimer = setTimeout(function () { toast.classList.add('hidden'); }, 4500);
    }

    function showPersistentAlert(msg, type) {
        var box = document.getElementById('doc-hub-alerts');
        if (!box || !msg) return;
        var el = document.createElement('div');
        el.className = 'doc-hub-alert doc-hub-alert--' + (type || 'error');
        var p = document.createElement('p');
        p.textContent = msg;
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'doc-hub-alert-close';
        close.setAttribute('aria-label', 'Fermer');
        close.textContent = '×';
        close.addEventListener('click', function () { el.remove(); });
        el.appendChild(p);
        el.appendChild(close);
        box.appendChild(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function clearAlerts() {
        var box = document.getElementById('doc-hub-alerts');
        if (box) box.innerHTML = '';
    }

    function setUploadProgress(opts) {
        var title = document.getElementById('upload-progress-title');
        var detail = document.getElementById('upload-progress-detail');
        var count = document.getElementById('upload-progress-count');
        var fill = document.getElementById('upload-progress-fill');
        var bar = fill && fill.parentElement;
        if (title) title.textContent = opts.title || 'Envoi des fichiers en cours…';
        if (detail) detail.textContent = opts.detail || '';
        if (count) count.textContent = opts.count || '';
        var pct = opts.percent != null ? Math.min(100, Math.max(0, opts.percent)) : 0;
        if (fill) fill.style.width = pct + '%';
        if (bar) bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    function showUploadOverlay(show) {
        if (!uploadOverlay) return;
        uploadOverlay.classList.toggle('hidden', !show);
        document.body.style.overflow = show ? 'hidden' : '';
    }

    function api(path, options) {
        options = options || {};
        var headers = options.headers || {};
        headers['Authorization'] = 'Bearer ' + JWT;
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        }
        return fetch(API + path, Object.assign({}, options, { headers: headers, credentials: 'include' }))
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, json: j }; }); });
    }

    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function formatSize(n) {
        if (!n) return '';
        if (n < 1024) return n + ' o';
        if (n < 1024 * 1024) return Math.round(n / 1024) + ' Ko';
        return (n / (1024 * 1024)).toFixed(1) + ' Mo';
    }

    function formatDate(d) {
        if (!d) return '—';
        try {
            var dt = new Date(d);
            return dt.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return String(d);
        }
    }

    function formatDocDates(doc) {
        var capture = doc.captureDate || (doc.metadata && doc.metadata.captureDate);
        var source = doc.dateSource || (doc.metadata && doc.metadata.dateSource);
        if (capture) {
            var label = 'Date enregistrée';
            if (source === 'exif' || source === 'exif-client') label = 'Prise de vue (EXIF conservé)';
            else if (source === 'client-file') label = 'Date originale (votre fichier)';
            else if (source === 'filesystem') label = 'Date fichier';
            return '<span class="doc-date-ok">' + label + ' : ' + formatDate(capture) + '</span>' +
                '<br><span class="text-muted">Ajouté dans Doc-Hub le ' + formatDate(doc.uploadedAt) + '</span>';
        }
        if (doc.metadata && doc.metadata.exifPresent === false && doc.mimeType && doc.mimeType.indexOf('image/') === 0) {
            return '<span class="doc-date-warn">EXIF absent</span>' +
                '<br><span class="text-muted">Ajouté le ' + formatDate(doc.uploadedAt) + '</span>';
        }
        return '<span class="text-muted">Ajouté le ' + formatDate(doc.uploadedAt) + '</span>';
    }

    function statusLabel(status) {
        var map = { sent: 'Envoyé', failed: 'Échec', revoked: 'Révoqué', pending: 'En attente' };
        return map[status] || status || '—';
    }

    function setProjectTab(tab) {
        currentProjectTab = tab;
        document.querySelectorAll('.doc-hub-nav-btn').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab);
        });
        document.getElementById('panel-documents').classList.toggle('hidden', tab !== 'documents');
        document.getElementById('panel-envois').classList.toggle('hidden', tab !== 'envois');
        if (tab === 'envois') {
            refreshDiffDocPicker();
            loadDiffusions();
        }
    }

    function tagByCode(code) {
        return tagCatalog.find(function (t) { return t.code === code; });
    }

    function loadTags() {
        return api('/tags').then(function (res) {
            if (res.ok && res.json.success) {
                tagCatalog = res.json.data || [];
            }
            return tagCatalog;
        });
    }

    function showList() {
        document.getElementById('view-list').classList.remove('hidden');
        document.getElementById('view-project').classList.add('hidden');
        currentProjectId = null;
        loadProjects();
    }

    function showProject(id, openTab) {
        currentProjectId = id;
        document.getElementById('view-list').classList.add('hidden');
        document.getElementById('view-project').classList.remove('hidden');
        loadProjectDetail();
        loadTags().then(function () {
            loadDocuments();
            if (openTab === 'envois') setProjectTab('envois');
            else setProjectTab('documents');
        });
        loadSlots();
    }

    function loadProjects() {
        var projectsList = document.getElementById('projects-list');
        projectsList.textContent = 'Chargement…';
        api('/projects?limit=50').then(function (res) {
            if (!res.ok || !res.json.success) {
                projectsList.textContent = res.json.message || 'Erreur chargement';
                return;
            }
            var items = res.json.data || [];
            if (!items.length) {
                projectsList.innerHTML = '<p class="text-muted">Aucun projet. Créez-en un.</p>';
                return;
            }
            projectsList.innerHTML = items.map(function (p) {
                return '<button type="button" class="doc-hub-card" data-id="' + p._id + '">' +
                    '<strong>' + escapeHtml(p.title) + '</strong>' +
                    '<span class="text-muted">' + escapeHtml(p.reference || p.status || '') + '</span></button>';
            }).join('');
            projectsList.querySelectorAll('.doc-hub-card').forEach(function (btn) {
                btn.addEventListener('click', function () { showProject(btn.getAttribute('data-id')); });
            });
        });
    }

    function loadSlots() {
        api('/slot-templates').then(function (res) {
            if (!res.ok) return;
            slotTemplates = res.json.data || [];
            document.getElementById('upload-slot').innerHTML = slotTemplates.map(function (s) {
                return '<option value="' + escapeHtml(s.code) + '">' + escapeHtml(s.label) + '</option>';
            }).join('');
        });
    }

    function loadProjectDetail() {
        api('/projects/' + currentProjectId).then(function (res) {
            if (!res.ok) return;
            var p = res.json.data;
            document.getElementById('project-title').textContent = p.title;
            document.getElementById('project-ref').textContent = p.reference ? 'Réf. ' + p.reference : '';
        });
    }

    function renderTagChips(doc) {
        var codes = doc.tags || [];
        return codes.map(function (code) {
            var t = tagByCode(code);
            var label = t ? t.label : code;
            var color = t ? t.color : '#6c757d';
            return '<span class="tag-chip" style="background:' + escapeHtml(color) + '">' +
                escapeHtml(label) +
                '<button type="button" data-doc="' + doc._id + '" data-code="' + escapeHtml(code) + '" title="Retirer">×</button></span>';
        }).join('');
    }

    function saveDocumentTags(docId, tags) {
        return api('/documents/' + docId + '/tags', {
            method: 'PATCH',
            body: JSON.stringify({ tags: tags })
        }).then(function (res) {
            if (!res.ok) {
                toastMsg(res.json.message || 'Erreur tags', true);
                return false;
            }
            var doc = projectDocuments.find(function (d) { return String(d._id) === String(docId); });
            if (doc) doc.tags = tags;
            return true;
        });
    }

    function openTagPicker(anchorBtn, docId) {
        closeTagPicker();
        var doc = projectDocuments.find(function (d) { return String(d._id) === String(docId); });
        if (!doc) return;

        var pop = document.createElement('div');
        pop.className = 'tag-picker-pop';
        var current = new Set(doc.tags || []);

        tagCatalog.forEach(function (t) {
            if (current.has(t.code)) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = t.label;
            btn.addEventListener('click', function () {
                var next = (doc.tags || []).concat([t.code]);
                saveDocumentTags(docId, next).then(function (ok) {
                    if (ok) {
                        doc.tags = next;
                        loadDocuments();
                    }
                    closeTagPicker();
                });
            });
            pop.appendChild(btn);
        });

        if (!pop.children.length) {
            var empty = document.createElement('p');
            empty.className = 'text-muted small';
            empty.style.padding = '0.4rem';
            empty.textContent = 'Tous les tags sont déjà appliqués';
            pop.appendChild(empty);
        }

        var rect = anchorBtn.getBoundingClientRect();
        pop.style.position = 'fixed';
        pop.style.top = (rect.bottom + 4) + 'px';
        pop.style.left = rect.left + 'px';
        pop.id = 'active-tag-picker';
        document.body.appendChild(pop);

        setTimeout(function () {
            document.addEventListener('click', onOutsidePicker, { once: true });
        }, 0);
    }

    function closeTagPicker() {
        var el = document.getElementById('active-tag-picker');
        if (el) el.remove();
    }

    function onOutsidePicker(e) {
        if (!e.target.closest('#active-tag-picker') && !e.target.closest('.btn-tag-add')) {
            closeTagPicker();
        }
    }

    function deleteDocumentById(id) {
        return api('/documents/' + id, { method: 'DELETE' }).then(function (res) {
            return { ok: res.ok, message: res.json.message };
        });
    }

    function deleteDocumentsByIds(ids) {
        if (!ids.length) return Promise.resolve({ ok: false });
        if (ids.length === 1) {
            return deleteDocumentById(ids[0]).then(function (r) {
                return { ok: r.ok, deleted: r.ok ? 1 : 0, message: r.message };
            });
        }
        return api('/projects/' + currentProjectId + '/documents/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ documentIds: ids })
        }).then(function (res) {
            var n = res.json.data && res.json.data.deleted != null ? res.json.data.deleted : 0;
            return { ok: res.ok, deleted: n, message: res.json.message };
        });
    }

    function updateDocDeleteToolbar() {
        var toolbar = document.getElementById('doc-list-toolbar');
        var bulkBtn = document.getElementById('btn-doc-delete-selected');
        if (!toolbar || !bulkBtn) return;
        var hasDocs = projectDocuments.length > 0;
        toolbar.hidden = !hasDocs;
        var checked = document.querySelectorAll('.doc-item-check:checked');
        bulkBtn.disabled = checked.length === 0;
        bulkBtn.textContent = checked.length
            ? 'Supprimer la sélection (' + checked.length + ')'
            : 'Supprimer la sélection';
    }

    function bindDocumentDeleteHandlers(container) {
        container.querySelectorAll('.btn-doc-delete[data-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-id');
                var doc = projectDocuments.find(function (d) { return String(d._id) === String(id); });
                var name = doc && doc.filename ? doc.filename : 'ce document';
                if (!confirm('Supprimer définitivement « ' + name + ' » ?\n\nLe fichier et les liens de téléchargement associés seront retirés.')) return;
                deleteDocumentById(id).then(function (res) {
                    if (!res.ok) {
                        toastMsg(res.message || 'Suppression impossible', true);
                        return;
                    }
                    toastMsg('Document supprimé');
                    loadDocuments();
                });
            });
        });
        container.querySelectorAll('.doc-item-check').forEach(function (cb) {
            cb.addEventListener('change', updateDocDeleteToolbar);
        });
    }

    function bindDocumentTagHandlers(container) {
        container.querySelectorAll('.btn-tag-add').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openTagPicker(btn, btn.getAttribute('data-doc'));
            });
        });
        container.querySelectorAll('.tag-chip button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var docId = btn.getAttribute('data-doc');
                var code = btn.getAttribute('data-code');
                var doc = projectDocuments.find(function (d) { return String(d._id) === docId; });
                if (!doc) return;
                var next = (doc.tags || []).filter(function (c) { return c !== code; });
                saveDocumentTags(docId, next).then(function (ok) { if (ok) loadDocuments(); });
            });
        });
    }

    function refreshDiffDocPicker() {
        var picker = document.getElementById('diff-doc-picker');
        if (!projectDocuments.length) {
            picker.innerHTML = '<p class="text-muted">Aucun document. Ajoutez-en dans l’onglet Documents.</p>';
            return;
        }
        picker.innerHTML = projectDocuments.map(function (d) {
            return '<label class="diff-doc-row"><input type="checkbox" name="diff-doc" value="' + d._id + '"> ' +
                escapeHtml(d.filename) + ' <small class="text-muted">(' + escapeHtml(d.slotCode) + ')</small></label>';
        }).join('');
    }

    function loadDocuments() {
        var el = document.getElementById('documents-list');
        el.textContent = 'Chargement…';
        api('/projects/' + currentProjectId + '/documents').then(function (res) {
            if (!res.ok) {
                el.textContent = 'Erreur';
                return;
            }
            projectDocuments = res.json.data || [];
            if (!projectDocuments.length) {
                el.innerHTML = '<p class="text-muted">Aucun document.</p>';
                updateDocDeleteToolbar();
                refreshDiffDocPicker();
                return;
            }
            el.innerHTML = projectDocuments.map(function (d) {
                var dateLine = formatDocDates(d);
                return '<div class="doc-item" data-id="' + d._id + '">' +
                    '<label class="doc-item-select" title="Sélectionner pour suppression">' +
                    '<input type="checkbox" class="doc-item-check" value="' + d._id + '"></label>' +
                    '<div class="doc-item-main"><strong>' + escapeHtml(d.filename) + '</strong><br>' +
                    '<small class="text-muted">' + escapeHtml(d.slotCode) + ' · ' + formatSize(d.size) +
                    (dateLine ? '<br>' + dateLine : '') + '</small></div>' +
                    '<div class="doc-item-actions">' +
                    '<div class="doc-item-tags">' + renderTagChips(d) +
                    '<button type="button" class="btn-tag-add" data-doc="' + d._id + '" title="Ajouter un tag">+</button></div>' +
                    '<button type="button" class="btn btn-outline btn-sm btn-doc-delete" data-id="' + d._id + '" title="Supprimer ce document">Supprimer</button>' +
                    '</div></div>';
            }).join('');
            bindDocumentTagHandlers(el);
            bindDocumentDeleteHandlers(el);
            updateDocDeleteToolbar();
            refreshDiffDocPicker();
        });
    }

    function loadDiffusions() {
        var el = document.getElementById('envois-history');
        el.textContent = 'Chargement…';
        api('/projects/' + currentProjectId + '/diffusions').then(function (res) {
            if (!res.ok) {
                el.innerHTML = '<p class="text-muted">Erreur chargement.</p>';
                return;
            }
            var items = res.json.data || [];
            if (!items.length) {
                el.innerHTML = '<p class="text-muted">Aucun envoi pour ce projet.</p>';
                return;
            }
            el.innerHTML = items.map(renderEnvoiCard).join('');
            el.querySelectorAll('.btn-revoke-envoi').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-id');
                    if (!confirm('Révoquer cet envoi ? Les liens de téléchargement ne fonctionneront plus.')) return;
                    api('/diffusions/' + id + '/revoke', { method: 'POST' }).then(function (r) {
                        if (!r.ok) toastMsg(r.json.message || 'Erreur', true);
                        else {
                            toastMsg('Envoi révoqué');
                            loadDiffusions();
                        }
                    });
                });
            });
        });
    }

    function renderEnvoiCard(item) {
        var st = item.status || 'pending';
        var trace = item.trace || {};
        var files = (item.documentPreview || []).map(function (f) { return escapeHtml(f.filename); }).join(', ');
        if ((item.documentsCount || 0) > (item.documentPreview || []).length) {
            files += '… (+' + ((item.documentsCount || 0) - (item.documentPreview || []).length) + ')';
        }
        var linkMode = item.linkMode === 'bundle' ? 'Lien unique (ZIP)' : 'Liens par fichier';
        var traceLines = (trace.links || []).map(function (l, i) {
            var exp = l.expiresAt ? formatDate(l.expiresAt) : '—';
            var revoked = l.revokedAt ? ' · révoqué' : '';
            var dl = (l.downloadCount || 0) + (l.maxDownloads != null ? '/' + l.maxDownloads : '') + ' téléchargement(s)';
            var type = l.type === 'bundle' ? 'Archive' : 'Fichier';
            return type + ' ' + (i + 1) + ' — exp. ' + exp + ' — ' + dl + revoked;
        }).join('<br>');

        var revokeBtn = st !== 'revoked'
            ? '<button type="button" class="btn btn-outline btn-sm btn-revoke-envoi" data-id="' + item._id + '">Révoquer les liens</button>'
            : '';

        return '<article class="envoi-card">' +
            '<div class="envoi-card-header">' +
            '<div><strong>' + escapeHtml(item.subject || 'Sans objet') + '</strong><br>' +
            '<span class="text-muted small">→ ' + escapeHtml(item.recipientEmail) + '</span></div>' +
            '<span class="envoi-status envoi-status--' + escapeHtml(st) + '">' + escapeHtml(statusLabel(st)) + '</span></div>' +
            '<p class="envoi-meta">Envoyé : ' + formatDate(item.sentAt || item.createdAt) +
            ' · ' + (item.documentsCount || 0) + ' doc(s) · ' + linkMode +
            (item.smtpProfileLabel || item.smtpProfile
                ? ' · Expéditeur : ' + escapeHtml(item.smtpProfileLabel || item.smtpProfile)
                : '') + '</p>' +
            (files ? '<p class="envoi-meta"><strong>Fichiers :</strong> ' + files + '</p>' : '') +
            (item.error ? '<p class="envoi-meta" style="color:#b42318">' + escapeHtml(item.error) + '</p>' : '') +
            '<div class="envoi-trace"><strong>Traçabilité liens</strong><br>' + (traceLines || '—') +
            (trace.totalDownloads != null ? '<br>Total téléchargements : ' + trace.totalDownloads : '') + '</div>' +
            '<div class="envoi-actions">' + revokeBtn + '</div></article>';
    }

    function renderTagsCrudList() {
        var ul = document.getElementById('tags-crud-list');
        if (!tagCatalog.length) {
            ul.innerHTML = '<li class="text-muted">Aucun tag</li>';
            return;
        }
        ul.innerHTML = tagCatalog.map(function (t) {
            return '<li><span><span class="tags-crud-swatch" style="background:' + escapeHtml(t.color) + '"></span> ' +
                escapeHtml(t.label) + ' <small class="text-muted">(' + escapeHtml(t.code) + ')</small></span>' +
                '<button type="button" class="btn btn-outline btn-sm btn-del-tag" data-id="' + t._id + '">Supprimer</button></li>';
        }).join('');
        ul.querySelectorAll('.btn-del-tag').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!confirm('Supprimer ce tag ? Il sera retiré des documents.')) return;
                api('/tags/' + btn.getAttribute('data-id'), { method: 'DELETE' }).then(function (res) {
                    if (!res.ok) toastMsg(res.json.message || 'Erreur', true);
                    else {
                        toastMsg('Tag supprimé');
                        loadTags().then(function () {
                            renderTagsCrudList();
                            if (currentProjectId) loadDocuments();
                        });
                    }
                });
            });
        });
    }

    function openEnvoiModal() {
        if (!currentProjectId) {
            toastMsg('Ouvrez un projet d’abord', true);
            return;
        }
        refreshDiffDocPicker();
        document.querySelectorAll('input[name="diff-doc"]').forEach(function (cb) { cb.checked = true; });
        modalEnvoi.classList.remove('hidden');
        var emailEl = document.getElementById('diff-email');
        if (emailEl) emailEl.focus();
    }

    function closeEnvoiModal() {
        modalEnvoi.classList.add('hidden');
    }

    document.getElementById('btn-manage-tags').addEventListener('click', function () {
        loadTags().then(function () {
            renderTagsCrudList();
            modalTags.classList.remove('hidden');
        });
    });
    modalTags.querySelectorAll('[data-close-tags]').forEach(function (el) {
        el.addEventListener('click', function () { modalTags.classList.add('hidden'); });
    });

    document.getElementById('btn-new-envoi').addEventListener('click', openEnvoiModal);
    modalEnvoi.querySelectorAll('[data-close-envoi]').forEach(function (el) {
        el.addEventListener('click', closeEnvoiModal);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modalEnvoi.classList.contains('hidden')) closeEnvoiModal();
    });
    document.getElementById('form-new-tag').addEventListener('submit', function (e) {
        e.preventDefault();
        var label = document.getElementById('new-tag-label').value.trim();
        var color = document.getElementById('new-tag-color').value;
        if (!label) return;
        api('/tags', {
            method: 'POST',
            body: JSON.stringify({ label: label, color: color })
        }).then(function (res) {
            if (!res.ok) {
                toastMsg(res.json.message || 'Erreur', true);
                return;
            }
            document.getElementById('new-tag-label').value = '';
            toastMsg('Tag créé');
            loadTags().then(renderTagsCrudList);
        });
    });

    document.getElementById('btn-new-project').addEventListener('click', function () {
        var title = prompt('Titre du projet :');
        if (!title || !title.trim()) return;
        var reference = prompt('Référence (optionnel) :') || '';
        api('/projects', {
            method: 'POST',
            body: JSON.stringify({ title: title.trim(), reference: reference.trim() || null })
        }).then(function (res) {
            if (!res.ok) {
                toastMsg(res.json.message || 'Erreur création', true);
                return;
            }
            toastMsg('Projet créé');
            showProject(res.json.data._id);
        });
    });

    document.getElementById('btn-back-list').addEventListener('click', showList);

    document.querySelectorAll('.doc-hub-nav-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setProjectTab(btn.getAttribute('data-tab'));
        });
    });
    document.getElementById('btn-refresh-envois').addEventListener('click', loadDiffusions);

    function buildClientFileMeta(fileList) {
        var meta = [];
        for (var i = 0; i < fileList.length; i++) {
            var f = fileList[i];
            meta.push({
                originalName: f.name,
                lastModified: f.lastModified,
                size: f.size
            });
        }
        return meta;
    }

    function parseUploadResponse(r) {
        return r.text().then(function (text) {
            var j = {};
            if (text) {
                try {
                    j = JSON.parse(text);
                } catch (e) {
                    j = { success: false, message: r.ok ? 'Réponse serveur invalide' : (text.slice(0, 120) || 'Erreur ' + r.status) };
                }
            }
            return { ok: r.ok, status: r.status, json: j };
        });
    }

    function uploadBatch(fileArr, slotCode) {
        var fd = new FormData();
        fd.append('slotCode', slotCode);
        for (var i = 0; i < fileArr.length; i++) fd.append('files', fileArr[i]);
        fd.append('clientFileMeta', JSON.stringify(buildClientFileMeta(fileArr)));
        return fetch(API + '/projects/' + currentProjectId + '/documents', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + JWT },
            body: fd,
            credentials: 'include'
        }).then(parseUploadResponse);
    }

    function runBatchedUpload(fileList, slotCode) {
        var files = Array.prototype.slice.call(fileList);
        var total = files.length;
        var batches = [];
        for (var i = 0; i < total; i += UPLOAD_BATCH_SIZE) {
            batches.push(files.slice(i, i + UPLOAD_BATCH_SIZE));
        }
        var uploaded = 0;
        var errors = [];
        var missingExifTotal = 0;

        showUploadOverlay(true);
        setUploadProgress({
            title: 'Envoi des fichiers en cours…',
            detail: 'Préparation de ' + total + ' fichier(s) en ' + batches.length + ' lot(s)',
            count: '0 / ' + total,
            percent: 0
        });

        function processBatch(batchIndex) {
            if (batchIndex >= batches.length) {
                showUploadOverlay(false);
                document.getElementById('upload-files').value = '';
                loadDocuments();
                if (errors.length) {
                    showPersistentAlert(
                        'Import terminé : ' + uploaded + ' / ' + total + ' fichier(s) envoyé(s).\n\n' +
                        errors.join('\n'),
                        'error'
                    );
                } else if (missingExifTotal > 0) {
                    showPersistentAlert(
                        uploaded + ' fichier(s) importé(s). Date de prise absente sur ' + missingExifTotal + ' image(s).',
                        'warn'
                    );
                    toastMsg(uploaded + ' fichier(s) importé(s)');
                } else {
                    toastMsg(uploaded + ' fichier(s) importé(s)');
                }
                return Promise.resolve();
            }

            var batch = batches[batchIndex];
            var batchStart = batchIndex * UPLOAD_BATCH_SIZE;
            var firstName = batch[0] && batch[0].name ? batch[0].name : '…';
            var lastName = batch[batch.length - 1] && batch[batch.length - 1].name
                ? batch[batch.length - 1].name : firstName;

            setUploadProgress({
                title: 'Envoi des fichiers en cours…',
                detail: 'Lot ' + (batchIndex + 1) + ' / ' + batches.length + ' — « ' + firstName + ' »' +
                    (batch.length > 1 ? ' … « ' + lastName + ' »' : ''),
                count: uploaded + ' / ' + total + ' (ce lot : ' + batch.length + ' fichier(s))',
                percent: total ? Math.round((uploaded / total) * 100) : 0
            });

            return uploadBatch(batch, slotCode).then(function (res) {
                if (!res.ok || !res.json.success) {
                    var msg = res.json.message || ('HTTP ' + res.status);
                    errors.push('Lot ' + (batchIndex + 1) + ' (' + batch.length + ' fichier(s)) : ' + msg);
                } else {
                    var added = res.json.data || [];
                    uploaded += added.length;
                    missingExifTotal += added.filter(function (d) {
                        return d.mimeType && d.mimeType.indexOf('image/') === 0 && !d.captureDate;
                    }).length;
                }
                setUploadProgress({
                    title: 'Envoi des fichiers en cours…',
                    detail: 'Lot ' + (batchIndex + 1) + ' / ' + batches.length + ' terminé',
                    count: uploaded + ' / ' + total,
                    percent: total ? Math.round((uploaded / total) * 100) : 100
                });
                return processBatch(batchIndex + 1);
            });
        }

        return processBatch(0).catch(function (err) {
            showUploadOverlay(false);
            console.error('Doc-Hub upload:', err);
            showPersistentAlert(
                'Erreur réseau après ' + uploaded + ' / ' + total + ' fichier(s). ' +
                'Vérifiez que le serveur Node est démarré, puis réessayez.',
                'error'
            );
        });
    }

    document.getElementById('btn-upload').addEventListener('click', function () {
        var files = document.getElementById('upload-files').files;
        if (!files.length) {
            toastMsg('Choisissez au moins un fichier', true);
            return;
        }
        if (!currentProjectId) {
            toastMsg('Ouvrez un projet avant d’ajouter des documents', true);
            return;
        }
        var btn = document.getElementById('btn-upload');
        btn.disabled = true;
        btn.textContent = 'Envoi…';
        clearAlerts();

        var slotCode = document.getElementById('upload-slot').value;
        runBatchedUpload(files, slotCode).finally(function () {
            btn.disabled = false;
            btn.textContent = 'Envoyer';
        });
    });

    document.getElementById('btn-select-all-docs').addEventListener('click', function () {
        document.querySelectorAll('input[name="diff-doc"]').forEach(function (cb) { cb.checked = true; });
    });
    document.getElementById('btn-select-none-docs').addEventListener('click', function () {
        document.querySelectorAll('input[name="diff-doc"]').forEach(function (cb) { cb.checked = false; });
    });

    document.getElementById('btn-doc-select-all').addEventListener('click', function () {
        document.querySelectorAll('.doc-item-check').forEach(function (cb) { cb.checked = true; });
        updateDocDeleteToolbar();
    });
    document.getElementById('btn-doc-select-none').addEventListener('click', function () {
        document.querySelectorAll('.doc-item-check').forEach(function (cb) { cb.checked = false; });
        updateDocDeleteToolbar();
    });
    document.getElementById('btn-doc-delete-selected').addEventListener('click', function () {
        var ids = [];
        document.querySelectorAll('.doc-item-check:checked').forEach(function (cb) { ids.push(cb.value); });
        if (!ids.length) return;
        var label = ids.length === 1
            ? 'ce document'
            : ids.length + ' documents';
        if (!confirm('Supprimer définitivement ' + label + ' ?\n\nFichiers et liens de téléchargement associés seront retirés.')) return;
        var btn = document.getElementById('btn-doc-delete-selected');
        btn.disabled = true;
        deleteDocumentsByIds(ids).then(function (res) {
            if (!res.ok || !res.deleted) {
                toastMsg(res.message || 'Suppression impossible', true);
                return;
            }
            toastMsg(res.deleted + ' document(s) supprimé(s)');
            loadDocuments();
        }).finally(function () {
            updateDocDeleteToolbar();
        });
    });

    document.getElementById('btn-send-diff').addEventListener('click', function () {
        var email = document.getElementById('diff-email').value.trim();
        var subject = document.getElementById('diff-subject').value.trim();
        var message = document.getElementById('diff-message').value.trim();
        var ttl = parseInt(document.getElementById('diff-ttl').value, 10) || 7;
        var groupSingleLink = document.getElementById('diff-group-link').checked;
        var ids = [];
        document.querySelectorAll('input[name="diff-doc"]:checked').forEach(function (cb) {
            ids.push(cb.value);
        });
        if (!email || !subject) {
            toastMsg('Email et objet requis', true);
            return;
        }
        if (!ids.length) {
            toastMsg('Sélectionnez au moins un document', true);
            return;
        }
        var sendBtn = document.getElementById('btn-send-diff');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Envoi…';
        api('/projects/' + currentProjectId + '/diffusions', {
            method: 'POST',
            body: JSON.stringify({
                recipientEmail: email,
                subject: subject,
                message: message,
                documentIds: ids,
                linkTtlDays: ttl,
                groupSingleLink: groupSingleLink
            })
        }).then(function (res) {
            if (!res.ok) {
                toastMsg(res.json.message || 'Envoi échoué', true);
                return;
            }
            var mode = res.json.data.linkMode === 'bundle' ? '1 lien (archive ZIP)' : (res.json.data.linksCount + ' lien(s)');
            toastMsg('Envoi réussi — ' + mode);
            document.getElementById('diff-email').value = '';
            document.getElementById('diff-subject').value = '';
            document.getElementById('diff-message').value = '';
            closeEnvoiModal();
            setProjectTab('envois');
            loadDiffusions();
        }).finally(function () {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Envoyer le mail';
        });
    });

    loadTags();
    loadSlots();
    showList();
})();
