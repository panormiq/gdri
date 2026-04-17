<?php
/**
 * Barre d’onglets Configuration IA – Entité (Serveurs | LLMs | Droits).
 * Inclure après le header. Définir $ia_entity_current_tab = 'servers'|'llms'|'rights' avant l’include.
 */
$ia_tab = isset($ia_entity_current_tab) ? $ia_entity_current_tab : 'servers';
$servers_url = url('pages/modules/ia-entity-servers.php');
$llms_url    = url('pages/modules/ia-llms.php');
$rights_url  = url('pages/modules/ia-llm-rights.php');
?>
<div class="container">
    <ul class="nav nav-tabs mb-3" role="tablist">
        <li class="nav-item">
            <a class="nav-link <?= $ia_tab === 'servers' ? 'active' : '' ?>" href="<?= htmlspecialchars($servers_url) ?>">Serveurs</a>
        </li>
        <li class="nav-item">
            <a class="nav-link <?= $ia_tab === 'llms' ? 'active' : '' ?>" href="<?= htmlspecialchars($llms_url) ?>">LLMs</a>
        </li>
        <li class="nav-item">
            <a class="nav-link <?= $ia_tab === 'rights' ? 'active' : '' ?>" href="<?= htmlspecialchars($rights_url) ?>">Droits par utilisateur</a>
        </li>
    </ul>
</div>
