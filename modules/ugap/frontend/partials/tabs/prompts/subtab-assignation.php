<div id="prompt-subtab-assignation" class="subtab-panel" style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div>
            <h3 style="margin: 0;">Prompt : Assignation familles → vues métier</h3>
            <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">
                Définit le serveur et le modèle utilisés pour l'assignation IA des familles dans l'onglet <strong>Assignations</strong>.
            </p>
        </div>
        <button id="btn-save-assignation-prompt" class="btn btn-success">💾 Enregistrer</button>
    </div>
    <div style="margin-bottom: 12px; padding:10px; border:1px solid #e9ecef; border-radius:6px; background:#fafafa; color:#555; font-size:13px;">
        Le serveur/modèle de l'assignation se règle via le sélecteur global en haut
        (<strong>Serveur (prompt actif)</strong> / <strong>Modèle (prompt actif)</strong>)
        quand cet onglet <strong>Assignation</strong> est actif.
    </div>
    <div style="display:none;" aria-hidden="true">
        <select id="prompt-server-assignation"></select>
        <select id="prompt-model-assignation"></select>
    </div>
    <label for="prompt-assignation-body" style="display:block; margin-bottom:6px; font-weight:600; color:#444;">Prompt assignation</label>
    <textarea id="prompt-assignation-body" rows="14" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; font-family:monospace; font-size:13px; line-height:1.5;"
        placeholder="Utilise les variables: {{businessViews}}, {{familyLabel}}, {{assignation}}, {{subFamily}}, {{optionsCount}}, {{optionsList}}"></textarea>
</div>
