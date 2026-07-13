<?php
/**
 * Point d'entrée Annuaire — organisations, services, contacts.
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Annuaire';
$assetBase = '/modules/annuaire/frontend';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');

require_once '../../includes/header.php';
?>

<link rel="stylesheet" href="<?= htmlspecialchars($assetBase) ?>/assets/css/annuaire.css?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/annuaire/frontend/assets/css/annuaire.css') ?>">

<div class="annuaire-shell">
    <div class="annuaire-topbar">
        <h1>Annuaire</h1>
        <div class="d-flex flex-wrap gap-2 align-items-center">
            <span id="annuaire-gderpi-badge" class="badge bg-secondary">GDERPI …</span>
            <button type="button" class="btn btn-outline btn-sm" id="annuaire-btn-refresh">Actualiser</button>
            <button type="button" class="btn btn-outline btn-sm" id="annuaire-btn-import-gderpi">Importer GDERPI</button>
            <button type="button" class="btn btn-primary btn-sm" id="annuaire-btn-add-org">+ Entité</button>
            <a href="<?= url('pages/modules.php') ?>" class="btn btn-outline btn-sm">← Applications</a>
        </div>
    </div>

    <div class="annuaire-layout">
        <aside class="annuaire-sidebar">
            <div class="annuaire-sidebar-filters">
                <button type="button" class="annuaire-filter-btn active" data-annuaire-scope="">Tous</button>
                <button type="button" class="annuaire-filter-btn" data-annuaire-scope="interne">Internes</button>
                <button type="button" class="annuaire-filter-btn" data-annuaire-role="boutique">Boutiques</button>
                <button type="button" class="annuaire-filter-btn" data-annuaire-scope="externe">Externes</button>
            </div>
            <div class="annuaire-sidebar-help">
                <strong>Votre structure</strong>
                <p><span class="annuaire-kind-badge annuaire-kind-badge--boutique">Boutique</span> — votre entreprise opérationnelle (GDERPI, SIRET, contacts)</p>
                <p>Une boutique = une entité dans l'annuaire. Pas de doublon avec un « siège » séparé.</p>
                <p>Import : <em>Importer GDERPI</em> ou création dans GDERPI paramétrage.</p>
            </div>
            <div class="p-2">
                <input type="search" id="annuaire-search" class="form-control form-control-sm" placeholder="Rechercher…">
            </div>
            <div id="annuaire-org-list" class="annuaire-org-list">
                <div class="annuaire-empty">Chargement…</div>
            </div>
        </aside>
        <main id="annuaire-main" class="annuaire-main">
            <div class="annuaire-empty">Sélectionnez une organisation</div>
        </main>
    </div>
</div>

<div id="annuaire-org-modal" class="annuaire-modal" hidden aria-hidden="true">
    <div class="annuaire-modal-backdrop" data-annuaire-modal-close></div>
    <div class="annuaire-modal-dialog" role="dialog" aria-labelledby="annuaire-org-modal-title">
        <div class="annuaire-modal-header">
            <h2 id="annuaire-org-modal-title">Organisation</h2>
            <button type="button" class="annuaire-modal-close" data-annuaire-modal-close aria-label="Fermer">×</button>
        </div>
        <form id="annuaire-org-form" class="annuaire-modal-body">
            <input type="hidden" id="annuaire-org-edit-id" value="">
            <div class="annuaire-form-grid">
                <div class="annuaire-form-span-2">
                    <label for="annuaire-org-raison">Raison sociale / nom *</label>
                    <input type="text" id="annuaire-org-raison" required>
                </div>
                <div>
                    <label for="annuaire-org-type">Type</label>
                    <select id="annuaire-org-type">
                        <option value="entreprise">Entreprise</option>
                        <option value="particulier">Particulier</option>
                    </select>
                </div>
                <div>
                    <label for="annuaire-org-scope">Périmètre</label>
                    <select id="annuaire-org-scope">
                        <option value="externe">Externe (client, fournisseur…)</option>
                        <option value="interne">Interne (collaborateurs)</option>
                    </select>
                </div>
                <div class="annuaire-form-span-2" id="annuaire-org-roles-wrap">
                    <label>Rôles</label>
                    <div class="annuaire-role-checks">
                        <label><input type="checkbox" name="annuaire-org-role" value="prospect"> Prospect</label>
                        <label><input type="checkbox" name="annuaire-org-role" value="client"> Client</label>
                        <label><input type="checkbox" name="annuaire-org-role" value="fournisseur"> Fournisseur</label>
                        <label><input type="checkbox" name="annuaire-org-role" value="partenaire"> Partenaire</label>
                        <label><input type="checkbox" name="annuaire-org-role" value="interne"> Interne</label>
                    </div>
                </div>
                <div><label for="annuaire-org-siret">SIRET</label><input type="text" id="annuaire-org-siret"></div>
                <div><label for="annuaire-org-email">Email</label><input type="email" id="annuaire-org-email"></div>
                <div><label for="annuaire-org-tel">Téléphone</label><input type="text" id="annuaire-org-tel"></div>
                <div><label for="annuaire-org-web">Site web</label><input type="url" id="annuaire-org-web"></div>
                <div id="annuaire-org-identity-extra" class="annuaire-form-span-2 annuaire-form-grid" hidden>
                    <div class="annuaire-form-span-2" style="grid-column:1/-1;margin-top:4px;">
                        <strong>Identité légale (votre entreprise)</strong>
                    </div>
                    <div class="annuaire-form-span-2" id="annuaire-org-primary-wrap" hidden>
                        <label class="annuaire-field__check" for="annuaire-org-primary">
                            <input type="checkbox" id="annuaire-org-primary"> Boutique / entité principale (utilisée pour UGAP et la fiche GDRI)
                        </label>
                    </div>
                    <div><label for="annuaire-org-forme">Forme juridique</label><input type="text" id="annuaire-org-forme" placeholder="SARL, SAS…"></div>
                    <div><label for="annuaire-org-tva">N° TVA intracommunautaire</label><input type="text" id="annuaire-org-tva"></div>
                    <div><label for="annuaire-org-rcs">RCS</label><input type="text" id="annuaire-org-rcs"></div>
                    <div><label for="annuaire-org-capital">Capital social</label><input type="text" id="annuaire-org-capital"></div>
                    <div class="annuaire-form-span-2"><label for="annuaire-org-adresse">Adresse</label><input type="text" id="annuaire-org-adresse"></div>
                    <div class="annuaire-form-span-2"><label for="annuaire-org-adresse2">Complément d'adresse</label><input type="text" id="annuaire-org-adresse2"></div>
                    <div><label for="annuaire-org-cp">Code postal</label><input type="text" id="annuaire-org-cp"></div>
                    <div><label for="annuaire-org-ville">Ville</label><input type="text" id="annuaire-org-ville"></div>
                    <div><label for="annuaire-org-pays">Pays</label><input type="text" id="annuaire-org-pays" value="France"></div>
                </div>
                <div class="annuaire-form-span-2">
                    <label for="annuaire-org-notes">Notes</label>
                    <textarea id="annuaire-org-notes" rows="3"></textarea>
                </div>
            </div>
            <p class="annuaire-modal-hint text-muted small" id="annuaire-org-modal-hint"></p>
            <div class="annuaire-modal-footer">
                <button type="button" class="btn btn-outline btn-sm" data-annuaire-modal-close>Annuler</button>
                <button type="submit" class="btn btn-primary btn-sm">Enregistrer</button>
            </div>
        </form>
    </div>
</div>

<script>
window.ANNUAIRE_CONFIG = {
    apiBase: <?= json_encode($api_base_url, JSON_UNESCAPED_UNICODE) ?>,
    jwt: <?= json_encode($jwt_token, JSON_UNESCAPED_UNICODE) ?>
};
</script>
<script src="<?= htmlspecialchars($assetBase) ?>/assets/js/apiCall.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/annuaire/frontend/assets/js/apiCall.js') ?>"></script>
<script src="<?= htmlspecialchars($assetBase) ?>/assets/js/annuaire-app.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/annuaire/frontend/assets/js/annuaire-app.js') ?>"></script>

<?php require_once '../../includes/footer.php'; ?>
