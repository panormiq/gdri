<?php ?>
<section
    class="ugap-param-section-panel"
    id="ugap-section-modele-devis"
    data-section-panel="modele-devis"
    hidden
>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
            <h2 style="margin:0 0 6px;">Modèles de devis</h2>
            <p class="ugap-param-lead" style="margin:0;">
                Formats PDF devis (canvas A4 V2). Le modèle <strong>actif</strong> est utilisé à la génération.
                Collections injectées : logo entreprise, lignes devis, slot moteur (<code>{{ugap:node:moteur.*}}</code>).
            </p>
        </div>
        <button type="button" id="ugap-modele-devis-create" class="btn btn-primary">+ Nouveau modèle</button>
    </div>

    <div id="ugap-modele-devis-grid" class="ugap-devis-template-grid" aria-live="polite"></div>

    <p id="ugap-modele-devis-status" class="ugap-devis-form-status" style="margin-top:12px;" aria-live="polite"></p>
</section>
