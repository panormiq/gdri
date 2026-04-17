<div id="prompt-subtab-minoration" class="subtab-panel" style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div>
            <h3 style="margin: 0;">Prompt : Assignation des minorations</h3>
            <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">
                Détermine postes, option actuelle, option remplaçante et moins-value.
            </p>
        </div>
        <button id="btn-save-minoration-prompt" class="btn btn-success">💾 Enregistrer</button>
    </div>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:10px; margin-bottom: 10px;">
        <div>
            <label for="prompt-server-minoration" style="display:block; margin-bottom:6px; font-weight:600; color:#444;">Serveur IA</label>
            <select id="prompt-server-minoration" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;"></select>
        </div>
        <div>
            <label for="prompt-model-minoration" style="display:block; margin-bottom:6px; font-weight:600; color:#444;">Modèle (LLM)</label>
            <select id="prompt-model-minoration" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;"></select>
        </div>
    </div>
    <textarea id="prompt-minoration" rows="15" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px; line-height: 1.5;"></textarea>
</div>
