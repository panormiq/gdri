<?php
$__ugapAnnuaireUrl = '/frontend/pages/modules/annuaire.php';
if (function_exists('url')) {
    $__ugapAnnuaireUrl = url('pages/modules/annuaire.php');
}
?>
<section
    class="ugap-param-section-panel"
    id="ugap-section-info-entreprise"
    data-section-panel="info-entreprise"
    data-annuaire-url="<?= htmlspecialchars($__ugapAnnuaireUrl, ENT_QUOTES, 'UTF-8') ?>"
    hidden
>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
            <h2 style="margin:0 0 6px;">Info entreprise</h2>
            <p class="ugap-param-lead" style="margin:0;">
                L'identité de votre entreprise est gérée dans l'Annuaire. Les options ci-dessous sont spécifiques aux devis UGAP.
            </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a href="<?= htmlspecialchars($__ugapAnnuaireUrl, ENT_QUOTES, 'UTF-8') ?>" class="btn btn-outline" target="_blank" rel="noopener">Gérer dans l'Annuaire</a>
            <button type="button" id="ugap-info-entreprise-refresh" class="btn btn-outline">Rafraîchir</button>
        </div>
    </div>

    <div id="ugap-entreprise-identity-preview" class="ugap-devis-identity-preview card" style="margin-top:16px;padding:16px;">
        <h3 style="margin:0 0 10px;font-size:1rem;">Identité (lecture seule — Annuaire)</h3>
        <div id="ugap-entreprise-identity-content" class="ugap-param-placeholder">Chargement…</div>
    </div>

    <form id="ugap-entreprise-info-form" class="ugap-devis-form-grid" style="margin-top:16px;" autocomplete="off">
        <fieldset class="ugap-devis-fieldset ugap-devis-span2">
            <legend>Conditions devis</legend>
            <label>Validité du devis (jours) <input type="number" name="validiteDevisJours" min="1" step="1" value="30"></label>
            <label>Préfixe numéro devis <input type="text" name="numeroDevisPrefix" placeholder="DEV-"></label>
            <label class="ugap-devis-span2">Conditions de paiement <textarea name="conditionsPaiement" rows="2"></textarea></label>
            <label class="ugap-devis-span2">Délai de livraison <textarea name="delaiLivraison" rows="2"></textarea></label>
            <label class="ugap-devis-span2">Mentions légales <textarea name="mentionsLegales" rows="3"></textarea></label>
        </fieldset>

        <div class="ugap-devis-form-actions ugap-devis-span2">
            <button type="submit" class="btn btn-primary">Enregistrer les options devis</button>
            <span id="ugap-entreprise-info-status" class="ugap-devis-form-status" aria-live="polite"></span>
        </div>
    </form>

    <div style="height:1px;background:#e5e7eb;margin:24px 0;"></div>

    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
            <h3 style="margin:0 0 6px;">Commerciaux</h3>
            <p class="ugap-param-lead" style="margin:0;">
                Commerciaux issus des utilisateurs liés à l'entreprise. Sélectionnez un compte pour créer la fiche commercial.
            </p>
        </div>
        <button type="button" id="ugap-commercial-add-btn" class="btn btn-primary">Ajouter un commercial</button>
    </div>

    <div id="ugap-commerciaux-list" style="margin-top:14px;">
        <p class="ugap-param-placeholder">Chargement des commerciaux…</p>
    </div>

    <div id="ugap-commercial-modal" class="ugap-devis-modal hidden" aria-hidden="true">
        <div class="ugap-devis-modal__panel card">
            <div class="ugap-devis-modal__header">
                <h3 id="ugap-commercial-modal-title">Commercial</h3>
                <button type="button" class="ugap-devis-modal__close" id="ugap-commercial-modal-close" aria-label="Fermer">&times;</button>
            </div>
            <form id="ugap-commercial-form" class="ugap-devis-modal__body">
                <input type="hidden" name="id" value="">
                <label>Utilisateur lié
                    <select name="userId" id="ugap-commercial-user-select" required>
                        <option value="">— Choisir —</option>
                    </select>
                </label>
                <label>Prénom <input type="text" name="prenom"></label>
                <label>Nom <input type="text" name="nom"></label>
                <label>Email <input type="email" name="email"></label>
                <label>Téléphone <input type="tel" name="telephone"></label>
                <label>Fonction <input type="text" name="fonction" placeholder="Commercial"></label>
                <label class="ugap-devis-checkbox">
                    <input type="checkbox" name="actif" checked> Actif sur les devis
                </label>
                <div class="ugap-devis-modal__footer">
                    <button type="button" class="btn btn-outline" id="ugap-commercial-modal-cancel">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        </div>
    </div>
</section>
