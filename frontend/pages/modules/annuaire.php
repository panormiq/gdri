<?php
/**
 * Point d'entrée Annuaire — organisations, services, contacts.
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';
require_once '../../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$annuaireMode = (isset($_GET['focus']) && $_GET['focus'] === 'identity') ? 'identity' : 'app';
if ($annuaireMode === 'identity' && !hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/modules/annuaire.php'));
}

if ($annuaireMode === 'identity' && canAccessEntityConsole()) {
    $_SESSION['gdri_workspace_mode'] = 'entity';
    $_SESSION['gdri_admin_nav_mode'] = 'entity';
} else {
    $_SESSION['gdri_workspace_mode'] = 'user';
}

$page_title = $annuaireMode === 'identity' ? 'Identité entreprise' : 'Annuaire';
$assetBase = '/modules/annuaire/frontend';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$annuaire_current_user_id = (string) ($_SESSION['user_id'] ?? '');
$annuaire_can_manage = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);

$annuaireIntro = $annuaireMode === 'identity'
    ? 'Coordonnées légales de votre entreprise (administration).'
    : ($annuaire_can_manage
        ? 'Boutique, client ou fournisseur à gauche — fiche et contacts à droite.'
        : 'Choisissez une boutique, un client ou un fournisseur pour gérer les contacts.');

ob_start();
?>
<button type="button" class="btn btn-outline btn-sm" id="annuaire-btn-refresh">Actualiser</button>
<?php
$annuaireActions = ob_get_clean();

require_once '../../includes/header.php';
renderConsoleLayoutStart($page_title, $annuaireIntro, ['actions' => $annuaireActions]);
?>

<link rel="stylesheet" href="<?= htmlspecialchars($assetBase) ?>/assets/css/annuaire.css?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/annuaire/frontend/assets/css/annuaire.css') ?>">

<div class="annuaire-shell<?= $annuaireMode === 'identity' ? ' annuaire-shell--identity' : '' ?>">
    <div class="annuaire-layout">
        <aside class="annuaire-sidebar annuaire-app-only">
            <div class="annuaire-sidebar-orgs">
                <div id="annuaire-entity-bar" class="annuaire-entity-bar annuaire-entity-bar--sidebar" hidden title="Double-clic pour les coordonnées légales"></div>
                <div id="annuaire-dropboxes" class="annuaire-dropboxes">
                    <div class="annuaire-empty">Chargement…</div>
                </div>
                <?php if ($annuaire_can_manage): ?>
                <div class="annuaire-sidebar-orgs__foot">
                    <button type="button" class="btn btn-primary btn-sm annuaire-sidebar-add-org" id="annuaire-btn-add-org" title="Nouvelle organisation">+ Organisation</button>
                </div>
                <?php endif; ?>
            </div>
        </aside>
        <main id="annuaire-main" class="annuaire-main">
            <div class="annuaire-empty annuaire-empty--prompt">
                <strong>Choisissez une organisation</strong><br>
                Ouvrez une box Boutique, Client ou Fournisseur à gauche.
            </div>
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
                <div class="annuaire-form-span-2" id="annuaire-org-boutiques-wrap" hidden>
                    <label>Boutiques liées</label>
                    <div id="annuaire-org-boutiques-checks" class="annuaire-boutique-checks"></div>
                    <p class="text-muted small">Laissez vide pour rendre visible dans toutes les boutiques.</p>
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
    jwt: <?= json_encode($jwt_token, JSON_UNESCAPED_UNICODE) ?>,
    mode: <?= json_encode($annuaireMode, JSON_UNESCAPED_UNICODE) ?>,
    currentUserId: <?= json_encode($annuaire_current_user_id, JSON_UNESCAPED_UNICODE) ?>,
    canManage: <?= $annuaire_can_manage ? 'true' : 'false' ?>,
    identityUrl: <?= json_encode(url('pages/modules/annuaire.php?focus=identity'), JSON_UNESCAPED_UNICODE) ?>,
    connectorHubUrl: <?= json_encode(url('pages/entity-connecteurs.php'), JSON_UNESCAPED_UNICODE) ?>,
    connectorUrls: {
        'mail-in': <?= json_encode(url('pages/modules/mail-config.php?module=mail'), JSON_UNESCAPED_UNICODE) ?>,
        'mail-out': <?= json_encode(url('pages/modules/mail-config.php?module=mail'), JSON_UNESCAPED_UNICODE) ?>,
        'facebook': <?= json_encode(url('pages/modules/connector-instances.php?connector=facebook'), JSON_UNESCAPED_UNICODE) ?>
    }
};
</script>
<script src="<?= htmlspecialchars($assetBase) ?>/assets/js/apiCall.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/annuaire/frontend/assets/js/apiCall.js') ?>"></script>
<script src="<?= htmlspecialchars($assetBase) ?>/assets/js/annuaire-app.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/annuaire/frontend/assets/js/annuaire-app.js') ?>"></script>

<?php
renderConsoleLayoutEnd();
require_once '../../includes/footer.php';
