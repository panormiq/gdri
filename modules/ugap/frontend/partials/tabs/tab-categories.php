<div id="tab-categories" class="tab-panel">
    <div style="margin-bottom: 15px; color:#666; font-size:13px;">
        Gestion des vues métier (indépendante des mots-clés de familles).
    </div>
    <div style="margin-bottom:12px; border:1px solid #e9ecef; border-radius:8px; padding:10px; background:#fafbfc;">
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:end; margin-bottom:8px;">
            <div style="min-width:220px; flex:1;">
                <label style="display:block; font-size:12px; color:#555; margin-bottom:4px;">Nom de vue métier</label>
                <input id="view-heur-label" type="text" placeholder="Ex: Design" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            </div>
            <div style="min-width:260px; flex:2;">
                <label style="display:block; font-size:12px; color:#555; margin-bottom:4px;">Mots-clés (optionnel)</label>
                <input id="view-heur-keywords" type="text" placeholder="Ex: coloris, finition, teinte" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            </div>
            <div style="min-width:160px;">
                <label style="display:block; font-size:12px; color:#555; margin-bottom:4px;">Scope</label>
                <select id="view-heur-scope" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                    <option value="all">Toutes les lignes</option>
                    <option value="option">Options uniquement</option>
                    <option value="minoration">Minorations uniquement</option>
                </select>
            </div>
            <button type="button" class="btn btn-outline" id="btn-add-view-heur">Créer / Enregistrer</button>
            <button type="button" class="btn btn-outline" id="btn-cancel-view-heur-edit" style="display:none;">Annuler édition</button>
        </div>
        <div id="view-heur-list" style="font-size:13px; color:#444;"></div>
    </div>
</div>
