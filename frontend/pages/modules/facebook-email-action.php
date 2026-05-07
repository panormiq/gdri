<?php
require_once '../../config/config.php';
require_once '../../includes/functions.php';
$api_base_url = rtrim(getApiBaseUrl(), '/');
$token = isset($_GET['token']) ? (string) $_GET['token'] : '';
$default_action = isset($_GET['action']) ? (string) $_GET['action'] : 'reply';
?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Action Facebook email</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f7f9fc; margin: 0; padding: 20px; color: #1f2937; }
        .card { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; }
        .row { margin-bottom: 12px; }
        .meta { color: #6b7280; font-size: 13px; }
        .msg { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; white-space: pre-wrap; }
        .btn { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 8px 12px; cursor: pointer; }
        .btn-primary { background: #0d6efd; border-color: #0d6efd; color: #fff; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        textarea, select { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; }
        .hidden { display: none; }
        .ok { color: #0f766e; }
        .err { color: #b91c1c; }
    </style>
</head>
<body>
<div class="card">
    <h2 style="margin-top:0;">Action rapide Facebook</h2>
    <div id="status" class="row meta">Chargement…</div>
    <div id="content" class="hidden">
        <div class="row meta" id="authorDate"></div>
        <div class="row msg" id="messageText"></div>
        <div class="row" id="actionButtonsRow">
            <button id="btnReply" class="btn btn-primary">Répondre avec l'IA</button>
            <button id="btnCorrect" class="btn">Corriger l'analyse</button>
        </div>
        <div id="replyBox" class="row hidden">
            <label>Suggestion IA</label>
            <textarea id="replySuggestion" rows="5"></textarea>
            <div style="margin-top:8px;">
                <button id="btnSendReply" class="btn btn-primary">Envoyer la réponse</button>
            </div>
        </div>
        <div id="correctBox" class="row hidden">
            <label>Analyse actuelle (rappel)</label>
            <div id="analysisSummary" class="msg" style="margin-bottom:8px;"></div>
            <div id="analysisFormatted" class="msg" style="margin-bottom:10px;"></div>
            <label>Type de correction</label>
            <select id="correctionType">
                <option value="urgency_false_positive">Faux urgent</option>
                <option value="urgency_false_negative">Urgent non détecté</option>
                <option value="wrong_intention">Mauvaise intention</option>
                <option value="other" selected>Autre</option>
            </select>
            <label style="margin-top:8px;display:block;">Priorité attendue (optionnel)</label>
            <select id="expectedPriority">
                <option value="">Non précisée</option>
                <option value="immediate">Immédiate</option>
                <option value="daily">Journalière</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
            </select>
            <label style="margin-top:8px;display:block;">Pourquoi l'analyse est incorrecte ?</label>
            <textarea id="reason" rows="4" placeholder="Expliquez la correction..."></textarea>
            <div style="margin-top:8px;">
                <button id="btnSubmitCorrection" class="btn btn-primary">Envoyer la correction</button>
            </div>
        </div>
    </div>
</div>
<script>
(function() {
    var API_BASE = <?= json_encode($api_base_url) ?>;
    var token = <?= json_encode($token) ?>;
    var defaultAction = <?= json_encode($default_action) ?>;
    var statusEl = document.getElementById('status');
    var contentEl = document.getElementById('content');
    var messageTextEl = document.getElementById('messageText');
    var authorDateEl = document.getElementById('authorDate');
    var replyBox = document.getElementById('replyBox');
    var correctBox = document.getElementById('correctBox');
    var actionButtonsRow = document.getElementById('actionButtonsRow');
    var analysisSummaryEl = document.getElementById('analysisSummary');
    var analysisFormattedEl = document.getElementById('analysisFormatted');

    function setStatus(text, cls) {
        statusEl.className = 'row meta ' + (cls || '');
        statusEl.textContent = text;
    }

    if (!token) {
        setStatus('Lien invalide: token manquant', 'err');
        return;
    }

    function triggerReplySuggestion() {
        setStatus('Génération de la réponse IA…');
        fetch(API_BASE + '/facebook/email-actions/' + encodeURIComponent(token) + '/reply-suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        }).then(function(r){ return r.json(); }).then(function(data){
            if (!data || !data.success) throw new Error((data && data.message) || 'Erreur');
            document.getElementById('replySuggestion').value = data.suggestion || '';
            replyBox.classList.remove('hidden');
            correctBox.classList.add('hidden');
            setStatus('Réponse IA générée. Vérifiez puis cliquez sur "Envoyer la réponse".', 'ok');
        }).catch(function(err){
            setStatus('Erreur: ' + err.message, 'err');
        });
    }

    fetch(API_BASE + '/facebook/email-actions/' + encodeURIComponent(token))
        .then(function(r){ return r.json(); })
        .then(function(data){
            if (!data || !data.success) throw new Error((data && data.message) || 'Erreur de chargement');
            var msg = data.message || {};
            var action = (data.payload && data.payload.action) ? String(data.payload.action) : '';
            var d = msg.created_time ? new Date(msg.created_time).toLocaleString('fr-FR') : '';
            authorDateEl.textContent = (msg.author && msg.author.name ? msg.author.name : 'Utilisateur') + (d ? ' · ' + d : '');
            messageTextEl.textContent = msg.text || '(message vide)';
            var intentions = Array.isArray(msg.intentions) ? msg.intentions : [];
            if (intentions.length > 0) {
                var labels = intentions.map(function(i) {
                    var name = (i && (i.name || i.category || i.label)) ? String(i.name || i.category || i.label) : 'Intention';
                    var pr = (i && (i.priority || i.priorite)) ? String(i.priority || i.priorite) : '';
                    return pr ? (name + ' [' + pr + ']') : name;
                });
                analysisSummaryEl.textContent = labels.join(' | ');
            } else {
                analysisSummaryEl.textContent = 'Aucune intention détectée.';
            }
            var details = msg.analysis_details || {};
            var analyses = Array.isArray(details.analyses) ? details.analyses : [];
            var sourceMessage = String(msg.text || '').trim().toLowerCase();
            if (analyses.length > 1 && sourceMessage) {
                var matching = analyses.filter(function(a) {
                    var am = String((a && a.message) || '').trim().toLowerCase();
                    return am && (am === sourceMessage || sourceMessage.indexOf(am) !== -1 || am.indexOf(sourceMessage) !== -1);
                });
                if (matching.length > 0) {
                    analyses = matching.slice(0, 1);
                } else {
                    analyses = [analyses[0]];
                }
            } else if (analyses.length > 1) {
                analyses = [analyses[0]];
            }
            if (!analyses.length && intentions.length) {
                analyses = [{ intentions: intentions, resume: '' }];
            }
            var blocks = [];
            analyses.forEach(function(a, idx) {
                var row = '<div style="padding:8px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:8px;background:#fff;">';
                row += '<div style="font-weight:600;margin-bottom:4px;color:#0d6efd;">Analyse ' + (idx + 1) + '</div>';
                var ints = Array.isArray(a.intentions) ? a.intentions : [];
                if (!ints.length) {
                    row += '<div style="font-size:13px;color:#6b7280;">Aucune intention détectée.</div>';
                } else {
                    ints.forEach(function(it) {
                        var n = (it && (it.name || it.category || it.label)) ? String(it.name || it.category || it.label) : 'Intention';
                        var c = (it && (it.certainty !== undefined && it.certainty !== null)) ? String(it.certainty) : '';
                        var p = (it && (it.priority || it.priorite)) ? String(it.priority || it.priorite) : '';
                        var reason = (it && (it.reason || it.raison || it.justification || it.explanation)) ? String(it.reason || it.raison || it.justification || it.explanation) : '';
                        row += '<div style="margin-bottom:6px;"><strong>' + n + '</strong>';
                        if (c) row += ' · Confiance: ' + c + '%';
                        if (p) row += ' · Priorité: ' + p;
                        row += '</div>';
                        if (reason) row += '<div style="font-size:13px;color:#4b5563;margin-bottom:6px;">' + reason + '</div>';
                    });
                }
                var resume = (a && (a.resume || a.summary)) ? String(a.resume || a.summary) : '';
                if (resume) {
                    row += '<div style="margin-top:6px;font-size:13px;"><strong>Résumé :</strong> ' + resume + '</div>';
                }
                row += '</div>';
                blocks.push(row);
            });
            analysisFormattedEl.innerHTML = blocks.length ? blocks.join('') : '<div style="font-size:13px;color:#6b7280;">Aucune donnée d’analyse disponible.</div>';
            contentEl.classList.remove('hidden');
            setStatus('Lien valide. Choisissez une action.', 'ok');
            if (action === 'reply_with_ai') {
                if (actionButtonsRow) actionButtonsRow.classList.add('hidden');
                correctBox.classList.add('hidden');
                triggerReplySuggestion();
            } else if (action === 'correct_analysis') {
                if (actionButtonsRow) actionButtonsRow.classList.add('hidden');
                correctBox.classList.remove('hidden');
                replyBox.classList.add('hidden');
            } else if (defaultAction === 'correct') {
                correctBox.classList.remove('hidden');
            }
        })
        .catch(function(err){
            setStatus('Erreur: ' + err.message, 'err');
        });

    document.getElementById('btnReply').addEventListener('click', function() {
        triggerReplySuggestion();
    });

    document.getElementById('btnCorrect').addEventListener('click', function() {
        correctBox.classList.remove('hidden');
        replyBox.classList.add('hidden');
    });

    document.getElementById('btnSendReply').addEventListener('click', function() {
        var txt = (document.getElementById('replySuggestion').value || '').trim();
        if (!txt) {
            setStatus('Aucune réponse à envoyer. Générez d’abord une suggestion.', 'err');
            return;
        }
        setStatus('Envoi de la réponse vers Facebook…');
        fetch(API_BASE + '/facebook/email-actions/' + encodeURIComponent(token) + '/send-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: txt })
        }).then(function(r){ return r.json(); }).then(function(data){
            if (!data || !data.success) throw new Error((data && data.message) || 'Erreur d’envoi');
            setStatus('Réponse envoyée sur Facebook. Ce lien est maintenant consommé.', 'ok');
            document.getElementById('btnSendReply').disabled = true;
            document.getElementById('btnReply').disabled = true;
            document.getElementById('btnCorrect').disabled = true;
        }).catch(function(err){
            setStatus('Erreur: ' + err.message, 'err');
        });
    });

    document.getElementById('btnSubmitCorrection').addEventListener('click', function() {
        var reason = document.getElementById('reason').value.trim();
        if (reason.length < 5) {
            setStatus('Veuillez préciser un motif (min 5 caractères).', 'err');
            return;
        }
        setStatus('Envoi de la correction…');
        fetch(API_BASE + '/facebook/email-actions/' + encodeURIComponent(token) + '/correct-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reason: reason,
                correctionType: document.getElementById('correctionType').value,
                expectedPriority: document.getElementById('expectedPriority').value
            })
        }).then(function(r){ return r.json(); }).then(function(data){
            if (!data || !data.success) throw new Error((data && data.message) || 'Erreur');
            setStatus('Correction enregistrée. Ce lien est maintenant consommé.', 'ok');
        }).catch(function(err){
            setStatus('Erreur: ' + err.message, 'err');
        });
    });
})();
</script>
</body>
</html>
