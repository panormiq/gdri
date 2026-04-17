<div id="prompt-subtab-extraction-base" class="subtab-panel active" style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
            <h3 style="margin: 0;">Prompt : Extraction des options de base</h3>
            <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">
                Contexte + prompt éditables, lignes à interpréter en lecture seule, format attendu modifiable avec confirmation.
            </p>
        </div>
        <button id="btn-save-extraction-prompt" class="btn btn-success">💾 Enregistrer</button>
    </div>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:10px; margin-bottom: 10px;">
        <div>
            <label for="prompt-server-subcategory" style="display:block; margin-bottom:6px; font-weight:600; color:#444;">Serveur IA</label>
            <select id="prompt-server-subcategory" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;"></select>
        </div>
        <div>
            <label for="prompt-model-subcategory" style="display:block; margin-bottom:6px; font-weight:600; color:#444;">Modèle (LLM)</label>
            <select id="prompt-model-subcategory" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;"></select>
        </div>
    </div>

    <div style="display: grid; gap: 12px;">
        <div>
            <label style="display:block; font-weight:600; margin-bottom:6px;">Contexte (éditable)</label>
            <textarea id="prompt-extraction-context" rows="6" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px;"></textarea>
        </div>
        <div>
            <label style="display:block; font-weight:600; margin-bottom:6px;">Prompt (éditable)</label>
            <textarea id="prompt-extraction-body" rows="8" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px;"></textarea>
        </div>
        <div>
            <label style="display:block; font-weight:600; margin-bottom:6px;">Lignes à interpréter (lecture seule)</label>
            <select id="prompt-extraction-lines-select" size="8" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background:#f8f9fa;" disabled></select>
            <div id="prompt-extraction-lines-count" style="margin-top:6px; color:#666; font-size:12px;"></div>
        </div>
        <div>
            <label style="display:block; font-weight:600; margin-bottom:6px;">Format de retour attendu (modifiable avec confirmation)</label>
            <select id="prompt-extraction-format" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></select>
        </div>
        <div>
            <label style="display:block; font-weight:600; margin-bottom:6px;">Aperçu format attendu (éditable)</label>
            <textarea id="prompt-extraction-format-text" rows="8" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px;"></textarea>
        </div>
    </div>
</div>
