<?php
/**
 * Page informative — Module Prompt (lecture seule).
 */

if (!isset($page_title)) {
    $page_title = 'Module Prompt';
}
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>✍️ Module Prompt</h1>
            <p class="hero-description">
                Couche technique partagée : envoi de prompts et parsing des réponses IA pour tous les modules GDRI.
            </p>
        </div>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width: 800px;">
        <div class="card" style="padding: 1.5rem;">
            <h2 style="margin-top: 0;">Rôle</h2>
            <p>
                Ce module n'a pas d'écran de configuration dédié. Il fournit le service <strong>PromptService</strong>
                que les modules métier appellent pour communiquer avec les LLM via le <strong>module IA</strong>.
            </p>

            <h3>Fonctions</h3>
            <ul>
                <li>Envoi de prompt texte (<code>generate</code>)</li>
                <li>Envoi + parsing JSON (<code>generateJson</code>)</li>
                <li>Test de connexion IA (<code>testConnection</code>)</li>
            </ul>

            <h3>Modules qui l'utilisent</h3>
            <ul>
                <li>Facebook (analyse d'intentions, suggestions)</li>
                <li>Analyse d'intention</li>
                <li>Chat, UGAP, et futurs agents</li>
            </ul>

            <h3>Configuration LLM</h3>
            <p class="text-muted">
                Les modèles et serveurs IA se configurent dans le module <strong>Serveur IA / LLMs</strong>, pas ici.
            </p>
            <p>
                <a href="<?= url('pages/modules/ia-llms.php') ?>" class="btn btn-primary">📋 LLMs de l'entité</a>
                <a href="<?= url('pages/modules.php') ?>" class="btn btn-outline">← Modules</a>
            </p>

            <div id="promptHealth" class="alert" style="margin-top: 1.5rem; display: none;"></div>
        </div>
    </div>
</section>

<script>
(function () {
    const apiBase = <?= json_encode(rtrim(getApiBaseUrl(), '/')) ?>;
    const token = <?= json_encode(getJWTToken()) ?>;
    const box = document.getElementById('promptHealth');
    if (!apiBase || !token || !box) return;

    fetch(apiBase + '/prompt/health', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
            box.style.display = 'block';
            if (ok && d.success) {
                box.className = 'alert alert-success';
                box.textContent = '✅ Chaîne Prompt → IA opérationnelle. ' + (d.message || '');
            } else {
                box.className = 'alert alert-warning';
                box.textContent = '⚠️ ' + (d.message || 'Service IA indisponible ou non configuré.');
            }
        })
        .catch(() => {
            box.style.display = 'block';
            box.className = 'alert alert-warning';
            box.textContent = '⚠️ Impossible de vérifier la santé du module Prompt.';
        });
})();
</script>
