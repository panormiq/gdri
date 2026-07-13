<?php
/**
 * Point d'entrée GDERPI — backoffice pleine largeur, dashboard + vues LC.
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'GDERPI';
$canWriteGderpi = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY) || hasRole(ROLE_USER_ENTITY);
$gderpiEntrepriseId = (string)($_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? ''));
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$gderpiAssetBase = '/modules/gderpi/frontend';

require_once '../../includes/header.php';
?>

<link rel="stylesheet" href="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/css/gderpi.css?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/css/gderpi.css') ?>">

<div class="gderpi-shell">
    <div class="gderpi-topbar">
        <h1>GDERPI</h1>
        <a href="<?= url('pages/modules.php') ?>" class="btn btn-outline btn-sm">← Applications</a>
    </div>

    <div class="gderpi-layout">
        <nav class="gderpi-nav" aria-label="Navigation GDERPI">
            <button type="button" class="gderpi-nav-btn active" data-gderpi-nav="dashboard">Tableau de bord</button>
            <button type="button" class="gderpi-nav-btn" data-gderpi-nav="articles">Articles</button>
            <button type="button" class="gderpi-nav-btn" data-gderpi-nav="categories">Catégories</button>
            <button type="button" class="gderpi-nav-btn" data-gderpi-nav="clients">Clients</button>
            <button type="button" class="gderpi-nav-btn" data-gderpi-nav="fournisseurs">Fournisseurs</button>
            <button type="button" class="gderpi-nav-btn" data-gderpi-nav="devis">Devis</button>
            <button type="button" class="gderpi-nav-btn" data-gderpi-nav="commandes">Commandes client</button>
            <button type="button" class="gderpi-nav-btn" data-gderpi-nav="bons-livraison">Bons de livraison</button>
            <button type="button" class="gderpi-nav-btn" data-gderpi-nav="achats">Commandes fournisseur</button>
            <button type="button" class="gderpi-nav-btn" data-gderpi-nav="facturation">Facturation</button>
            <div class="gderpi-nav-group" id="gderpi-nav-group-configuration">
                <button type="button" class="gderpi-nav-btn gderpi-nav-btn--parent" data-gderpi-nav="configuration" aria-expanded="false">
                    <span>Configuration</span>
                    <span class="gderpi-nav-chevron" aria-hidden="true"></span>
                </button>
                <div class="gderpi-nav-sub" hidden>
                    <div class="gderpi-nav-group gderpi-nav-group--nested" id="gderpi-nav-group-config-boutiques">
                        <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--subparent" data-gderpi-nav="configuration" data-gderpi-config-tab="boutiques" aria-expanded="false">
                            <span>Boutiques</span>
                            <span class="gderpi-nav-chevron" aria-hidden="true"></span>
                        </button>
                        <div class="gderpi-nav-sub gderpi-nav-sub--nested" hidden>
                            <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--sub-nested" data-gderpi-nav="configuration" data-gderpi-config-tab="boutiques">Liste</button>
                            <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--sub-nested" data-gderpi-nav="configuration" data-gderpi-config-tab="boutiques-cgv">CGV</button>
                        </div>
                    </div>
                    <div class="gderpi-nav-group gderpi-nav-group--nested" id="gderpi-nav-group-config-articles">
                        <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--subparent" data-gderpi-nav="configuration" data-gderpi-config-tab="articles" aria-expanded="false">
                            <span>Articles</span>
                            <span class="gderpi-nav-chevron" aria-hidden="true"></span>
                        </button>
                        <div class="gderpi-nav-sub gderpi-nav-sub--nested" hidden>
                            <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--sub-nested" data-gderpi-nav="configuration" data-gderpi-config-tab="unites">Unités</button>
                        </div>
                    </div>
                    <div class="gderpi-nav-group gderpi-nav-group--nested" id="gderpi-nav-group-config-clients">
                        <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--subparent" data-gderpi-nav="configuration" data-gderpi-config-tab="services" aria-expanded="false">
                            <span>Clients</span>
                            <span class="gderpi-nav-chevron" aria-hidden="true"></span>
                        </button>
                        <div class="gderpi-nav-sub gderpi-nav-sub--nested" hidden>
                            <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--sub-nested" data-gderpi-nav="configuration" data-gderpi-config-tab="services">Services</button>
                        </div>
                    </div>
                    <div class="gderpi-nav-group gderpi-nav-group--nested" id="gderpi-nav-group-config-mail">
                        <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--subparent" data-gderpi-nav="configuration" data-gderpi-config-tab="mail-accounts" aria-expanded="false">
                            <span>Mail</span>
                            <span class="gderpi-nav-chevron" aria-hidden="true"></span>
                        </button>
                        <div class="gderpi-nav-sub gderpi-nav-sub--nested" hidden>
                            <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--sub-nested" data-gderpi-nav="configuration" data-gderpi-config-tab="mail-accounts">Comptes</button>
                            <button type="button" class="gderpi-nav-btn gderpi-nav-btn--sub gderpi-nav-btn--sub-nested" data-gderpi-nav="configuration" data-gderpi-config-tab="mail-devis">Modèles d'e-mail</button>
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <main class="gderpi-main">
            <div id="gderpi-status" class="alert alert-secondary gderpi-status-inline">Chargement…</div>

            <!-- Dashboard -->
            <section id="gderpi-panel-dashboard" class="gderpi-main-panel">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h2 style="margin:0;font-size:1.15rem;">Tableau de bord</h2>
                    <button type="button" id="gderpi-dashboard-refresh" class="btn btn-outline btn-sm">Actualiser</button>
                </div>

                <div class="gderpi-dash-grid">
                    <div class="gderpi-kpi"><div class="gderpi-kpi__label">Boutiques actives</div><div class="gderpi-kpi__value" id="gderpi-kpi-boutiques">—</div></div>
                    <div class="gderpi-kpi"><div class="gderpi-kpi__label">Articles</div><div class="gderpi-kpi__value" id="gderpi-kpi-articles">—</div></div>
                    <div class="gderpi-kpi"><div class="gderpi-kpi__label">Clients</div><div class="gderpi-kpi__value" id="gderpi-kpi-clients">—</div></div>
                    <div class="gderpi-kpi"><div class="gderpi-kpi__label">Fournisseurs</div><div class="gderpi-kpi__value" id="gderpi-kpi-fournisseurs">—</div></div>
                    <div class="gderpi-kpi"><div class="gderpi-kpi__label">Devis en attente</div><div class="gderpi-kpi__value" id="gderpi-kpi-devis">0</div></div>
                    <div class="gderpi-kpi"><div class="gderpi-kpi__label">Cmd. fournisseur</div><div class="gderpi-kpi__value" id="gderpi-kpi-cmd-fourn">0</div></div>
                    <div class="gderpi-kpi"><div class="gderpi-kpi__label">Facturation à faire</div><div class="gderpi-kpi__value" id="gderpi-kpi-facture">0</div></div>
                </div>

                <div class="gderpi-panel-card">
                    <h3 style="margin:0 0 0.75rem;font-size:1rem;">Tâches & suivi</h3>
                    <p class="text-muted small" style="margin-top:0;">Cliquez une tâche pour ouvrir la section concernée.</p>
                    <ul id="gderpi-dashboard-tasks" class="gderpi-task-list"></ul>
                </div>
            </section>

            <section id="gderpi-panel-articles" class="gderpi-main-panel" hidden>
                <div class="gderpi-vue-lc" data-gderpi-vue-lc="articles">
                    <div class="gderpi-vue-lc__header">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Articles</h3>
                            <p class="gderpi-vue-lc__desc">Catalogue produits, services et développement. Double-clic pour éditer.</p>
                        </div>
                        <?php if ($canWriteGderpi): ?>
                        <button type="button" class="btn btn-primary btn-sm" data-gderpi-lc-create="articles" aria-expanded="false">+ Nouvel article</button>
                        <?php endif; ?>
                    </div>
                    <?php if ($canWriteGderpi): ?>
                    <div class="gderpi-vue-lc__create-panel" data-gderpi-lc-create-panel="articles" hidden>
                        <form id="gderpi-article-form" class="gderpi-form">
                            <h4 id="gderpi-article-form-title">Nouvel article</h4>
                            <div class="gderpi-conditions-tabs" id="gderpi-article-tabs">
                                <div class="gderpi-conditions-tabs__nav" role="tablist">
                                    <button type="button" class="gderpi-conditions-tabs__btn active" data-gderpi-article-tab="general" role="tab" aria-selected="true">Général</button>
                                    <button type="button" class="gderpi-conditions-tabs__btn" data-gderpi-article-tab="fournisseurs" role="tab" aria-selected="false">Fournisseurs</button>
                                    <button type="button" class="gderpi-conditions-tabs__btn" data-gderpi-article-tab="tarifs" role="tab" aria-selected="false">Tarifs clients</button>
                                </div>

                                <div class="gderpi-conditions-tabs__panel" data-gderpi-article-panel="general" role="tabpanel">
                                    <div class="gderpi-form-grid">
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-article-type">Type</label>
                                            <select id="gderpi-article-type" class="form-control">
                                                <option value="produit">Produit</option>
                                                <option value="service">Service</option>
                                                <option value="developpement">Développement</option>
                                            </select>
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-article-ref">Référence interne</label>
                                            <input id="gderpi-article-ref" class="form-control" type="text">
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-article-libelle">Libellé <span class="gderpi-required">*</span></label>
                                            <input id="gderpi-article-libelle" class="form-control" type="text" required>
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-article-unite">Unité</label>
                                            <select id="gderpi-article-unite" class="form-control"></select>
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-article-prix">Prix vente HT (catalogue)</label>
                                            <input id="gderpi-article-prix" class="form-control" type="number" step="0.01" value="0">
                                        </div>
                                        <div class="gderpi-field gderpi-field--check" id="gderpi-article-prix-sur-devis-wrap">
                                            <label class="gderpi-field__check" for="gderpi-article-prix-sur-devis">
                                                <input id="gderpi-article-prix-sur-devis" type="checkbox"> Prix à saisir sur le devis
                                            </label>
                                            <p class="gderpi-field-hint">Le montant sera obligatoire à l'ajout au devis (évite un prix à 0 par oubli).</p>
                                        </div>
                                        <div class="gderpi-field gderpi-field--check" id="gderpi-article-gestion-stock-wrap">
                                            <label class="gderpi-field__check" for="gderpi-article-gestion-stock">
                                                <input id="gderpi-article-gestion-stock" type="checkbox"> Géré en stock (besoin d'achat à la commande)
                                            </label>
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-article-tva">TVA (%)</label>
                                            <input id="gderpi-article-tva" class="form-control" type="number" step="0.1" value="20">
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-article-node">Catégorie</label>
                                            <select id="gderpi-article-node" class="form-control"></select>
                                        </div>
                                        <div class="gderpi-field" id="gderpi-article-boutique-interne-wrap">
                                            <label class="gderpi-field__label" for="gderpi-article-boutique-interne">Boutique (approvisionnement interne)</label>
                                            <select id="gderpi-article-boutique-interne" class="form-control">
                                                <option value="">— Aucune —</option>
                                            </select>
                                            <p class="gderpi-field-hint">Optionnel — pour commander cet article depuis une autre boutique du groupe.</p>
                                        </div>
                                        <div class="gderpi-field gderpi-field--full">
                                            <span class="gderpi-field__label">Image produit / illustration</span>
                                            <div class="gderpi-image-upload">
                                                <div id="gderpi-article-image-preview" class="gderpi-image-upload__preview">
                                                    <span class="gderpi-image-upload__placeholder">Aucune image</span>
                                                </div>
                                                <div class="gderpi-image-upload__actions">
                                                    <input id="gderpi-article-image-file" class="gderpi-image-upload__file-native" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" tabindex="-1" aria-hidden="true">
                                                    <button type="button" id="gderpi-article-image-browse" class="btn btn-outline btn-sm">Choisir une image</button>
                                                    <span id="gderpi-article-image-filename" class="gderpi-image-upload__filename" aria-live="polite"></span>
                                                    <button type="button" id="gderpi-article-image-clear" class="btn btn-outline btn-sm">Retirer</button>
                                                </div>
                                                <span class="gderpi-image-upload__or">ou URL externe</span>
                                                <input id="gderpi-article-image-url" class="form-control" type="text" inputmode="url" placeholder="https://…" autocomplete="off">
                                                <input id="gderpi-article-image" type="hidden" value="">
                                            </div>
                                        </div>
                                        <div class="gderpi-field gderpi-field--full">
                                            <label class="gderpi-field__label" for="gderpi-article-desc">Description</label>
                                            <textarea id="gderpi-article-desc" class="form-control" rows="2"></textarea>
                                        </div>
                                        <div class="gderpi-field gderpi-field--full" id="gderpi-article-commentaire-wrap">
                                            <label class="gderpi-field__label" for="gderpi-article-commentaire">Commentaire (modèle devis)</label>
                                            <textarea id="gderpi-article-commentaire" class="form-control" rows="3" placeholder="Texte proposé par défaut sur les lignes de devis…"></textarea>
                                            <p class="gderpi-field-hint">Repris à la création du devis, modifiable ligne par ligne.</p>
                                        </div>
                                    </div>
                                </div>

                                <div class="gderpi-conditions-tabs__panel" data-gderpi-article-panel="fournisseurs" role="tabpanel" hidden>
                                    <div class="gderpi-client-sublist">
                                        <div class="gderpi-client-sublist__header">
                                            <p class="gderpi-field-hint" style="margin:0;">Fournisseurs externes — un principal (★) par article. La boutique interne se configure dans l'onglet Général.</p>
                                            <button type="button" id="gderpi-article-frs-add" class="btn btn-outline btn-sm">+ Fournisseur</button>
                                        </div>
                                        <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
                                            <table class="gderpi-vue-lc__table gderpi-client-sublist__table">
                                                <thead>
                                                    <tr>
                                                        <th style="width:2.5rem;"></th>
                                                        <th>Fournisseur</th>
                                                        <th>Réf.</th>
                                                        <th class="text-end">Prix achat HT</th>
                                                        <th class="text-end">MOQ</th>
                                                        <th class="text-end">Délai (j)</th>
                                                        <th></th>
                                                    </tr>
                                                </thead>
                                                <tbody id="gderpi-article-frs-tbody"></tbody>
                                            </table>
                                        </div>
                                        <p class="gderpi-field-hint">Double-clic pour modifier. Le fournisseur principal est utilisé par défaut sur les devis et commandes.</p>
                                    </div>
                                </div>

                                <div class="gderpi-conditions-tabs__panel" data-gderpi-article-panel="tarifs" role="tabpanel" hidden>
                                    <div class="gderpi-client-sublist">
                                        <div class="gderpi-client-sublist__header">
                                            <p class="gderpi-field-hint" style="margin:0;">Référence et prix de vente par client (sinon prix catalogue).</p>
                                            <button type="button" id="gderpi-article-tarif-add" class="btn btn-outline btn-sm">+ Tarif client</button>
                                        </div>
                                        <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
                                            <table class="gderpi-vue-lc__table gderpi-client-sublist__table">
                                                <thead>
                                                    <tr>
                                                        <th>Client</th>
                                                        <th>Réf. client</th>
                                                        <th class="text-end">Prix vente HT</th>
                                                        <th>Sur devis</th>
                                                        <th></th>
                                                    </tr>
                                                </thead>
                                                <tbody id="gderpi-article-tarifs-tbody"></tbody>
                                            </table>
                                        </div>
                                        <p class="gderpi-field-hint">Double-clic pour modifier. Intégrez manuellement les frais de port dans le prix si besoin.</p>
                                    </div>
                                </div>
                            </div>

                            <div class="gderpi-form-actions">
                                <button type="submit" id="gderpi-article-submit" class="btn btn-primary btn-sm">Créer l'article</button>
                                <button type="button" id="gderpi-article-cancel" class="btn btn-outline btn-sm">Annuler</button>
                            </div>
                        </form>
                    </div>
                    <?php endif; ?>
                    <div class="gderpi-vue-lc__list-header">Liste</div>
                    <div class="gderpi-vue-lc__toolbar">
                        <input type="search" class="form-control form-control-sm" data-gderpi-lc-search="articles" placeholder="Rechercher…" style="max-width:220px;">
                        <select id="gderpi-article-filter-type" class="form-control form-control-sm" style="max-width:140px;"><option value="">Tous types</option><option value="produit">Produit</option><option value="service">Service</option><option value="developpement">Développement</option></select>
                        <select id="gderpi-article-filter-node" class="form-control form-control-sm" style="max-width:200px;"></select>
                        <span class="gderpi-vue-lc__count" data-gderpi-lc-count="articles"></span>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table">
                            <thead><tr><th>Réf.</th><th>Libellé</th><th>Type</th><th>Unité</th><th class="text-end">Prix HT</th><th class="text-end">TVA</th><th></th></tr></thead>
                            <tbody data-gderpi-lc-tbody="articles"></tbody>
                        </table>
                    </div>
                </div>
                <div id="gderpi-article-frs-modal" class="gderpi-modal gderpi-modal--md" hidden>
                    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                        <div class="gderpi-modal__header">
                            <strong class="gderpi-modal__title" id="gderpi-article-frs-modal-title">Fournisseur</strong>
                            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close>Fermer</button>
                        </div>
                        <div class="gderpi-modal__body" data-gderpi-modal-body>
                            <form id="gderpi-article-frs-form" class="gderpi-form">
                                <div class="gderpi-form-grid">
                                    <div class="gderpi-field gderpi-field--full" id="gderpi-article-frs-fournisseur-wrap">
                                        <label class="gderpi-field__label" for="gderpi-article-frs-id">Fournisseur <span class="gderpi-required">*</span></label>
                                        <select id="gderpi-article-frs-id" class="form-control"><option value="">— Sélectionner —</option></select>
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-article-frs-ref">Réf. fournisseur</label>
                                        <input id="gderpi-article-frs-ref" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-article-frs-prix">Prix achat HT</label>
                                        <input id="gderpi-article-frs-prix" class="form-control" type="number" min="0" step="0.01">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-article-frs-moq">MOQ</label>
                                        <input id="gderpi-article-frs-moq" class="form-control" type="number" min="0" step="0.001">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-article-frs-delai">Délai (jours)</label>
                                        <input id="gderpi-article-frs-delai" class="form-control" type="number" min="0" step="1">
                                    </div>
                                    <div class="gderpi-field gderpi-field--check">
                                        <label class="gderpi-field__check" for="gderpi-article-frs-principal">
                                            <input id="gderpi-article-frs-principal" type="checkbox"> Fournisseur principal
                                        </label>
                                    </div>
                                    <div class="gderpi-field gderpi-field--full">
                                        <label class="gderpi-field__label" for="gderpi-article-frs-conditions">Conditions / certifications</label>
                                        <textarea id="gderpi-article-frs-conditions" class="form-control" rows="2"></textarea>
                                    </div>
                                </div>
                                <div class="gderpi-form-actions">
                                    <button type="submit" class="btn btn-primary btn-sm" id="gderpi-article-frs-save">Enregistrer</button>
                                    <button type="button" class="btn btn-outline btn-sm" id="gderpi-article-frs-cancel">Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                <div id="gderpi-article-tarif-modal" class="gderpi-modal gderpi-modal--md" hidden>
                    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                        <div class="gderpi-modal__header">
                            <strong class="gderpi-modal__title" id="gderpi-article-tarif-modal-title">Tarif client</strong>
                            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close>Fermer</button>
                        </div>
                        <div class="gderpi-modal__body" data-gderpi-modal-body>
                            <form id="gderpi-article-tarif-form" class="gderpi-form">
                                <div class="gderpi-form-grid">
                                    <div class="gderpi-field gderpi-field--full">
                                        <label class="gderpi-field__label" for="gderpi-article-tarif-client">Client <span class="gderpi-required">*</span></label>
                                        <select id="gderpi-article-tarif-client" class="form-control" required><option value="">— Sélectionner —</option></select>
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-article-tarif-ref">Réf. client</label>
                                        <input id="gderpi-article-tarif-ref" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-article-tarif-prix">Prix vente HT</label>
                                        <input id="gderpi-article-tarif-prix" class="form-control" type="number" min="0" step="0.01" placeholder="Catalogue si vide">
                                    </div>
                                    <div class="gderpi-field gderpi-field--check gderpi-field--full">
                                        <label class="gderpi-field__check" for="gderpi-article-tarif-sur-devis">
                                            <input id="gderpi-article-tarif-sur-devis" type="checkbox"> Prix à saisir sur le devis
                                        </label>
                                    </div>
                                </div>
                                <p class="gderpi-field-hint">Laissez le prix vide pour utiliser le prix catalogue. Intégrez les frais de port dans le prix si nécessaire.</p>
                                <div class="gderpi-form-actions">
                                    <button type="submit" class="btn btn-primary btn-sm" id="gderpi-article-tarif-save">Enregistrer</button>
                                    <button type="button" class="btn btn-outline btn-sm" id="gderpi-article-tarif-cancel">Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Catégories -->
            <section id="gderpi-panel-categories" class="gderpi-main-panel" hidden>
                <div class="gderpi-vue-lc" data-gderpi-vue-lc="categories">
                    <div class="gderpi-vue-lc__header">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Catégories</h3>
                            <p class="gderpi-vue-lc__desc">Arbre compatible nœuds UGAP (nodes[]).</p>
                        </div>
                        <?php if ($canWriteGderpi): ?>
                        <button type="button" class="btn btn-primary btn-sm" data-gderpi-lc-create="categories" aria-expanded="false">+ Nouvelle catégorie</button>
                        <?php endif; ?>
                    </div>
                    <?php if ($canWriteGderpi): ?>
                    <div class="gderpi-vue-lc__create-panel" data-gderpi-lc-create-panel="categories" hidden>
                        <form id="gderpi-node-form" class="gderpi-form">
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-node-label">Libellé <span class="gderpi-required">*</span></label>
                                    <input id="gderpi-node-label" class="form-control" type="text" required>
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-node-parent">ID parent (optionnel)</label>
                                    <input id="gderpi-node-parent" class="form-control" type="text" placeholder="Cliquer un nœud dans l'arbre">
                                </div>
                            </div>
                            <div class="gderpi-form-actions">
                                <button type="submit" class="btn btn-primary btn-sm">Créer la catégorie</button>
                            </div>
                        </form>
                    </div>
                    <?php endif; ?>
                    <div class="gderpi-cat-layout" style="padding:1rem;">
                        <div>
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                                <strong>Arbre</strong>
                                <button type="button" id="gderpi-nodes-reload" class="btn btn-outline btn-sm">Actualiser</button>
                            </div>
                            <div id="gderpi-nodes-tree"></div>
                        </div>
                        <div class="text-muted small" style="padding:1rem;background:#f8fafc;border-radius:8px;">
                            <p><strong>Astuce :</strong> cliquez un nœud pour filtrer les articles. Le parent est pré-rempli pour une sous-catégorie.</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Clients LC -->
            <section id="gderpi-panel-clients" class="gderpi-main-panel" hidden>
                <div class="gderpi-vue-lc" data-gderpi-vue-lc="clients">
                    <div class="gderpi-vue-lc__header">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Clients</h3>
                            <p class="gderpi-vue-lc__desc">Identité et contacts synchronisés avec le module <strong>Annuaire</strong>. Adresses et conditions commerciales restent ici.</p>
                        </div>
                        <?php if ($canWriteGderpi): ?>
                        <button type="button" class="btn btn-primary btn-sm" data-gderpi-lc-create="clients" aria-expanded="false">+ Nouveau client</button>
                        <?php endif; ?>
                    </div>
                    <?php if ($canWriteGderpi): ?>
                    <div class="gderpi-vue-lc__create-panel" data-gderpi-lc-create-panel="clients" hidden>
                        <form id="gderpi-client-form" class="gderpi-form">
                            <h4 id="gderpi-client-form-title">Nouveau client</h4>
                            <div id="gderpi-client-annuaire-notice" class="alert alert-info gderpi-annuaire-notice" hidden></div>

                            <div class="gderpi-form-section-title">Identité</div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-client-type">Type</label>
                                    <select id="gderpi-client-type" class="form-control"><option value="entreprise">Entreprise</option><option value="particulier">Particulier</option></select>
                                </div>

                                <div class="gderpi-field gderpi-field--entreprise gderpi-field--full" id="gderpi-client-rs-wrap">
                                    <label class="gderpi-field__label" for="gderpi-client-rs">Raison sociale <span class="gderpi-required">*</span></label>
                                    <input id="gderpi-client-rs" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field gderpi-field--entreprise">
                                    <label class="gderpi-field__label" for="gderpi-client-siret">SIRET</label>
                                    <input id="gderpi-client-siret" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field gderpi-field--entreprise">
                                    <label class="gderpi-field__label" for="gderpi-client-tva">N° TVA intracommunautaire</label>
                                    <input id="gderpi-client-tva" class="form-control" type="text" placeholder="FR…">
                                </div>
                                <div class="gderpi-field gderpi-field--entreprise gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-client-web">Site web</label>
                                    <input id="gderpi-client-web" class="form-control" type="text" inputmode="url" placeholder="https://">
                                </div>

                                <div class="gderpi-field gderpi-field--particulier">
                                    <label class="gderpi-field__label" for="gderpi-client-prenom">Prénom</label>
                                    <input id="gderpi-client-prenom" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field gderpi-field--particulier">
                                    <label class="gderpi-field__label" for="gderpi-client-nom">Nom</label>
                                    <input id="gderpi-client-nom" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field gderpi-field--particulier">
                                    <label class="gderpi-field__label" for="gderpi-client-email">Email</label>
                                    <input id="gderpi-client-email" class="form-control" type="email">
                                </div>
                                <div class="gderpi-field gderpi-field--particulier">
                                    <label class="gderpi-field__label" for="gderpi-client-tel">Téléphone</label>
                                    <input id="gderpi-client-tel" class="form-control" type="text">
                                </div>
                            </div>

                            <div id="gderpi-client-contacts-section">
                                <div class="gderpi-client-sublist">
                                    <div class="gderpi-client-sublist__header">
                                        <div class="gderpi-form-section-title" style="margin:0;border:0;padding:0;">Contacts</div>
                                        <?php if ($canWriteGderpi): ?>
                                        <button type="button" id="gderpi-client-contact-add" class="btn btn-outline btn-sm">+ Contact</button>
                                        <?php endif; ?>
                                    </div>
                                    <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
                                        <table class="gderpi-vue-lc__table gderpi-client-sublist__table">
                                            <thead>
                                                <tr>
                                                    <th></th>
                                                    <th>Nom</th>
                                                    <th>Service</th>
                                                    <th>Fonction</th>
                                                    <th>Email</th>
                                                    <th>Tél.</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody id="gderpi-client-contacts-tbody"></tbody>
                                        </table>
                                    </div>
                                    <p class="gderpi-field-hint gderpi-client-contacts-hint">Double-clic pour modifier — enregistrement dans l'Annuaire. Les <strong>services</strong> sont paramétrés dans Configuration → Clients → Services.</p>
                                </div>
                            </div>

                            <div class="gderpi-client-sublist">
                                <div class="gderpi-client-sublist__header">
                                    <div class="gderpi-form-section-title" style="margin:0;border:0;padding:0;">Adresses</div>
                                    <?php if ($canWriteGderpi): ?>
                                    <button type="button" id="gderpi-client-adresse-add" class="btn btn-outline btn-sm">+ Adresse</button>
                                    <?php endif; ?>
                                </div>
                                <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
                                    <table class="gderpi-vue-lc__table gderpi-client-sublist__table">
                                        <thead>
                                            <tr>
                                                <th>Type</th>
                                                <th>Libellé</th>
                                                <th>Adresse</th>
                                                <th>CP</th>
                                                <th>Ville</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody id="gderpi-client-adresses-tbody"></tbody>
                                    </table>
                                </div>
                                <p class="gderpi-field-hint gderpi-client-adresses-hint">Double-clic pour modifier. Une adresse <strong>Générique</strong> est utilisée si aucune adresse du type demandé (facturation, livraison…) n’existe.</p>
                            </div>

                            <div class="gderpi-form-section-title">Conditions de paiement par défaut</div>
                            <p class="gderpi-field-hint" style="margin-top:0;">Reprises automatiquement sur les nouveaux devis de ce client (modifiables sur chaque devis).</p>
                            <div class="gderpi-form-grid gderpi-client-paiement-fields">
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-client-paiement-moyen">Moyen de paiement</label>
                                    <select id="gderpi-client-paiement-moyen" class="form-control"></select>
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-client-paiement-echeance">Échéance</label>
                                    <select id="gderpi-client-paiement-echeance" class="form-control"></select>
                                </div>
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-client-paiement-complement">Précision (optionnel)</label>
                                    <textarea id="gderpi-client-paiement-complement" class="form-control" rows="2" placeholder="Ex. acompte 30 % à la commande…"></textarea>
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Devis — options par défaut</div>
                            <p class="gderpi-field-hint" style="margin-top:0;">Reprises sur les nouveaux devis lorsque ce client est sélectionné (modifiable sur chaque devis).</p>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__check" for="gderpi-client-afficher-bon-pour-accord-par-defaut">
                                        <input id="gderpi-client-afficher-bon-pour-accord-par-defaut" type="checkbox">
                                        Cocher par défaut « Bon pour accord » sur les devis de ce client
                                    </label>
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Documents</div>
                            <div id="gderpi-client-documents-section" class="gderpi-client-sublist">
                                <div class="gderpi-client-sublist__header">
                                    <p id="gderpi-client-documents-hint" class="gderpi-field-hint" style="margin:0;">Enregistrez d'abord la fiche pour ajouter des documents.</p>
                                </div>
                                <div class="gderpi-form-grid gderpi-tier-doc-upload" style="margin-bottom:0.75rem;">
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-document-type">Type</label>
                                        <select id="gderpi-client-document-type" class="form-control" disabled></select>
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-document-label">Libellé (optionnel)</label>
                                        <input id="gderpi-client-document-label" class="form-control" type="text" disabled>
                                    </div>
                                    <div class="gderpi-field gderpi-field--full gderpi-tier-doc-upload__file">
                                        <label class="gderpi-field__label" for="gderpi-client-document-file">Fichier</label>
                                        <div class="gderpi-tier-doc-upload__row">
                                            <input id="gderpi-client-document-file" class="form-control" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*" disabled>
                                            <button type="button" id="gderpi-client-document-upload" class="btn btn-outline btn-sm" disabled>Ajouter</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
                                    <table class="gderpi-vue-lc__table gderpi-client-sublist__table">
                                        <thead>
                                            <tr>
                                                <th>Libellé</th>
                                                <th>Type</th>
                                                <th>Taille</th>
                                                <th>Date</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody id="gderpi-client-documents-tbody">
                                            <tr><td colspan="5" class="text-muted">Aucun document.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Notes</div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-client-notes">Notes internes</label>
                                    <textarea id="gderpi-client-notes" class="form-control" rows="2"></textarea>
                                </div>
                            </div>

                            <div class="gderpi-form-actions">
                                <button type="submit" id="gderpi-client-submit" class="btn btn-primary btn-sm">Créer le client</button>
                                <button type="button" id="gderpi-client-cancel" class="btn btn-outline btn-sm">Annuler</button>
                            </div>
                        </form>
                    </div>
                    <?php endif; ?>
                    <div class="gderpi-vue-lc__list-header">Liste</div>
                    <div class="gderpi-vue-lc__toolbar">
                        <input type="search" class="form-control form-control-sm" data-gderpi-lc-search="clients" placeholder="Rechercher…" style="max-width:280px;">
                        <span class="gderpi-vue-lc__count" data-gderpi-lc-count="clients"></span>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table">
                            <thead><tr><th>Nom</th><th>Type</th><th>Email</th><th>Tél.</th><th></th></tr></thead>
                            <tbody data-gderpi-lc-tbody="clients"></tbody>
                        </table>
                    </div>
                </div>
                <div id="gderpi-client-contact-modal" class="gderpi-modal gderpi-modal--md" hidden>
                    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                        <div class="gderpi-modal__header">
                            <strong class="gderpi-modal__title" data-gderpi-modal-title id="gderpi-client-contact-modal-title">Contact</strong>
                            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close type="button">Fermer</button>
                        </div>
                        <div class="gderpi-modal__body" data-gderpi-modal-body>
                            <form id="gderpi-client-contact-form" class="gderpi-form">
                                <div class="gderpi-form-grid">
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-contact-prenom">Prénom</label>
                                        <input id="gderpi-client-contact-prenom" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-contact-nom">Nom</label>
                                        <input id="gderpi-client-contact-nom" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-contact-service">Service</label>
                                        <div class="gderpi-service-picker">
                                            <select id="gderpi-client-contact-service" class="form-control"></select>
                                            <?php if ($canWriteGderpi): ?>
                                            <button type="button" id="gderpi-client-contact-service-add" class="btn btn-outline btn-sm gderpi-service-picker__add" title="Créer un service">+</button>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-contact-fonction">Fonction</label>
                                        <input id="gderpi-client-contact-fonction" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-contact-email">Email</label>
                                        <input id="gderpi-client-contact-email" class="form-control" type="email">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-contact-tel">Téléphone</label>
                                        <input id="gderpi-client-contact-tel" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field gderpi-field--check gderpi-field--full">
                                        <label class="gderpi-field__check" for="gderpi-client-contact-principal">
                                            <input id="gderpi-client-contact-principal" type="checkbox"> Contact principal
                                        </label>
                                    </div>
                                </div>
                                <div class="gderpi-form-actions">
                                    <button type="submit" class="btn btn-primary btn-sm" id="gderpi-client-contact-save">Enregistrer</button>
                                    <button type="button" class="btn btn-outline btn-sm" id="gderpi-client-contact-cancel">Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                <div id="gderpi-client-adresse-modal" class="gderpi-modal gderpi-modal--md" hidden>
                    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                        <div class="gderpi-modal__header">
                            <strong class="gderpi-modal__title" data-gderpi-modal-title id="gderpi-client-adresse-modal-title">Adresse</strong>
                            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close type="button">Fermer</button>
                        </div>
                        <div class="gderpi-modal__body" data-gderpi-modal-body>
                            <form id="gderpi-client-adresse-form" class="gderpi-form">
                                <div class="gderpi-form-grid">
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-adresse-type">Type</label>
                                        <select id="gderpi-client-adresse-type" class="form-control"></select>
                                    </div>
                                    <div class="gderpi-field gderpi-field--full">
                                        <label class="gderpi-field__label" for="gderpi-client-adresse-libelle">Libellé (optionnel)</label>
                                        <input id="gderpi-client-adresse-libelle" class="form-control" type="text" placeholder="Siège, entrepôt…">
                                    </div>
                                    <div class="gderpi-field gderpi-field--full">
                                        <label class="gderpi-field__label" for="gderpi-client-adresse-ligne">Adresse</label>
                                        <input id="gderpi-client-adresse-ligne" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field gderpi-field--full">
                                        <label class="gderpi-field__label" for="gderpi-client-adresse-complement">Complément</label>
                                        <input id="gderpi-client-adresse-complement" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-adresse-cp">Code postal</label>
                                        <input id="gderpi-client-adresse-cp" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-adresse-ville">Ville</label>
                                        <input id="gderpi-client-adresse-ville" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-client-adresse-pays">Pays</label>
                                        <input id="gderpi-client-adresse-pays" class="form-control" type="text" value="France">
                                    </div>
                                </div>
                                <div class="gderpi-form-actions">
                                    <button type="submit" class="btn btn-primary btn-sm" id="gderpi-client-adresse-save">Enregistrer</button>
                                    <button type="button" class="btn btn-outline btn-sm" id="gderpi-client-adresse-cancel">Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Fournisseurs LC -->
            <section id="gderpi-panel-fournisseurs" class="gderpi-main-panel" hidden>
                <div class="gderpi-vue-lc" data-gderpi-vue-lc="fournisseurs">
                    <div class="gderpi-vue-lc__header">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Fournisseurs</h3>
                            <p class="gderpi-vue-lc__desc">Double-clic sur une ligne pour éditer.</p>
                        </div>
                        <?php if ($canWriteGderpi): ?>
                        <button type="button" class="btn btn-primary btn-sm" data-gderpi-lc-create="fournisseurs" aria-expanded="false">+ Nouveau fournisseur</button>
                        <?php endif; ?>
                    </div>
                    <?php if ($canWriteGderpi): ?>
                    <div class="gderpi-vue-lc__create-panel" data-gderpi-lc-create-panel="fournisseurs" hidden>
                        <form id="gderpi-fournisseur-form" class="gderpi-form">
                            <h4 id="gderpi-fournisseur-form-title">Nouveau fournisseur</h4>
                            <div id="gderpi-fournisseur-annuaire-notice" class="alert alert-info gderpi-annuaire-notice" hidden></div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-fournisseur-rs">Raison sociale <span class="gderpi-required">*</span></label>
                                    <input id="gderpi-fournisseur-rs" class="form-control" type="text" required>
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-fournisseur-siret">SIRET</label>
                                    <input id="gderpi-fournisseur-siret" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-fournisseur-tva">N° TVA intracommunautaire</label>
                                    <input id="gderpi-fournisseur-tva" class="form-control" type="text" placeholder="FR…">
                                </div>
                            </div>

                            <div class="gderpi-client-sublist">
                                <div class="gderpi-client-sublist__header">
                                    <div class="gderpi-form-section-title" style="margin:0;border:0;padding:0;">Contacts</div>
                                    <?php if ($canWriteGderpi): ?>
                                    <button type="button" id="gderpi-fournisseur-contact-add" class="btn btn-outline btn-sm">+ Contact</button>
                                    <?php endif; ?>
                                </div>
                                <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
                                    <table class="gderpi-vue-lc__table gderpi-client-sublist__table">
                                        <thead>
                                            <tr>
                                                <th></th>
                                                <th>Nom</th>
                                                <th>Fonction</th>
                                                <th>Email</th>
                                                <th>Tél.</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody id="gderpi-fournisseur-contacts-tbody"></tbody>
                                    </table>
                                </div>
                                <p class="gderpi-field-hint gderpi-client-contacts-hint">Double-clic pour modifier — enregistrement dans l'Annuaire. Le contact principal est utilisé sur les commandes fournisseur.</p>
                            </div>

                            <div class="gderpi-client-sublist">
                                <div class="gderpi-client-sublist__header">
                                    <div class="gderpi-form-section-title" style="margin:0;border:0;padding:0;">Adresses</div>
                                    <?php if ($canWriteGderpi): ?>
                                    <button type="button" id="gderpi-fournisseur-adresse-add" class="btn btn-outline btn-sm">+ Adresse</button>
                                    <?php endif; ?>
                                </div>
                                <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
                                    <table class="gderpi-vue-lc__table gderpi-client-sublist__table">
                                        <thead>
                                            <tr>
                                                <th>Type</th>
                                                <th>Libellé</th>
                                                <th>Adresse</th>
                                                <th>CP</th>
                                                <th>Ville</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody id="gderpi-fournisseur-adresses-tbody"></tbody>
                                    </table>
                                </div>
                                <p class="gderpi-field-hint gderpi-client-adresses-hint">Double-clic pour modifier. Une adresse <strong>Générique</strong> est utilisée si aucune adresse du type demandé n’existe.</p>
                            </div>

                            <div class="gderpi-form-section-title">Conditions de paiement</div>
                            <div class="gderpi-form-grid gderpi-client-paiement-fields">
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-fournisseur-paiement-moyen">Moyen de paiement</label>
                                    <select id="gderpi-fournisseur-paiement-moyen" class="form-control"></select>
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-fournisseur-paiement-echeance">Échéance</label>
                                    <select id="gderpi-fournisseur-paiement-echeance" class="form-control"></select>
                                </div>
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-fournisseur-paiement-complement">Précision (optionnel)</label>
                                    <textarea id="gderpi-fournisseur-paiement-complement" class="form-control" rows="2" placeholder="Ex. acompte 30 % à la commande…"></textarea>
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Achats</div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-fournisseur-delai">Délai livraison par défaut (jours)</label>
                                    <input id="gderpi-fournisseur-delai" class="form-control" type="number" min="0">
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Documents</div>
                            <div id="gderpi-fournisseur-documents-section" class="gderpi-client-sublist">
                                <div class="gderpi-client-sublist__header">
                                    <p id="gderpi-fournisseur-documents-hint" class="gderpi-field-hint" style="margin:0;">Enregistrez d'abord la fiche pour ajouter des documents.</p>
                                </div>
                                <div class="gderpi-form-grid gderpi-tier-doc-upload" style="margin-bottom:0.75rem;">
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-document-type">Type</label>
                                        <select id="gderpi-fournisseur-document-type" class="form-control" disabled></select>
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-document-label">Libellé (optionnel)</label>
                                        <input id="gderpi-fournisseur-document-label" class="form-control" type="text" disabled>
                                    </div>
                                    <div class="gderpi-field gderpi-field--full gderpi-tier-doc-upload__file">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-document-file">Fichier</label>
                                        <div class="gderpi-tier-doc-upload__row">
                                            <input id="gderpi-fournisseur-document-file" class="form-control" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*" disabled>
                                            <button type="button" id="gderpi-fournisseur-document-upload" class="btn btn-outline btn-sm" disabled>Ajouter</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
                                    <table class="gderpi-vue-lc__table gderpi-client-sublist__table">
                                        <thead>
                                            <tr>
                                                <th>Libellé</th>
                                                <th>Type</th>
                                                <th>Taille</th>
                                                <th>Date</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody id="gderpi-fournisseur-documents-tbody">
                                            <tr><td colspan="5" class="text-muted">Aucun document.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Notes</div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-fournisseur-notes">Notes internes</label>
                                    <textarea id="gderpi-fournisseur-notes" class="form-control" rows="2"></textarea>
                                </div>
                            </div>

                            <div class="gderpi-form-actions">
                                <button type="submit" id="gderpi-fournisseur-submit" class="btn btn-primary btn-sm">Créer le fournisseur</button>
                                <button type="button" id="gderpi-fournisseur-cancel" class="btn btn-outline btn-sm">Annuler</button>
                            </div>
                        </form>
                    </div>
                    <?php endif; ?>
                    <div class="gderpi-vue-lc__list-header">Liste</div>
                    <div class="gderpi-vue-lc__toolbar">
                        <input type="search" class="form-control form-control-sm" data-gderpi-lc-search="fournisseurs" placeholder="Rechercher…" style="max-width:280px;">
                        <span class="gderpi-vue-lc__count" data-gderpi-lc-count="fournisseurs"></span>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table">
                            <thead><tr><th>Nom</th><th>Email</th><th>Tél.</th><th>Paiement</th><th></th></tr></thead>
                            <tbody data-gderpi-lc-tbody="fournisseurs"></tbody>
                        </table>
                    </div>
                </div>
                <div id="gderpi-fournisseur-contact-modal" class="gderpi-modal gderpi-modal--md" hidden>
                    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                        <div class="gderpi-modal__header">
                            <strong class="gderpi-modal__title" data-gderpi-modal-title id="gderpi-fournisseur-contact-modal-title">Contact</strong>
                            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close type="button">Fermer</button>
                        </div>
                        <div class="gderpi-modal__body" data-gderpi-modal-body>
                            <form id="gderpi-fournisseur-contact-form" class="gderpi-form">
                                <div class="gderpi-form-grid">
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-contact-prenom">Prénom</label>
                                        <input id="gderpi-fournisseur-contact-prenom" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-contact-nom">Nom</label>
                                        <input id="gderpi-fournisseur-contact-nom" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-contact-fonction">Fonction</label>
                                        <input id="gderpi-fournisseur-contact-fonction" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-contact-email">Email</label>
                                        <input id="gderpi-fournisseur-contact-email" class="form-control" type="email">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-contact-tel">Téléphone</label>
                                        <input id="gderpi-fournisseur-contact-tel" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field gderpi-field--check gderpi-field--full">
                                        <label class="gderpi-field__check" for="gderpi-fournisseur-contact-principal">
                                            <input id="gderpi-fournisseur-contact-principal" type="checkbox"> Contact principal
                                        </label>
                                    </div>
                                </div>
                                <div class="gderpi-form-actions">
                                    <button type="submit" class="btn btn-primary btn-sm" id="gderpi-fournisseur-contact-save">Enregistrer</button>
                                    <button type="button" class="btn btn-outline btn-sm" id="gderpi-fournisseur-contact-cancel">Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                <div id="gderpi-fournisseur-adresse-modal" class="gderpi-modal gderpi-modal--md" hidden>
                    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                        <div class="gderpi-modal__header">
                            <strong class="gderpi-modal__title" data-gderpi-modal-title id="gderpi-fournisseur-adresse-modal-title">Adresse</strong>
                            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close type="button">Fermer</button>
                        </div>
                        <div class="gderpi-modal__body" data-gderpi-modal-body>
                            <form id="gderpi-fournisseur-adresse-form" class="gderpi-form">
                                <div class="gderpi-form-grid">
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-adresse-type">Type</label>
                                        <select id="gderpi-fournisseur-adresse-type" class="form-control"></select>
                                    </div>
                                    <div class="gderpi-field gderpi-field--full">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-adresse-libelle">Libellé (optionnel)</label>
                                        <input id="gderpi-fournisseur-adresse-libelle" class="form-control" type="text" placeholder="Siège, entrepôt…">
                                    </div>
                                    <div class="gderpi-field gderpi-field--full">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-adresse-ligne">Adresse</label>
                                        <input id="gderpi-fournisseur-adresse-ligne" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field gderpi-field--full">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-adresse-complement">Complément</label>
                                        <input id="gderpi-fournisseur-adresse-complement" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-adresse-cp">Code postal</label>
                                        <input id="gderpi-fournisseur-adresse-cp" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-adresse-ville">Ville</label>
                                        <input id="gderpi-fournisseur-adresse-ville" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-fournisseur-adresse-pays">Pays</label>
                                        <input id="gderpi-fournisseur-adresse-pays" class="form-control" type="text" value="France">
                                    </div>
                                </div>
                                <div class="gderpi-form-actions">
                                    <button type="submit" class="btn btn-primary btn-sm" id="gderpi-fournisseur-adresse-save">Enregistrer</button>
                                    <button type="button" class="btn btn-outline btn-sm" id="gderpi-fournisseur-adresse-cancel">Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Devis -->
            <section id="gderpi-panel-devis" class="gderpi-main-panel" hidden>
                <div id="gderpi-devis-list-wrap">
                    <div class="gderpi-vue-lc" data-gderpi-vue-lc="devis">
                        <div class="gderpi-vue-lc__header">
                            <div>
                                <h3 class="gderpi-vue-lc__title">Devis</h3>
                                <p class="gderpi-vue-lc__desc">Création, envoi et transformation en commande client. Double-clic pour ouvrir ; statut modifiable depuis la liste.</p>
                            </div>
                            <?php if ($canWriteGderpi): ?>
                            <button type="button" class="btn btn-primary btn-sm" id="gderpi-devis-new">+ Nouveau devis</button>
                            <?php endif; ?>
                        </div>
                        <div class="gderpi-vue-lc__list-header">Liste</div>
                        <div class="gderpi-vue-lc__toolbar">
                            <input type="search" class="form-control form-control-sm" id="gderpi-devis-search" placeholder="N°, client, doc. client, objet…" style="max-width:260px;">
                            <select id="gderpi-devis-filter-statut" class="form-control form-control-sm" style="max-width:160px;">
                                <option value="">Tous statuts</option>
                                <option value="brouillon">Brouillon</option>
                                <option value="envoye">Envoyé</option>
                                <option value="accepte">Accepté</option>
                                <option value="refuse">Refusé</option>
                                <option value="expire">Expiré</option>
                            </select>
                            <select id="gderpi-devis-filter-boutique" class="form-control form-control-sm" style="max-width:200px;"></select>
                            <span class="gderpi-vue-lc__count" id="gderpi-devis-count"></span>
                        </div>
                        <div class="gderpi-vue-lc__table-wrap">
                            <table class="gderpi-vue-lc__table gderpi-devis-list-table">
                                <thead>
                                    <tr>
                                        <th><button type="button" class="gderpi-table-sort" data-devis-sort="numero">N°</button></th>
                                        <th><button type="button" class="gderpi-table-sort" data-devis-sort="date">Date</button></th>
                                        <th><button type="button" class="gderpi-table-sort" data-devis-sort="client">Client</button></th>
                                        <th><button type="button" class="gderpi-table-sort" data-devis-sort="documentClient">Doc. client</button></th>
                                        <th><button type="button" class="gderpi-table-sort" data-devis-sort="objet">Objet</button></th>
                                        <th><button type="button" class="gderpi-table-sort" data-devis-sort="statut">Statut</button></th>
                                        <th>Commande</th>
                                        <th class="text-end"><button type="button" class="gderpi-table-sort" data-devis-sort="totalTtc">Total TTC</button></th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody id="gderpi-devis-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div id="gderpi-devis-editor" class="gderpi-doc-editor gderpi-modal gderpi-modal--xl gderpi-modal--devis" hidden>
                    <div class="gderpi-doc-editor__header">
                        <button type="button" id="gderpi-devis-back" class="btn btn-outline btn-sm">← Liste devis</button>
                        <div>
                            <h3 class="gderpi-doc-editor__title" id="gderpi-devis-editor-title">Devis</h3>
                            <p class="gderpi-doc-editor__subtitle" id="gderpi-devis-editor-subtitle"></p>
                        </div>
                        <div class="gderpi-doc-editor__actions" id="gderpi-devis-editor-actions"></div>
                    </div>
                    <div class="gderpi-panel-card gderpi-devis-meta-card">
                        <div class="gderpi-vue-lc__table-wrap">
                            <table class="gderpi-vue-lc__table gderpi-devis-meta-table">
                                <thead>
                                    <tr>
                                        <th>Boutique / émetteur</th>
                                        <th>Client</th>
                                        <th>Document client</th>
                                        <th>Service</th>
                                        <th>Contact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr class="gderpi-devis-meta-main">
                                        <td>
                                            <select id="gderpi-devis-boutique" class="form-control gderpi-devis-meta-boutique"></select>
                                            <select id="gderpi-devis-emetteur-select" class="form-control gderpi-devis-meta-emetteur" disabled>
                                                <option value="">— Boutique requise —</option>
                                            </select>
                                            <input type="hidden" id="gderpi-devis-emetteur-contact-id" value="">
                                            <input type="hidden" id="gderpi-devis-emetteur-contact-nom" value="">
                                            <input type="hidden" id="gderpi-devis-emetteur-contact-fonction" value="">
                                            <input type="hidden" id="gderpi-devis-emetteur-contact-email" value="">
                                            <input type="hidden" id="gderpi-devis-emetteur-contact-tel" value="">
                                        </td>
                                        <td>
                                            <input type="hidden" id="gderpi-devis-client" value="">
                                            <input type="text" id="gderpi-devis-client-search" class="form-control gderpi-devis-meta-client" placeholder="Tapez nom, email, ville…" autocomplete="off">
                                        </td>
                                        <td>
                                            <input id="gderpi-devis-document-client" class="form-control gderpi-devis-meta-ref" type="text" placeholder="N° dossier, demande…" autocomplete="off">
                                        </td>
                                        <td>
                                            <select id="gderpi-devis-service-select" class="form-control gderpi-devis-meta-service" disabled>
                                                <option value="">— Client requis —</option>
                                            </select>
                                        </td>
                                        <td>
                                            <div class="gderpi-devis-contact-picker">
                                                <select id="gderpi-devis-contact-select" class="form-control gderpi-devis-meta-contact" disabled>
                                                    <option value="">— Service requis —</option>
                                                </select>
                                                <?php if ($canWriteGderpi): ?>
                                                <button type="button" id="gderpi-devis-contact-add" class="btn btn-outline btn-sm gderpi-devis-contact-add" disabled title="Ajouter un contact au client">+</button>
                                                <?php endif; ?>
                                            </div>
                                            <input type="hidden" id="gderpi-devis-contact-nom" value="">
                                            <input type="hidden" id="gderpi-devis-contact-fonction" value="">
                                            <input type="hidden" id="gderpi-devis-contact-email" value="">
                                            <input type="hidden" id="gderpi-devis-contact-tel" value="">
                                        </td>
                                    </tr>
                                    <tr class="gderpi-devis-meta-detail" id="gderpi-devis-pm-row" hidden>
                                        <td colspan="5">
                                            <div class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full">
                                                <span class="gderpi-devis-meta-fields__label">Carte PM liée</span>
                                                <div id="gderpi-devis-pm-link" class="gderpi-devis-pm-link">—</div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr class="gderpi-devis-meta-detail" id="gderpi-devis-trace-row" hidden>
                                        <td colspan="5">
                                            <div class="gderpi-devis-meta-fields__item">
                                                <span class="gderpi-devis-meta-fields__label">Commande client liée</span>
                                                <div id="gderpi-devis-commande-link" class="form-control-plaintext">—</div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr class="gderpi-devis-meta-detail">
                                        <td colspan="5">
                                            <label class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full">
                                                <span class="gderpi-devis-meta-fields__label">Objet</span>
                                                <input id="gderpi-devis-objet" class="form-control" type="text" placeholder="Intitulé du devis">
                                            </label>
                                        </td>
                                    </tr>
                                    <tr class="gderpi-devis-meta-detail gderpi-devis-meta-detail--notes">
                                        <td colspan="5">
                                            <label class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full">
                                                <span class="gderpi-devis-meta-fields__label">Notes internes</span>
                                                <textarea id="gderpi-devis-notes" class="form-control" rows="2" placeholder="Non imprimé sur le devis"></textarea>
                                            </label>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="gderpi-panel-card gderpi-devis-lines-card">
                        <div class="gderpi-devis-lines-header">
                            <h4 class="gderpi-devis-lines-title">Lignes du devis</h4>
                        </div>
                        <div class="gderpi-vue-lc__table-wrap">
                            <table class="gderpi-vue-lc__table gderpi-devis-lines-table">
                                <thead><tr><th>Réf. interne</th><th>Réf. client</th><th>Libellé</th><th>Unité</th><th>Qté</th><th class="text-end">Prix HT</th><th class="text-end">Rem.%</th><th class="text-end">TVA</th><th class="text-end">Montant HT</th><th></th></tr></thead>
                                <tbody id="gderpi-devis-lines-tbody"></tbody>
                                <tfoot>
                                    <tr id="gderpi-devis-frais-port-edit-row">
                                        <td colspan="6" class="text-end"><label for="gderpi-devis-frais-port-ht">Frais de port HT</label></td>
                                        <td colspan="2">
                                            <div class="gderpi-devis-frais-port-fields">
                                                <input id="gderpi-devis-frais-port-ht" class="form-control form-control-sm text-end gderpi-devis-frais-port-ht" type="number" min="0" step="0.01" placeholder="0,00">
                                                <label class="gderpi-devis-frais-port-tva-label" for="gderpi-devis-frais-port-tva">TVA %</label>
                                                <input id="gderpi-devis-frais-port-tva" class="form-control form-control-sm text-end gderpi-devis-frais-port-tva" type="number" min="0" step="0.1" value="20">
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr id="gderpi-devis-frais-port-row" hidden>
                                        <td colspan="8" class="text-end">Frais de port HT</td>
                                        <td class="text-end" id="gderpi-devis-frais-port-display">0,00 €</td>
                                        <td></td>
                                    </tr>
                                    <tr><td colspan="8" class="text-end"><strong>Total HT</strong></td><td class="text-end" id="gderpi-devis-total-ht">0,00 €</td><td></td></tr>
                                    <tr><td colspan="8" class="text-end"><strong>TVA</strong></td><td class="text-end" id="gderpi-devis-total-tva">0,00 €</td><td></td></tr>
                                    <tr><td colspan="8" class="text-end"><strong>Total TTC</strong></td><td class="text-end" id="gderpi-devis-total-ttc">0,00 €</td><td></td></tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    <details class="gderpi-devis-conditions-footer" id="gderpi-devis-conditions-footer">
                        <summary class="gderpi-devis-conditions-footer__summary">
                            <span class="gderpi-devis-conditions-footer__title">Conditions (paiement &amp; CGV)</span>
                            <span class="gderpi-devis-conditions-footer__preview text-muted small" id="gderpi-devis-conditions-preview"></span>
                        </summary>
                        <div class="gderpi-devis-conditions-footer__grid">
                            <div class="gderpi-panel-card gderpi-devis-paiement-card gderpi-devis-conditions-col">
                                <h4 class="gderpi-devis-conditions-col__title">Conditions de paiement</h4>
                                <p class="gderpi-devis-conditions-col__hint text-muted small">Imprimées sur le devis — préremplies depuis le client.</p>
                                <div class="gderpi-devis-paiement-fields">
                                    <label class="gderpi-field">
                                        <span class="gderpi-field__label">Moyen</span>
                                        <select id="gderpi-devis-paiement-moyen" class="form-control form-control-sm"></select>
                                    </label>
                                    <label class="gderpi-field">
                                        <span class="gderpi-field__label">Échéance</span>
                                        <select id="gderpi-devis-paiement-echeance" class="form-control form-control-sm"></select>
                                    </label>
                                    <label class="gderpi-field gderpi-devis-paiement-complement-wrap" id="gderpi-devis-paiement-complement-wrap">
                                        <span class="gderpi-field__label">Précision</span>
                                        <input id="gderpi-devis-paiement-complement" class="form-control form-control-sm" type="text" placeholder="Si « Autre » ou détail complémentaire…">
                                    </label>
                                </div>
                            </div>
                            <div class="gderpi-panel-card gderpi-devis-cgv-card gderpi-devis-conditions-col">
                                <h4 class="gderpi-devis-conditions-col__title">Conditions générales de vente</h4>
                                <p class="gderpi-devis-conditions-col__hint text-muted small">Lien CGV en pied de page — profil selon le client.</p>
                                <div class="gderpi-devis-cgv-fields">
                                    <label class="gderpi-field">
                                        <span class="gderpi-field__label">Profil CGV</span>
                                        <select id="gderpi-devis-cgv-profil" class="form-control form-control-sm">
                                            <option value="auto">Automatique (type client)</option>
                                            <option value="b2b">B2B — Professionnels</option>
                                            <option value="b2c">B2C — Particuliers</option>
                                        </select>
                                    </label>
                                    <label class="gderpi-field gderpi-field--check gderpi-devis-cgv-check">
                                        <span class="gderpi-field__check">
                                            <input type="checkbox" id="gderpi-devis-joindre-cgv-annexe">
                                            Annexe CGV dans le PDF
                                        </span>
                                    </label>
                                    <label class="gderpi-field gderpi-field--check gderpi-devis-bpa-check" for="gderpi-devis-afficher-bon-pour-accord">
                                        <span class="gderpi-field__check">
                                            <input id="gderpi-devis-afficher-bon-pour-accord" type="checkbox">
                                            Bloc « Bon pour accord »
                                        </span>
                                    </label>
                                    <p id="gderpi-devis-cgv-hint" class="gderpi-devis-cgv-hint text-muted small"></p>
                                    <p id="gderpi-devis-cgv-link-wrap" class="gderpi-devis-cgv-link-wrap text-muted small">
                                        <a id="gderpi-devis-cgv-link" href="#" target="_blank" rel="noopener"></a>
                                        <span id="gderpi-devis-cgv-link-missing" class="gderpi-devis-cgv-link-missing" hidden></span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
                <div id="gderpi-devis-new-contact-modal" class="gderpi-modal gderpi-modal--md" hidden>
                    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                        <div class="gderpi-modal__header">
                            <strong class="gderpi-modal__title" data-gderpi-modal-title>Nouveau contact client</strong>
                            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close type="button">Fermer</button>
                        </div>
                        <div class="gderpi-modal__body" data-gderpi-modal-body>
                            <form id="gderpi-devis-new-contact-form" class="gderpi-form">
                                <div class="gderpi-form-grid">
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-devis-new-contact-prenom">Prénom</label>
                                        <input id="gderpi-devis-new-contact-prenom" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-devis-new-contact-nom">Nom</label>
                                        <input id="gderpi-devis-new-contact-nom" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-devis-new-contact-service">Service</label>
                                        <div class="gderpi-service-picker">
                                            <select id="gderpi-devis-new-contact-service" class="form-control"></select>
                                            <?php if ($canWriteGderpi): ?>
                                            <button type="button" id="gderpi-devis-new-contact-service-add" class="btn btn-outline btn-sm gderpi-service-picker__add" title="Créer un service">+</button>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-devis-new-contact-fonction">Fonction</label>
                                        <input id="gderpi-devis-new-contact-fonction" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-devis-new-contact-email">Email</label>
                                        <input id="gderpi-devis-new-contact-email" class="form-control" type="email">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-devis-new-contact-tel">Téléphone</label>
                                        <input id="gderpi-devis-new-contact-tel" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field gderpi-field--check gderpi-field--full">
                                        <label class="gderpi-field__check" for="gderpi-devis-new-contact-principal">
                                            <input id="gderpi-devis-new-contact-principal" type="checkbox"> Contact principal
                                        </label>
                                    </div>
                                </div>
                                <div class="gderpi-form-actions">
                                    <button type="submit" class="btn btn-primary btn-sm">Enregistrer sur la fiche client</button>
                                    <button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-new-contact-cancel">Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                <div id="gderpi-devis-preview-modal" class="gderpi-modal gderpi-modal--iframe" hidden>
                    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                        <div class="gderpi-modal__header">
                            <strong class="gderpi-modal__title" data-gderpi-modal-title>Aperçu devis</strong>
                            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close id="gderpi-devis-preview-close">Fermer</button>
                        </div>
                        <div class="gderpi-modal__body" data-gderpi-modal-body>
                            <iframe id="gderpi-devis-preview-iframe" class="gderpi-modal__iframe" title="Aperçu devis HTML"></iframe>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Commandes client -->
            <section id="gderpi-panel-commandes" class="gderpi-main-panel" hidden>
                <div class="gderpi-vue-lc" data-gderpi-vue-lc="commandes">
                    <div class="gderpi-vue-lc__header">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Commandes client</h3>
                            <p class="gderpi-vue-lc__desc">Pipeline commandes — validation GDRI, achats, livraison client et recette dev.</p>
                        </div>
                    </div>
                    <div class="gderpi-vue-lc__list-header">Liste</div>
                    <div class="gderpi-vue-lc__toolbar">
                        <input type="search" class="form-control form-control-sm" id="gderpi-commandes-search" placeholder="N°, client, réf., devis…" style="max-width:260px;">
                        <select id="gderpi-commandes-filter-vue" class="form-control form-control-sm" style="max-width:200px;">
                            <option value="actives">Actives</option>
                            <option value="">Toutes</option>
                            <option value="execution">En exécution</option>
                            <option value="post_facturation">Post-facturation</option>
                        </select>
                        <select id="gderpi-commandes-filter-statut" class="form-control form-control-sm" style="max-width:180px;">
                            <option value="">Tous statuts</option>
                            <option value="a_valider_gdri">À valider GDRI</option>
                            <option value="validee_client">Validée client</option>
                            <option value="validee_gdri">Validée GDRI</option>
                            <option value="achats_en_cours">Achats en cours</option>
                            <option value="attente_livraison_frs">Attente livraison frs</option>
                            <option value="a_livrer">À livrer</option>
                            <option value="livree">Livrée / recette OK</option>
                            <option value="a_facturer">À facturer</option>
                            <option value="facturee_partiellement">Facturée partiellement</option>
                            <option value="facturee">Facturée</option>
                            <option value="annulee">Annulée</option>
                        </select>
                        <span class="gderpi-vue-lc__count" id="gderpi-commandes-count"></span>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table">
                            <thead>
                                <tr>
                                    <th>N° commande</th>
                                    <th>Client</th>
                                    <th>Type</th>
                                    <th>Doc. client</th>
                                    <th>Bon de commande</th>
                                    <th>Devis</th>
                                    <th>Statut</th>
                                    <th>Livraison</th>
                                    <th>Facturation</th>
                                    <th class="text-end">Total TTC</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="gderpi-commandes-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- Achats (commandes fournisseur) -->
            <section id="gderpi-panel-achats" class="gderpi-main-panel" hidden>
                <div class="gderpi-vue-lc" data-gderpi-vue-lc="achats">
                    <div class="gderpi-vue-lc__header">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Commandes fournisseur</h3>
                            <p class="gderpi-vue-lc__desc">Achats liés aux commandes clients ou commandes autonomes (stock). Double-clic sur une ligne pour éditer.</p>
                        </div>
                        <?php if ($canWriteGderpi): ?>
                        <div class="gderpi-vue-lc__header-actions" style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                            <button type="button" class="btn btn-outline btn-sm" id="gderpi-achats-new-manual">+ Commande fournisseur</button>
                            <button type="button" class="btn btn-primary btn-sm" id="gderpi-achats-new-stock">+ Commande stock</button>
                        </div>
                        <?php endif; ?>
                    </div>
                    <div class="gderpi-vue-lc__list-header">Liste</div>
                    <div class="gderpi-vue-lc__toolbar">
                        <input type="search" class="form-control form-control-sm" id="gderpi-achats-search" placeholder="Rechercher…" style="max-width:220px;">
                        <select id="gderpi-achats-filter-statut" class="form-control form-control-sm" style="max-width:160px;">
                            <option value="">Tous statuts</option>
                            <option value="brouillon">Brouillon</option>
                            <option value="envoyee">Envoyée</option>
                            <option value="confirmee">Confirmée</option>
                            <option value="recue">Reçue</option>
                        </select>
                        <span class="gderpi-vue-lc__count" id="gderpi-achats-count"></span>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table">
                            <thead><tr><th>N°</th><th>Fournisseur</th><th>Objet</th><th>Statut</th><th class="text-end">Total HT</th><th></th></tr></thead>
                            <tbody id="gderpi-achats-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- Bons de livraison client -->
            <section id="gderpi-panel-bons-livraison" class="gderpi-main-panel" hidden>
                <div class="gderpi-vue-lc" data-gderpi-vue-lc="bons-livraison">
                    <div class="gderpi-vue-lc__header">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Bons de livraison</h3>
                            <p class="gderpi-vue-lc__desc">Historique des BL émis — création depuis Commandes client une fois la réception fournisseur confirmée.</p>
                        </div>
                    </div>
                    <div class="gderpi-vue-lc__list-header">BL client</div>
                    <div class="gderpi-vue-lc__toolbar">
                        <input type="search" class="form-control form-control-sm" id="gderpi-bl-search" placeholder="Rechercher…" style="max-width:220px;">
                        <span class="gderpi-vue-lc__count" id="gderpi-bl-count"></span>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table">
                            <thead><tr><th>N° BL</th><th>Date</th><th>Client</th><th>N° commande</th><th>Objet</th><th></th></tr></thead>
                            <tbody id="gderpi-bl-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- Facturation client -->
            <section id="gderpi-panel-facturation" class="gderpi-main-panel" hidden>
                <div class="gderpi-vue-lc" data-gderpi-vue-lc="facturation">
                    <div class="gderpi-vue-lc__header">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Facturation client</h3>
                            <p class="gderpi-vue-lc__desc">Factures et avoirs — les avoirs sont indentés sous leur facture. Numérotation FAC/AVO continue.</p>
                        </div>
                    </div>
                    <div class="gderpi-vue-lc__list-header">Factures émises</div>
                    <div class="gderpi-vue-lc__toolbar">
                        <input type="search" class="form-control form-control-sm" id="gderpi-facturation-search" placeholder="Rechercher…" style="max-width:220px;">
                        <select id="gderpi-facturation-filter-paye" class="form-control form-control-sm" style="max-width:160px;">
                            <option value="">Toutes</option>
                            <option value="0">Non payées</option>
                            <option value="1">Payées</option>
                        </select>
                        <span class="gderpi-vue-lc__count" id="gderpi-facturation-count"></span>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table gderpi-fact-table">
                            <thead><tr><th>N° facture</th><th>Date</th><th>Client</th><th>N° commande</th><th>Doc. client</th><th>Bon de commande</th><th>Devis</th><th>Paiement</th><th class="text-end">Facturé TTC</th><th class="text-end">Reste dû</th><th></th></tr></thead>
                            <tbody id="gderpi-facturation-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- Éditeur commande client (modale) -->
            <div id="gderpi-cmd-client-editor" class="gderpi-doc-editor gderpi-modal gderpi-modal--xl gderpi-modal--devis" hidden>
                <div class="gderpi-doc-editor__header">
                    <div>
                        <h3 class="gderpi-doc-editor__title" id="gderpi-cmd-client-title">Commande client</h3>
                        <p class="gderpi-doc-editor__subtitle" id="gderpi-cmd-client-subtitle"></p>
                    </div>
                    <div class="gderpi-doc-editor__actions" id="gderpi-cmd-client-actions"></div>
                </div>
                <div id="gderpi-cmd-client-expired-warn" class="alert alert-warning gderpi-cmd-expired-warn" hidden>
                    Ce devis est expiré — vous pouvez tout de même créer la commande.
                </div>
                <div class="gderpi-panel-card gderpi-devis-meta-card">
                    <div class="gderpi-devis-meta-fields" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.75rem 1rem;">
                        <div class="gderpi-devis-meta-fields__item">
                            <span class="gderpi-devis-meta-fields__label">Client</span>
                            <div id="gderpi-cmd-client-client" class="form-control-plaintext">—</div>
                        </div>
                        <div class="gderpi-devis-meta-fields__item">
                            <span class="gderpi-devis-meta-fields__label">Document client</span>
                            <div id="gderpi-cmd-client-document" class="form-control-plaintext">—</div>
                        </div>
                        <div class="gderpi-devis-meta-fields__item">
                            <label class="gderpi-devis-meta-fields__label" for="gderpi-cmd-client-reference">Bon de commande client</label>
                            <input id="gderpi-cmd-client-reference" class="form-control" type="text" placeholder="N° bon de commande client…">
                        </div>
                        <div class="gderpi-devis-meta-fields__item">
                            <span class="gderpi-devis-meta-fields__label">Devis d'origine</span>
                            <div id="gderpi-cmd-client-devis-link">—</div>
                        </div>
                        <div class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full">
                            <label class="gderpi-devis-meta-fields__label" for="gderpi-cmd-client-objet">Objet</label>
                            <input id="gderpi-cmd-client-objet" class="form-control" type="text">
                        </div>
                        <div class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full" id="gderpi-cmd-client-workflow-wrap" hidden>
                            <span class="gderpi-devis-meta-fields__label">Suivi commande</span>
                            <div id="gderpi-cmd-client-workflow" class="gderpi-cmd-workflow"></div>
                        </div>
                        <div class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full">
                            <label class="gderpi-devis-meta-fields__label" for="gderpi-cmd-client-notes">Notes internes</label>
                            <textarea id="gderpi-cmd-client-notes" class="form-control" rows="2"></textarea>
                        </div>
                    </div>
                </div>
                <div class="gderpi-panel-card gderpi-devis-lines-card">
                    <div class="gderpi-devis-lines-header">
                        <h4 class="gderpi-devis-lines-title">Lignes de la commande</h4>
                        <p class="gderpi-devis-lines-hint text-muted small">Modifiez les quantités, ajoutez ou retirez des articles avant validation.</p>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table gderpi-devis-lines-table">
                            <thead id="gderpi-cmd-client-lines-thead"><tr><th>Réf. interne</th><th>Réf. client</th><th>Libellé</th><th>Unité</th><th>Qté</th><th class="text-end">Prix HT</th><th class="text-end">Rem.%</th><th class="text-end">TVA</th><th class="text-end">Montant HT</th><th></th></tr></thead>
                            <tbody id="gderpi-cmd-client-lines-tbody"></tbody>
                            <tfoot>
                                <tr><td colspan="8" class="text-end"><strong>Total HT</strong></td><td class="text-end" id="gderpi-cmd-client-total-ht">0,00 €</td><td></td></tr>
                                <tr><td colspan="8" class="text-end"><strong>TVA</strong></td><td class="text-end" id="gderpi-cmd-client-total-tva">0,00 €</td><td></td></tr>
                                <tr><td colspan="8" class="text-end"><strong>Total TTC</strong></td><td class="text-end" id="gderpi-cmd-client-total-ttc">0,00 €</td><td></td></tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Éditeur commande fournisseur (modale) -->
            <div id="gderpi-cmd-frs-editor" class="gderpi-doc-editor gderpi-modal gderpi-modal--xl gderpi-modal--devis" hidden>
                <div class="gderpi-doc-editor__header">
                    <div>
                        <h3 class="gderpi-doc-editor__title" id="gderpi-cmd-frs-title">Commande fournisseur</h3>
                        <p class="gderpi-doc-editor__subtitle" id="gderpi-cmd-frs-subtitle"></p>
                    </div>
                    <div class="gderpi-doc-editor__actions" id="gderpi-cmd-frs-actions"></div>
                </div>
                <div class="gderpi-panel-card gderpi-devis-meta-card">
                    <div class="gderpi-devis-meta-fields" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.75rem 1rem;">
                        <div id="gderpi-cmd-frs-create-fields" class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full" hidden>
                            <div class="gderpi-form-grid" style="margin:0;">
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-devis-meta-fields__label" for="gderpi-cmd-frs-boutique">Boutique émettrice <span class="gderpi-required">*</span></label>
                                    <select id="gderpi-cmd-frs-boutique" class="form-control">
                                        <option value="">— Sélectionner une boutique —</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full" id="gderpi-cmd-frs-supplier-wrap">
                            <label class="gderpi-devis-meta-fields__label" for="gderpi-cmd-frs-fournisseur-select">Fournisseur <span class="gderpi-required">*</span></label>
                            <select id="gderpi-cmd-frs-fournisseur-select" class="form-control">
                                <option value="">— Sélectionner un fournisseur —</option>
                            </select>
                        </div>
                        <div class="gderpi-devis-meta-fields__item" id="gderpi-cmd-frs-fournisseur-display-wrap" hidden>
                            <span class="gderpi-devis-meta-fields__label">Fournisseur</span>
                            <div id="gderpi-cmd-frs-fournisseur-display" class="form-control-plaintext">—</div>
                        </div>
                        <div class="gderpi-devis-meta-fields__item" id="gderpi-cmd-frs-cmd-client-wrap">
                            <span class="gderpi-devis-meta-fields__label">Commande client</span>
                            <div id="gderpi-cmd-frs-cmd-client-link">—</div>
                        </div>
                        <div class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full">
                            <label class="gderpi-devis-meta-fields__label" for="gderpi-cmd-frs-objet">Objet</label>
                            <input id="gderpi-cmd-frs-objet" class="form-control" type="text">
                        </div>
                        <div class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full" id="gderpi-cmd-frs-workflow-wrap">
                            <span class="gderpi-devis-meta-fields__label">Suivi achat</span>
                            <div id="gderpi-cmd-frs-workflow" class="gderpi-cmd-workflow"></div>
                        </div>
                        <div class="gderpi-devis-meta-fields__item gderpi-devis-meta-fields__item--full">
                            <label class="gderpi-devis-meta-fields__label" for="gderpi-cmd-frs-notes">Notes internes</label>
                            <textarea id="gderpi-cmd-frs-notes" class="form-control" rows="2"></textarea>
                        </div>
                    </div>
                </div>
                <div class="gderpi-panel-card gderpi-devis-lines-card">
                    <div class="gderpi-devis-lines-header">
                        <h4 class="gderpi-devis-lines-title">Lignes d'achat</h4>
                        <p class="gderpi-devis-lines-hint text-muted small" id="gderpi-cmd-frs-lines-hint">Modifiable en brouillon ou envoyée. Double-clic sur une ligne dans la liste des achats pour ouvrir.</p>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table gderpi-devis-lines-table">
                            <thead id="gderpi-cmd-frs-lines-thead"><tr><th>Réf. interne</th><th>Réf. fournisseur</th><th>Libellé</th><th>Unité</th><th>Qté</th><th class="text-end">Prix achat HT</th><th class="text-end">Rem.%</th><th class="text-end">TVA</th><th class="text-end">Montant HT</th><th></th></tr></thead>
                            <tbody id="gderpi-cmd-frs-lines-tbody"></tbody>
                            <tfoot>
                                <tr><td colspan="8" class="text-end"><strong>Total HT</strong></td><td class="text-end" id="gderpi-cmd-frs-total-ht">0,00 €</td><td></td></tr>
                                <tr><td colspan="8" class="text-end"><strong>TVA</strong></td><td class="text-end" id="gderpi-cmd-frs-total-tva">0,00 €</td><td></td></tr>
                                <tr><td colspan="8" class="text-end"><strong>Total TTC</strong></td><td class="text-end" id="gderpi-cmd-frs-total-ttc">0,00 €</td><td></td></tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Modale bon de livraison -->
            <div id="gderpi-bl-editor-modal" class="gderpi-modal gderpi-modal--lg" hidden>
                <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                    <div class="gderpi-modal__header">
                        <strong class="gderpi-modal__title" id="gderpi-bl-editor-title">Bon de livraison</strong>
                        <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close>Fermer</button>
                    </div>
                    <div class="gderpi-modal__body" data-gderpi-modal-body>
                        <p class="text-muted small" id="gderpi-bl-editor-intro">Quantités préremplies selon le stock reçu fournisseur.</p>
                        <div class="gderpi-vue-lc__table-wrap mb-3">
                            <table class="gderpi-vue-lc__table">
                                <thead><tr><th>Réf.</th><th>Désignation</th><th class="text-end">Reste cmd</th><th class="text-end">Dispo</th><th>Qté livrée</th><th>Unité</th></tr></thead>
                                <tbody id="gderpi-bl-lines-tbody"></tbody>
                            </table>
                        </div>
                        <div class="gderpi-panel-card gderpi-bl-livraison-card mb-3">
                            <h4 class="gderpi-bl-livraison-card__title">Livraison chez le client</h4>
                            <dl class="gderpi-bl-livraison-dl">
                                <div class="gderpi-bl-livraison-dl__row">
                                    <dt>Client</dt>
                                    <dd id="gderpi-bl-client-name">—</dd>
                                </div>
                            </dl>
                            <div class="gderpi-field mb-2 mt-2">
                                <label class="gderpi-field__label" for="gderpi-bl-contact-select">Contact livraison</label>
                                <select id="gderpi-bl-contact-select" class="form-control form-control-sm"></select>
                                <div id="gderpi-bl-contact-display" class="gderpi-bl-contact-display mt-2 text-muted small">—</div>
                            </div>
                            <div class="gderpi-field mb-0">
                                <label class="gderpi-field__label" for="gderpi-bl-adresse-select">Adresse de livraison</label>
                                <select id="gderpi-bl-adresse-select" class="form-control form-control-sm"></select>
                                <div id="gderpi-bl-adresse-display" class="gderpi-bl-adresse-display mt-2">—</div>
                                <p class="text-muted small mb-0 mt-1" id="gderpi-bl-adresse-empty" hidden>Aucune adresse sur la fiche client — complétez-la avant de livrer.</p>
                            </div>
                        </div>
                        <div class="gderpi-field">
                            <label class="gderpi-field__label" for="gderpi-bl-notes">Notes (optionnel)</label>
                            <textarea id="gderpi-bl-notes" class="form-control" rows="2"></textarea>
                        </div>
                    </div>
                    <div class="gderpi-modal__footer">
                        <button type="button" class="btn btn-outline btn-sm" data-gderpi-modal-close>Annuler</button>
                        <button type="button" class="btn btn-primary btn-sm" id="gderpi-bl-save">Créer le BL</button>
                    </div>
                </div>
            </div>

            <!-- Modale réception fournisseur -->
            <div id="gderpi-reception-frs-modal" class="gderpi-modal gderpi-modal--lg" hidden>
                <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                    <div class="gderpi-modal__header">
                        <strong class="gderpi-modal__title" id="gderpi-reception-frs-modal-title">Réception fournisseur</strong>
                        <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close>Fermer</button>
                    </div>
                    <div class="gderpi-modal__body" data-gderpi-modal-body>
                        <p class="text-muted small" id="gderpi-reception-frs-intro">Indiquez les quantités reçues du fournisseur.</p>
                        <div class="gderpi-vue-lc__table-wrap mb-3">
                            <table class="gderpi-vue-lc__table">
                                <thead><tr><th>CF</th><th>Réf.</th><th>Désignation</th><th class="text-end">Cmd.</th><th class="text-end">Déjà reçu</th><th>Qté reçue</th><th>Unité</th></tr></thead>
                                <tbody id="gderpi-reception-frs-lines-tbody"></tbody>
                            </table>
                        </div>
                        <div class="gderpi-field">
                            <label class="gderpi-field__label" for="gderpi-reception-frs-notes">Notes (optionnel)</label>
                            <textarea id="gderpi-reception-frs-notes" class="form-control" rows="2"></textarea>
                        </div>
                    </div>
                    <div class="gderpi-modal__footer">
                        <button type="button" class="btn btn-outline btn-sm" data-gderpi-modal-close>Annuler</button>
                        <button type="button" class="btn btn-primary btn-sm" id="gderpi-reception-frs-save">Enregistrer la réception</button>
                    </div>
                </div>
            </div>

            <!-- Modale facturation partielle -->
            <div id="gderpi-facturation-modal" class="gderpi-modal gderpi-modal--lg" hidden>
                <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                    <div class="gderpi-modal__header">
                        <strong class="gderpi-modal__title" id="gderpi-facturation-modal-title">Facturation</strong>
                        <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close>Fermer</button>
                    </div>
                    <div class="gderpi-modal__body" data-gderpi-modal-body>
                        <p class="text-muted small" id="gderpi-facturation-intro">Sélectionnez les lignes livrées à facturer.</p>
                        <div class="gderpi-vue-lc__table-wrap mb-3">
                            <table class="gderpi-vue-lc__table">
                                <thead><tr><th></th><th>Réf.</th><th>Désignation</th><th class="text-end">Cmd.</th><th class="text-end">Fact.</th><th class="text-end">Dispo</th><th>Qté à facturer</th></tr></thead>
                                <tbody id="gderpi-facturation-lines-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                    <div class="gderpi-modal__footer">
                        <button type="button" class="btn btn-outline btn-sm" data-gderpi-modal-close>Annuler</button>
                        <button type="button" class="btn btn-primary btn-sm" id="gderpi-facturation-save">Émettre la facture</button>
                    </div>
                </div>
            </div>

            <!-- Modale avoir partiel -->
            <div id="gderpi-avoir-modal" class="gderpi-modal gderpi-modal--lg" hidden>
                <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                    <div class="gderpi-modal__header">
                        <strong class="gderpi-modal__title" id="gderpi-avoir-modal-title">Avoir</strong>
                        <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close>Fermer</button>
                    </div>
                    <div class="gderpi-modal__body" data-gderpi-modal-body>
                        <p class="text-muted small" id="gderpi-avoir-intro">Sélectionnez les lignes à créditer sur cette facture.</p>
                        <div class="gderpi-vue-lc__table-wrap mb-3">
                            <table class="gderpi-vue-lc__table">
                                <thead><tr><th></th><th>Réf.</th><th>Désignation</th><th class="text-end">Fact.</th><th class="text-end">Avoir</th><th class="text-end">Dispo</th><th>Qté à créditer</th></tr></thead>
                                <tbody id="gderpi-avoir-lines-tbody"></tbody>
                            </table>
                        </div>
                        <div class="gderpi-field">
                            <label class="gderpi-field__label" for="gderpi-avoir-motif">Motif (optionnel)</label>
                            <input id="gderpi-avoir-motif" class="form-control" type="text" placeholder="Ex. retour partiel, erreur de facturation…">
                        </div>
                    </div>
                    <div class="gderpi-modal__footer">
                        <button type="button" class="btn btn-outline btn-sm" data-gderpi-modal-close>Annuler</button>
                        <button type="button" class="btn btn-primary btn-sm" id="gderpi-avoir-save">Émettre l'avoir</button>
                    </div>
                </div>
            </div>

            <!-- Modale livraison prestation -->
            <div id="gderpi-recette-modal" class="gderpi-modal gderpi-modal--md" hidden>
                <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                    <div class="gderpi-modal__header">
                        <strong class="gderpi-modal__title" id="gderpi-recette-modal-title">Livraison prestation</strong>
                        <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close>Fermer</button>
                    </div>
                    <div class="gderpi-modal__body" data-gderpi-modal-body>
                        <p class="text-muted small" id="gderpi-recette-intro">Indiquez les prestations ou développements livrés pour cette commande.</p>
                        <div id="gderpi-recette-lines-wrap" class="gderpi-vue-lc__table-wrap mb-3" hidden>
                            <table class="gderpi-vue-lc__table">
                                <thead><tr><th></th><th>Réf.</th><th>Désignation</th></tr></thead>
                                <tbody id="gderpi-recette-lines-tbody"></tbody>
                            </table>
                        </div>
                        <div class="gderpi-field mb-2">
                            <label class="gderpi-field__label" for="gderpi-recette-libelle">Libellé</label>
                            <input id="gderpi-recette-libelle" class="form-control" type="text" value="Livraison prestation">
                        </div>
                        <div class="gderpi-field">
                            <label class="gderpi-field__label" for="gderpi-recette-notes">Notes (optionnel)</label>
                            <textarea id="gderpi-recette-notes" class="form-control" rows="3"></textarea>
                        </div>
                    </div>
                    <div class="gderpi-modal__footer">
                        <button type="button" class="btn btn-outline btn-sm" data-gderpi-modal-close>Annuler</button>
                        <button type="button" class="btn btn-primary btn-sm" id="gderpi-recette-save">Enregistrer la livraison</button>
                    </div>
                </div>
            </div>

            <!-- Configuration -->
            <section id="gderpi-panel-configuration" class="gderpi-main-panel" hidden>
            <!-- Boutiques (configuration) -->
                <div id="gderpi-config-panel-boutiques" class="gderpi-config-panel" hidden>
                <div id="gderpi-boutiques-list-wrap">
                <div class="gderpi-vue-lc" data-gderpi-vue-lc="boutiques">
                    <div class="gderpi-vue-lc__header">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Boutiques</h3>
                            <p class="gderpi-vue-lc__desc">Identités commerciales — marque, légal, paramètres devis.</p>
                        </div>
                        <?php if ($canWriteGderpi): ?>
                        <button type="button" class="btn btn-primary btn-sm" data-gderpi-lc-create="boutiques" aria-expanded="false">+ Nouvelle boutique</button>
                        <?php endif; ?>
                    </div>
                    <?php if ($canWriteGderpi): ?>
                    <div class="gderpi-vue-lc__create-panel" data-gderpi-lc-create-panel="boutiques" hidden>
                        <form id="gderpi-boutique-form" class="gderpi-form">
                            <h4 id="gderpi-boutique-form-title">Nouvelle boutique</h4>
                            <div id="gderpi-boutique-annuaire-notice" class="alert alert-info gderpi-annuaire-notice" hidden></div>

                            <div class="gderpi-form-section-title">Identité</div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-nom">Nom commercial <span class="gderpi-required">*</span></label>
                                    <input id="gderpi-boutique-nom" class="form-control" type="text" required>
                                </div>
                                <div class="gderpi-field gderpi-field--check">
                                    <label class="gderpi-field__check" for="gderpi-boutique-actif">
                                        <input id="gderpi-boutique-actif" type="checkbox" checked> Boutique active
                                    </label>
                                </div>
                                <div class="gderpi-field gderpi-field--check">
                                    <label class="gderpi-field__check" for="gderpi-boutique-principale">
                                        <input id="gderpi-boutique-principale" type="checkbox"> Boutique principale (fiche entreprise UGAP / GDRI)
                                    </label>
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Informations légales</div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-rs">Raison sociale</label>
                                    <input id="gderpi-boutique-rs" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-forme">Forme juridique</label>
                                    <input id="gderpi-boutique-forme" class="form-control" type="text" placeholder="SARL, SAS…">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-siret">SIRET</label>
                                    <input id="gderpi-boutique-siret" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-tva">TVA intracommunautaire</label>
                                    <input id="gderpi-boutique-tva" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-rcs">RCS</label>
                                    <input id="gderpi-boutique-rcs" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-capital">Capital</label>
                                    <input id="gderpi-boutique-capital" class="form-control" type="text" placeholder="2000">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-devise">Devise</label>
                                    <select id="gderpi-boutique-devise" class="form-control">
                                        <option value="EUR" selected>Euro (€)</option>
                                        <option value="USD">Dollar ($)</option>
                                        <option value="GBP">Livre (£)</option>
                                        <option value="CHF">Franc suisse (CHF)</option>
                                    </select>
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Adresse</div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-boutique-adresse">Adresse</label>
                                    <input id="gderpi-boutique-adresse" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-cp">Code postal</label>
                                    <input id="gderpi-boutique-cp" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-ville">Ville</label>
                                    <input id="gderpi-boutique-ville" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-pays">Pays</label>
                                    <input id="gderpi-boutique-pays" class="form-control" type="text" value="France">
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Contact</div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-email">Email général</label>
                                    <input id="gderpi-boutique-email" class="form-control" type="email">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-tel">Téléphone général</label>
                                    <input id="gderpi-boutique-tel" class="form-control" type="text">
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-web">Site web</label>
                                    <input id="gderpi-boutique-web" class="form-control" type="url" placeholder="https://">
                                </div>
                            </div>

                            <div class="gderpi-client-sublist">
                                <div class="gderpi-client-sublist__header">
                                    <div class="gderpi-form-section-title" style="margin:0;border:0;padding:0;">Contacts devis</div>
                                    <?php if ($canWriteGderpi): ?>
                                    <button type="button" id="gderpi-boutique-contact-add" class="btn btn-outline btn-sm">+ Contact</button>
                                    <?php endif; ?>
                                </div>
                                <p class="gderpi-field-hint gderpi-boutique-contacts-hint" style="margin-top:0;">Personnes sur le devis (« De la part de ») — enregistrées dans l'Annuaire.</p>
                                <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
                                    <table class="gderpi-vue-lc__table gderpi-client-sublist__table">
                                        <thead>
                                            <tr>
                                                <th></th>
                                                <th>Nom</th>
                                                <th>Fonction</th>
                                                <th>Email</th>
                                                <th>Téléphone</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody id="gderpi-boutique-contacts-tbody"></tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="gderpi-form-section-title">Paramètres devis</div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field gderpi-field--full">
                                    <span class="gderpi-field__label">Logo</span>
                                    <div class="gderpi-image-upload">
                                        <div id="gderpi-boutique-logo-preview" class="gderpi-image-upload__preview">
                                            <span class="gderpi-image-upload__placeholder">Aucun logo</span>
                                        </div>
                                        <div class="gderpi-image-upload__actions">
                                            <input id="gderpi-boutique-logo-file" class="gderpi-image-upload__file-native" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" tabindex="-1" aria-hidden="true">
                                            <button type="button" id="gderpi-boutique-logo-browse" class="btn btn-outline btn-sm">Choisir une image</button>
                                            <span id="gderpi-boutique-logo-filename" class="gderpi-image-upload__filename" aria-live="polite"></span>
                                            <button type="button" id="gderpi-boutique-logo-clear" class="btn btn-outline btn-sm">Retirer</button>
                                        </div>
                                        <span class="gderpi-image-upload__or">ou URL (logo hébergé ailleurs — se met à jour automatiquement)</span>
                                        <input id="gderpi-boutique-logo-url" class="form-control" type="text" inputmode="url" placeholder="https://…" autocomplete="off">
                                        <input id="gderpi-boutique-logo" type="hidden" value="">
                                    </div>
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-boutique-validite">Validité devis (jours)</label>
                                    <input id="gderpi-boutique-validite" class="form-control" type="number" min="1" value="30">
                                </div>
                            </div>
                            <div class="gderpi-form-grid">
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-boutique-pied">Pied de page devis</label>
                                    <textarea id="gderpi-boutique-pied" class="form-control" rows="2"></textarea>
                                </div>
                                <div class="gderpi-field gderpi-field--full">
                                    <p class="gderpi-field-hint">Les conditions de vente (CGV) se configurent dans le sous-menu <em>Configuration → Boutiques → CGV</em>.</p>
                                </div>
                            </div>

                            <div class="gderpi-form-actions">
                                <button type="submit" id="gderpi-boutique-submit" class="btn btn-primary btn-sm">Créer la boutique</button>
                                <button type="button" id="gderpi-boutique-cancel" class="btn btn-outline btn-sm">Annuler</button>
                            </div>
                        </form>
                    </div>
                    <?php endif; ?>
                    <div class="gderpi-vue-lc__list-header">Liste</div>
                    <p class="gderpi-field-hint" style="margin:0 0 0.5rem;">Cliquez une ligne pour la sélectionner — elle sera utilisée dans <em>Configuration → Boutiques → CGV</em>. Double-clic pour modifier.</p>
                    <div class="gderpi-vue-lc__toolbar">
                        <input type="search" class="form-control form-control-sm" data-gderpi-lc-search="boutiques" placeholder="Rechercher…" style="max-width:260px;">
                        <label class="gderpi-toolbar-check" for="gderpi-boutique-filter-actif">
                            <input id="gderpi-boutique-filter-actif" type="checkbox"> Actives seulement
                        </label>
                        <span class="gderpi-vue-lc__count" data-gderpi-lc-count="boutiques"></span>
                    </div>
                    <div class="gderpi-vue-lc__table-wrap">
                        <table class="gderpi-vue-lc__table">
                            <thead><tr><th>Nom</th><th>Raison sociale</th><th>Ville</th><th>Statut</th><th></th></tr></thead>
                            <tbody data-gderpi-lc-tbody="boutiques"></tbody>
                        </table>
                    </div>
                    </div>
                </div>
                <div id="gderpi-boutique-contact-modal" class="gderpi-modal gderpi-modal--md" hidden>
                    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
                    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
                        <div class="gderpi-modal__header">
                            <strong class="gderpi-modal__title" data-gderpi-modal-title id="gderpi-boutique-contact-modal-title">Contact</strong>
                            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close type="button">Fermer</button>
                        </div>
                        <div class="gderpi-modal__body" data-gderpi-modal-body>
                            <form id="gderpi-boutique-contact-form" class="gderpi-form">
                                <div class="gderpi-form-grid">
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-boutique-contact-prenom">Prénom</label>
                                        <input id="gderpi-boutique-contact-prenom" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-boutique-contact-nom">Nom</label>
                                        <input id="gderpi-boutique-contact-nom" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-boutique-contact-fonction">Fonction</label>
                                        <input id="gderpi-boutique-contact-fonction" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-boutique-contact-email">Email</label>
                                        <input id="gderpi-boutique-contact-email" class="form-control" type="email">
                                    </div>
                                    <div class="gderpi-field">
                                        <label class="gderpi-field__label" for="gderpi-boutique-contact-tel">Téléphone</label>
                                        <input id="gderpi-boutique-contact-tel" class="form-control" type="text">
                                    </div>
                                    <div class="gderpi-field gderpi-field--check gderpi-field--full">
                                        <label class="gderpi-field__check" for="gderpi-boutique-contact-principal">
                                            <input id="gderpi-boutique-contact-principal" type="checkbox"> Contact principal
                                        </label>
                                    </div>
                                </div>
                                <div class="gderpi-form-actions">
                                    <button type="submit" class="btn btn-primary btn-sm" id="gderpi-boutique-contact-save">Enregistrer</button>
                                    <button type="button" class="btn btn-outline btn-sm" id="gderpi-boutique-contact-cancel">Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                </div>

                <div id="gderpi-config-panel-boutiques-cgv" class="gderpi-config-panel" hidden>
                <div id="gderpi-boutique-config" class="gderpi-boutique-config">
                    <div class="gderpi-boutique-config__header">
                        <div>
                            <h3 class="gderpi-boutique-config__title">Conditions générales de vente</h3>
                            <p class="gderpi-boutique-config__panel-desc">Blocs modulaires repris sur les devis PDF. Sélectionnez la boutique à configurer.</p>
                        </div>
                        <div class="gderpi-field" style="min-width:220px;margin:0;">
                            <label class="gderpi-field__label" for="gderpi-boutique-cgv-select">Boutique</label>
                            <select id="gderpi-boutique-cgv-select" class="form-control form-control-sm"></select>
                        </div>
                    </div>
                    <div class="gderpi-boutique-config__layout gderpi-boutique-config__layout--single">
                        <div class="gderpi-boutique-config__content">
                            <section id="gderpi-boutique-config-panel-conditions" class="gderpi-boutique-config__panel">
                                <h4 class="gderpi-boutique-config__panel-title" id="gderpi-boutique-config-subtitle">Conditions de vente</h4>
                                <p class="gderpi-boutique-config__panel-desc">Blocs modulaires repris sur les devis PDF. Les dispositions communes s’appliquent à tous les clients ; les onglets <strong>B2B</strong> et <strong>B2C</strong> sont sélectionnés automatiquement selon le type de client.</p>
                                <?php if ($canWriteGderpi): ?>
                                <div class="gderpi-conditions-blocks">
                                    <label class="gderpi-field gderpi-field--full">
                                        <span class="gderpi-field__label">Dispositions communes</span>
                                        <textarea id="gderpi-boutique-conditions-communes" class="form-control gderpi-conditions-editor" rows="5" placeholder="Prix, validité du devis, réserve de propriété…"></textarea>
                                    </label>
                                    <div class="gderpi-conditions-tabs" data-gderpi-conditions-tabs>
                                        <div class="gderpi-conditions-tabs__nav" role="tablist" aria-label="Type de client">
                                            <button type="button" class="gderpi-conditions-tabs__btn active" role="tab" aria-selected="true" data-gderpi-conditions-tab="b2b">B2B — Professionnels</button>
                                            <button type="button" class="gderpi-conditions-tabs__btn" role="tab" aria-selected="false" data-gderpi-conditions-tab="b2c">B2C — Particuliers</button>
                                        </div>
                                        <div id="gderpi-boutique-conditions-panel-b2b" class="gderpi-conditions-tabs__panel active" role="tabpanel" data-gderpi-conditions-panel="b2b">
                                            <div class="gderpi-conditions-tabs__toolbar">
                                                <button type="button" id="gderpi-boutique-conditions-reset-b2b" class="btn btn-outline btn-sm">Réinitialiser B2B</button>
                                            </div>
                                            <fieldset class="gderpi-conditions-fieldset">
                                                <legend class="gderpi-conditions-fieldset__legend">Paiement</legend>
                                                <label class="gderpi-field gderpi-field--full">
                                                    <span class="gderpi-field__label">Moyens de paiement acceptés</span>
                                                    <span class="gderpi-field-hint">Comment le client règle : virement, chèque, carte, prélèvement… Retirez ceux que vous ne proposez pas.</span>
                                                    <textarea id="gderpi-boutique-conditions-paiement-pro-modes" class="form-control gderpi-conditions-editor" rows="5" placeholder="Virement, chèque, carte bancaire…"></textarea>
                                                </label>
                                                <label class="gderpi-field gderpi-field--full">
                                                    <span class="gderpi-field__label">Délais et échéances de paiement</span>
                                                    <span class="gderpi-field-hint">Quand le client paie : 30 jours, comptant, à la livraison, acompte + solde… Puis pénalités de retard si applicable.</span>
                                                    <textarea id="gderpi-boutique-conditions-paiement-pro-delais" class="form-control gderpi-conditions-editor" rows="6" placeholder="30 jours, à la livraison, acompte + solde…"></textarea>
                                                </label>
                                            </fieldset>
                                            <label class="gderpi-field gderpi-field--full">
                                                <span class="gderpi-field__label">Livraison</span>
                                                <textarea id="gderpi-boutique-conditions-livraison-pro" class="form-control gderpi-conditions-editor" rows="3"></textarea>
                                            </label>
                                            <label class="gderpi-field gderpi-field--full">
                                                <span class="gderpi-field__label">Garanties</span>
                                                <textarea id="gderpi-boutique-conditions-garanties-pro" class="form-control gderpi-conditions-editor" rows="3"></textarea>
                                            </label>
                                            <label class="gderpi-field gderpi-field--full">
                                                <span class="gderpi-field__label">Litiges</span>
                                                <textarea id="gderpi-boutique-conditions-litiges-pro" class="form-control gderpi-conditions-editor" rows="4"></textarea>
                                            </label>
                                        </div>
                                        <div id="gderpi-boutique-conditions-panel-b2c" class="gderpi-conditions-tabs__panel" role="tabpanel" hidden data-gderpi-conditions-panel="b2c">
                                            <div class="gderpi-conditions-tabs__toolbar">
                                                <button type="button" id="gderpi-boutique-conditions-reset-b2c" class="btn btn-outline btn-sm">Réinitialiser B2C</button>
                                            </div>
                                            <label class="gderpi-field gderpi-field--full">
                                                <span class="gderpi-field__label">Paiement</span>
                                                <textarea id="gderpi-boutique-conditions-paiement-particulier" class="form-control gderpi-conditions-editor" rows="4" placeholder="Paiement comptant, échéances…"></textarea>
                                            </label>
                                            <label class="gderpi-field gderpi-field--full">
                                                <span class="gderpi-field__label">Retours et rétractation</span>
                                                <textarea id="gderpi-boutique-conditions-retour-particulier" class="form-control gderpi-conditions-editor" rows="6" placeholder="Délai de 14 jours, état des produits, exclusions…"></textarea>
                                            </label>
                                            <label class="gderpi-field gderpi-field--full">
                                                <span class="gderpi-field__label">Livraison</span>
                                                <textarea id="gderpi-boutique-conditions-livraison-particulier" class="form-control gderpi-conditions-editor" rows="3"></textarea>
                                            </label>
                                            <label class="gderpi-field gderpi-field--full">
                                                <span class="gderpi-field__label">Garanties</span>
                                                <textarea id="gderpi-boutique-conditions-garanties-particulier" class="form-control gderpi-conditions-editor" rows="3"></textarea>
                                            </label>
                                            <label class="gderpi-field gderpi-field--full">
                                                <span class="gderpi-field__label">Litiges et médiation</span>
                                                <textarea id="gderpi-boutique-conditions-litiges-particulier" class="form-control gderpi-conditions-editor" rows="4"></textarea>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div class="gderpi-form-actions">
                                    <button type="button" id="gderpi-boutique-conditions-save" class="btn btn-primary btn-sm">Enregistrer les conditions</button>
                                </div>
                                <?php else: ?>
                                <div id="gderpi-boutique-conditions-readonly" class="gderpi-conditions-readonly"></div>
                                <?php endif; ?>
                            </section>
                        </div>
                    </div>
                </div>
                </div>
                <div id="gderpi-config-panel-articles" class="gderpi-config-panel" hidden>
                    <div class="gderpi-vue-lc__header" style="margin-bottom:1rem;">
                        <div>
                            <h3 class="gderpi-vue-lc__title">Paramètres articles</h3>
                            <p class="gderpi-vue-lc__desc">Options et comportements des fiches articles du catalogue.</p>
                        </div>
                    </div>
                    <div class="gderpi-panel-card">
                        <p><strong>Types disponibles</strong> : produit, service, <em>développement</em>.</p>
                        <p class="mb-0">Le type <strong>développement</strong> est prévu pour des prestations détaillées sur devis (commentaire modifiable à la création du devis).</p>
                    </div>
                    <div class="gderpi-panel-card" style="margin-top:1rem;">
                        <p><strong>Unités</strong> : configurez la liste des unités de mesure dans le sous-menu <em>Unités</em> de la barre latérale.</p>
                        <p class="mb-0"><strong>Commentaire devis</strong> : renseigné sur chaque article, repris comme texte par défaut sur les lignes de devis.</p>
                    </div>
                    <div class="gderpi-panel-card" style="margin-top:1rem;">
                        <p class="mb-0"><strong>Prix sur devis</strong> : pour les prestations forfaitaires ou sur mesure, cochez cette option sur l'article — le prix catalogue peut rester à 0, mais sera obligatoire lors de la création du devis.</p>
                    </div>
                </div>
                <div id="gderpi-config-panel-unites" class="gderpi-config-panel" hidden>
                        <div class="gderpi-vue-lc" data-gderpi-vue-lc="unites">
                            <div class="gderpi-vue-lc__header">
                                <div>
                                    <h3 class="gderpi-vue-lc__title">Unités de mesure</h3>
                                    <p class="gderpi-vue-lc__desc">Paramétrage des unités utilisées dans les fiches articles. Double-clic pour éditer.</p>
                                </div>
                                <?php if ($canWriteGderpi): ?>
                                <button type="button" class="btn btn-primary btn-sm" data-gderpi-lc-create="unites" aria-expanded="false">+ Nouvelle unité</button>
                                <?php endif; ?>
                            </div>
                            <?php if ($canWriteGderpi): ?>
                            <div class="gderpi-vue-lc__create-panel" data-gderpi-lc-create-panel="unites" hidden>
                                <form id="gderpi-unite-form" class="gderpi-form">
                                    <h4 id="gderpi-unite-form-title">Nouvelle unité</h4>
                                    <div class="gderpi-form-grid">
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-unite-libelle">Libellé <span class="gderpi-required">*</span></label>
                                            <input id="gderpi-unite-libelle" class="form-control" type="text" required placeholder="Heure, Forfait…">
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-unite-code">Code</label>
                                            <input id="gderpi-unite-code" class="form-control" type="text" placeholder="Généré depuis le libellé si vide">
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-unite-ordre">Ordre</label>
                                            <input id="gderpi-unite-ordre" class="form-control" type="number" value="0">
                                        </div>
                                        <div class="gderpi-field gderpi-field--check">
                                            <label class="gderpi-field__check" for="gderpi-unite-actif">
                                                <input id="gderpi-unite-actif" type="checkbox" checked> Unité active
                                            </label>
                                        </div>
                                    </div>
                                    <div class="gderpi-form-actions">
                                        <button type="submit" id="gderpi-unite-submit" class="btn btn-primary btn-sm">Créer l'unité</button>
                                        <button type="button" id="gderpi-unite-cancel" class="btn btn-outline btn-sm">Annuler</button>
                                    </div>
                                </form>
                            </div>
                            <?php endif; ?>
                            <div class="gderpi-vue-lc__list-header">Liste</div>
                            <div class="gderpi-vue-lc__toolbar">
                                <input type="search" class="form-control form-control-sm" data-gderpi-lc-search="unites" placeholder="Rechercher…" style="max-width:260px;">
                                <label class="gderpi-toolbar-check" for="gderpi-unite-filter-actif">
                                    <input id="gderpi-unite-filter-actif" type="checkbox"> Actives seulement
                                </label>
                                <span class="gderpi-vue-lc__count" data-gderpi-lc-count="unites"></span>
                            </div>
                            <div class="gderpi-vue-lc__table-wrap">
                                <table class="gderpi-vue-lc__table">
                                    <thead><tr><th>Libellé</th><th>Code</th><th>Ordre</th><th>Statut</th><th></th></tr></thead>
                                    <tbody data-gderpi-lc-tbody="unites"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                <div id="gderpi-config-panel-services" class="gderpi-config-panel" hidden>
                        <div class="gderpi-vue-lc" data-gderpi-vue-lc="client-services">
                            <div class="gderpi-vue-lc__header">
                                <div>
                                    <h3 class="gderpi-vue-lc__title">Services clients</h3>
                                    <p class="gderpi-vue-lc__desc">Référentiel entreprise pour les contacts (Commercial, Technique…). Double-clic pour éditer.</p>
                                </div>
                                <?php if ($canWriteGderpi): ?>
                                <button type="button" class="btn btn-primary btn-sm" data-gderpi-lc-create="client-services" aria-expanded="false">+ Nouveau service</button>
                                <?php endif; ?>
                            </div>
                            <?php if ($canWriteGderpi): ?>
                            <div class="gderpi-vue-lc__create-panel" data-gderpi-lc-create-panel="client-services" hidden>
                                <form id="gderpi-client-service-form" class="gderpi-form">
                                    <h4 id="gderpi-client-service-form-title">Nouveau service</h4>
                                    <div class="gderpi-form-grid">
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-client-service-libelle">Libellé <span class="gderpi-required">*</span></label>
                                            <input id="gderpi-client-service-libelle" class="form-control" type="text" required placeholder="Commercial, Technique…">
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-client-service-code">Code</label>
                                            <input id="gderpi-client-service-code" class="form-control" type="text" placeholder="Généré depuis le libellé si vide">
                                        </div>
                                        <div class="gderpi-field">
                                            <label class="gderpi-field__label" for="gderpi-client-service-ordre">Ordre</label>
                                            <input id="gderpi-client-service-ordre" class="form-control" type="number" value="0">
                                        </div>
                                        <div class="gderpi-field gderpi-field--check">
                                            <label class="gderpi-field__check" for="gderpi-client-service-actif">
                                                <input id="gderpi-client-service-actif" type="checkbox" checked> Service actif
                                            </label>
                                        </div>
                                    </div>
                                    <div class="gderpi-form-actions">
                                        <button type="submit" id="gderpi-client-service-submit" class="btn btn-primary btn-sm">Créer le service</button>
                                        <button type="button" id="gderpi-client-service-cancel" class="btn btn-outline btn-sm">Annuler</button>
                                    </div>
                                </form>
                            </div>
                            <?php endif; ?>
                            <div class="gderpi-vue-lc__list-header">Liste</div>
                            <div class="gderpi-vue-lc__toolbar">
                                <input type="search" class="form-control form-control-sm" data-gderpi-lc-search="client-services" placeholder="Rechercher…" style="max-width:260px;">
                                <label class="gderpi-toolbar-check" for="gderpi-client-service-filter-actif">
                                    <input id="gderpi-client-service-filter-actif" type="checkbox"> Actifs seulement
                                </label>
                                <span class="gderpi-vue-lc__count" data-gderpi-lc-count="client-services"></span>
                            </div>
                            <div class="gderpi-vue-lc__table-wrap">
                                <table class="gderpi-vue-lc__table">
                                    <thead><tr><th>Libellé</th><th>Code</th><th>Ordre</th><th>Statut</th><th></th></tr></thead>
                                    <tbody data-gderpi-lc-tbody="client-services"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                <div id="gderpi-config-panel-mail-accounts" class="gderpi-config-panel" hidden>
                    <div class="gderpi-vue-lc" data-gderpi-vue-lc="mail-accounts">
                        <div class="gderpi-vue-lc__header">
                            <div>
                                <h3 class="gderpi-vue-lc__title">Associations comptes mail</h3>
                            </div>
                            <?php if ($canWriteGderpi): ?>
                            <div class="gderpi-mail-header-actions">
                                <button type="button" id="gderpi-mail-refresh-accounts" class="btn btn-outline btn-sm">Actualiser</button>
                                <button type="button" id="gderpi-mail-add-account" class="btn btn-outline btn-sm">+ Compte mail</button>
                                <button type="button" id="gderpi-mail-save-accounts" class="btn btn-primary btn-sm">Enregistrer</button>
                            </div>
                            <?php endif; ?>
                        </div>

                        <div class="gderpi-vue-lc__list-header">Liste</div>
                        <div class="gderpi-vue-lc__toolbar">
                            <input type="search" id="gderpi-mail-search" class="form-control form-control-sm" placeholder="Rechercher boutique, émetteur, e-mail…" style="max-width:280px;">
                            <label class="gderpi-toolbar-check" for="gderpi-mail-filter-unmapped">
                                <input type="checkbox" id="gderpi-mail-filter-unmapped"> Non associés seulement
                            </label>
                            <span id="gderpi-mail-row-count" class="gderpi-vue-lc__count"></span>
                        </div>
                        <div class="gderpi-vue-lc__table-wrap">
                            <table class="gderpi-vue-lc__table gderpi-mail-mappings-table">
                                <thead>
                                    <tr>
                                        <th>Émetteur</th>
                                        <th>Contact</th>
                                        <th>E-mail</th>
                                        <th>Compte mail</th>
                                        <th>Statut</th>
                                    </tr>
                                </thead>
                                <tbody id="gderpi-mail-mappings-tbody">
                                    <tr><td colspan="5" class="text-muted">Chargement…</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="gderpi-config-panel-mail-devis" class="gderpi-config-panel" hidden>
                    <div class="gderpi-vue-lc" data-gderpi-vue-lc="mail-devis">
                        <div class="gderpi-vue-lc__header">
                            <div>
                                <h3 class="gderpi-vue-lc__title">Modèles d'e-mail</h3>
                                <p class="gderpi-vue-lc__desc">Sujet et introduction pour chaque type d'envoi (liens publics inclus automatiquement).</p>
                            </div>
                        </div>
                        <div class="gderpi-mail-template-tabs" role="tablist" aria-label="Type d'e-mail">
                            <button type="button" class="btn btn-outline btn-sm active" data-gderpi-mail-template="devis">Devis</button>
                            <button type="button" class="btn btn-outline btn-sm" data-gderpi-mail-template="commande_client">Commande client</button>
                            <button type="button" class="btn btn-outline btn-sm" data-gderpi-mail-template="facture">Facture</button>
                            <button type="button" class="btn btn-outline btn-sm" data-gderpi-mail-template="avoir">Avoir</button>
                            <button type="button" class="btn btn-outline btn-sm" data-gderpi-mail-template="commande_fournisseur">Cmd. fournisseur</button>
                        </div>
                        <?php if ($canWriteGderpi): ?>
                        <form id="gderpi-mail-settings-form" class="gderpi-form gderpi-mail-devis-form">
                            <div class="gderpi-form-grid" style="margin-top:1rem;">
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-mail-subject">Sujet</label>
                                    <input id="gderpi-mail-subject" class="form-control" type="text" placeholder="Sujet de l'e-mail">
                                    <p class="gderpi-field-hint" id="gderpi-mail-vars-hint">Variables : {{numero}}, {{contactNom}}, …</p>
                                </div>
                                <div class="gderpi-field gderpi-field--full">
                                    <label class="gderpi-field__label" for="gderpi-mail-intro">Introduction (HTML)</label>
                                    <textarea id="gderpi-mail-intro" class="form-control" rows="5" placeholder="<p>Bonjour {{contactNom}},</p>…"></textarea>
                                    <p class="gderpi-field-hint">Un message personnalisé peut encore être ajouté à chaque envoi, en plus de ce modèle.</p>
                                </div>
                                <div class="gderpi-field">
                                    <label class="gderpi-field__label" for="gderpi-mail-ttl">Validité des liens (jours)</label>
                                    <input id="gderpi-mail-ttl" class="form-control" type="number" min="1" max="365" value="30">
                                </div>
                                <div class="gderpi-field gderpi-field--check" id="gderpi-mail-devis-only">
                                    <label class="gderpi-field__check" for="gderpi-mail-enable-accept">
                                        <input id="gderpi-mail-enable-accept" type="checkbox" checked> Inclure le lien de confirmation de commande (devis)
                                    </label>
                                </div>
                            </div>
                            <div class="gderpi-form-actions">
                                <button type="submit" class="btn btn-primary btn-sm">Enregistrer les modèles</button>
                            </div>
                        </form>
                        <?php else: ?>
                        <p class="text-muted small">Lecture seule — contactez un administrateur pour modifier le modèle.</p>
                        <?php endif; ?>
                        <div class="gderpi-mail-preview" id="gderpi-mail-preview">
                            <div class="gderpi-mail-preview__toolbar">
                                <div>
                                    <strong class="gderpi-mail-preview__title">Aperçu de l'e-mail complet</strong>
                                    <p class="gderpi-field-hint gderpi-mail-preview__hint">Rendu réel avec données fictives, liens et bandeau titre inclus.</p>
                                </div>
                                <label class="gderpi-field__check gderpi-mail-preview__sample-toggle">
                                    <input type="checkbox" id="gderpi-mail-preview-sample-message"> Message personnalisé d'exemple
                                </label>
                            </div>
                            <div class="gderpi-mail-preview__subject">
                                <span class="gderpi-mail-preview__subject-label">Sujet :</span>
                                <span id="gderpi-mail-preview-subject" class="gderpi-mail-preview__subject-value">—</span>
                            </div>
                            <div class="gderpi-mail-preview__frame-wrap">
                                <iframe id="gderpi-mail-preview-frame" class="gderpi-mail-preview__frame" title="Aperçu e-mail" sandbox="allow-same-origin"></iframe>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    </div>
</div>

<div id="gderpi-service-quick-modal" class="gderpi-modal gderpi-modal--sm" hidden>
    <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
    <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
        <div class="gderpi-modal__header">
            <strong class="gderpi-modal__title" data-gderpi-modal-title>Nouveau service</strong>
            <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close type="button">Fermer</button>
        </div>
        <div class="gderpi-modal__body" data-gderpi-modal-body>
            <form id="gderpi-service-quick-form" class="gderpi-form">
                <div class="gderpi-field">
                    <label class="gderpi-field__label" for="gderpi-service-quick-libelle">Libellé <span class="gderpi-required">*</span></label>
                    <input id="gderpi-service-quick-libelle" class="form-control" type="text" required placeholder="Commercial, Technique…">
                </div>
                <p class="gderpi-field-hint">Le service sera ajouté au référentiel entreprise (Configuration → Clients → Services).</p>
                <div class="gderpi-form-actions">
                    <button type="submit" class="btn btn-primary btn-sm">Créer</button>
                    <button type="button" class="btn btn-outline btn-sm" id="gderpi-service-quick-cancel">Annuler</button>
                </div>
            </form>
        </div>
    </div>
</div>

<script>
window.GDERPI_CONFIG = {
    apiBase: <?= json_encode($api_base_url, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>,
    jwt: <?= json_encode($jwt_token, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>,
    canWrite: <?= $canWriteGderpi ? 'true' : 'false' ?>,
    entrepriseId: <?= json_encode($gderpiEntrepriseId, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>,
    pmUrl: <?= json_encode(url('pages/modules/pm.php'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>
};
</script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/escapeHtml.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/loadingFeedback.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/showStatus.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/apiCall.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/gderpiAnnuaireBridge.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/shared/gderpiAnnuaireBridge.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/gderpiAnnuaireContactUi.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/shared/gderpiAnnuaireContactUi.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/formatMoney.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/searchArticlesLocal.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/bindArticleSearchField.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/searchClientsLocal.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/bindClientSearchField.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/resolveImageUrl.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/uploadImage.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/bindImageUploadField.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/bindTierDocumentsSection.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/bindGderpiModal.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/bindEmailContactChipField.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/shared/bindEmailContactChipField.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/bindSendEmailModal.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/shared/bindSendEmailModal.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/previewDocumentHtml.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/bindVueLc.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/dashboard/bindDashboardTab.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/nodes/renderNodesTree.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/nodes/bindNodesTab.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/loadArticleUnites.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/loadClientServices.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/bindServiceSelectField.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/configuration/bindConfigurationTab.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/configuration/bindConfigurationTab.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/configuration/bindMailConfigTab.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/configuration/bindMailConfigTab.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/configuration/bindUnitesTab.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/configuration/bindClientServicesTab.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/boutiques/conditionsVenteDefaults.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/boutiques/bindBoutiqueConfig.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/boutiques/bindBoutiquesTab.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/shared/resolveArticleTarifClient.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/articles/bindArticlesTab.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/devis/devisConditionsPaiementOptions.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/clients/bindClientsTab.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/fournisseurs/bindFournisseursTab.js"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/devis/bindDevisTab.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/devis/bindDevisTab.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/commandes/commandeClientHelpers.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/commandes/commandeClientHelpers.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/commandes/commandeClientWorkflow.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/commandes/commandeClientWorkflow.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/commandes/bindBonLivraisonEditor.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/commandes/bindBonLivraisonEditor.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/commandes/bindBonsLivraisonTab.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/commandes/bindBonsLivraisonTab.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/commandes/bindReceptionFournisseurModal.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/commandes/bindReceptionFournisseurModal.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/commandes/bindRecetteModal.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/commandes/bindRecetteModal.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/commandes/bindCommandesClientTab.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/commandes/bindCommandesClientTab.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/commandes/bindCommandeClientEditor.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/commandes/bindCommandeClientEditor.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/commandes/bindCommandeFournisseurEditor.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/commandes/bindCommandeFournisseurEditor.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/achats/bindAchatsTab.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/achats/bindAchatsTab.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/facturation/bindFacturationModal.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/facturation/bindFacturationModal.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/facturation/bindAvoirModal.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/facturation/bindAvoirModal.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/facturation/bindFacturationTab.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/facturation/bindFacturationTab.js') ?>"></script>
<script src="<?= htmlspecialchars($gderpiAssetBase) ?>/assets/js/initGderpiApp.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/gderpi/frontend/assets/js/initGderpiApp.js') ?>"></script>

<?php require_once '../../includes/footer.php'; ?>
