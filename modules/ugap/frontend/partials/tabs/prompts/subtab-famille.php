<div id="prompt-subtab-famille" class="subtab-panel" style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div>
            <h3 style="margin: 0;">Prompt : Regroupement familles (options + minorations)</h3>
            <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">
                Utilisé par l’onglet <strong>Extraction → Famille</strong> (« Lancer le regroupement IA »). Le <strong>contexte</strong> est placé avant le prompt. Seul le <strong>tableau d’origine</strong> reste injecté automatiquement (non modifiable). Les consignes de format restent éditables, avec uniquement un squelette JSON fixe.
            </p>
        </div>
        <button id="btn-save-famille-prompt" class="btn btn-success">💾 Enregistrer</button>
    </div>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:10px; margin-bottom: 10px;">
        <div>
            <label for="prompt-server-famille" style="display:block; margin-bottom:6px; font-weight:600; color:#444;">Serveur IA</label>
            <select id="prompt-server-famille" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;"></select>
        </div>
        <div>
            <label for="prompt-model-famille" style="display:block; margin-bottom:6px; font-weight:600; color:#444;">Modèle (LLM)</label>
            <select id="prompt-model-famille" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;"></select>
        </div>
    </div>
    <label for="prompt-famille-context" style="display: block; margin-bottom: 6px; font-weight: 600; color: #444;">Contexte</label>
    <textarea id="prompt-famille-context" rows="6" placeholder="Rôle métier, cadre du catalogue…" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px; line-height: 1.5; margin-bottom: 14px;"></textarea>
    <label for="prompt-famille-before" style="display: block; margin-bottom: 6px; font-weight: 600; color: #444;">Prompt — avant la liste des lignes (tâche, règles…)</label>
    <textarea id="prompt-famille-before" rows="10" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px; line-height: 1.5; margin-bottom: 10px;"></textarea>
    <div id="prompt-famille-injection-slot" style="margin-bottom: 10px; border: 2px dashed #0d6efd; border-radius: 6px; background: #f0f7ff; padding: 12px 14px;" aria-readonly="true">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            <strong style="color: #084298; font-size: 13px;">Données — liste injectée automatiquement</strong>
            <span style="font-size: 11px; color: #666;">Emplacement fixe · non modifiable · ne peut pas être effacé</span>
        </div>
        <pre id="prompt-famille-injection-pre" style="margin: 0; padding: 10px; background: #fff; border: 1px solid #b6d4fe; border-radius: 4px; font-family: monospace; font-size: 12px; line-height: 1.45; color: #084298; user-select: text; cursor: default;"></pre>
    </div>
    <div id="prompt-famille-format-slot" style="margin-bottom: 10px; border: 2px dashed #198754; border-radius: 6px; background: #f1fbf4; padding: 12px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            <strong style="color: #0f5132; font-size: 13px;">Consignes de format (éditable) + squelette JSON fixe</strong>
            <span style="font-size: 11px; color: #666;">Éditable sauf le bloc JSON final</span>
        </div>
        <textarea id="prompt-famille-format-editable" rows="8" style="width: 100%; padding: 10px; border: 1px solid #badbcc; border-radius: 4px; font-family: monospace; font-size: 12px; line-height: 1.45; color: #0f5132; background: #fff; margin-bottom: 8px;"></textarea>
        <pre id="prompt-famille-format-pre" style="margin: 0; padding: 10px; background: #fff; border: 1px solid #badbcc; border-radius: 4px; font-family: monospace; font-size: 12px; line-height: 1.45; color: #0f5132; user-select: text; cursor: default;"></pre>
    </div>
    <label for="prompt-famille-after" style="display: block; margin-bottom: 6px; font-weight: 600; color: #444;">Prompt — après le format fixe (règles complémentaires, exclusions métier…)</label>
    <textarea id="prompt-famille-after" rows="12" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px; line-height: 1.5;"></textarea>
</div>
