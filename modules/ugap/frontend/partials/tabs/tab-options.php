<div id="tab-options" class="tab-panel">
    <div id="options-heur-panel" style="margin-bottom: 14px; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; background: #fafbfc;">
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #444; line-height: 1.5;">
            Chaque option arrive en <strong>famille non assignée</strong>. Utilisez le bouton ci-dessous pour lancer l’heuristique (famille + groupe selon les règles et mots-clés des familles/groupes validés).
            Les modifications manuelles ne sont pas écrasées. Sans correspondance de groupe, le groupe <strong>Option catalogue</strong> de la famille est utilisé.
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: end; margin-bottom: 8px;">
            <div style="min-width: 160px; flex: 1;">
                <label style="display: block; font-size: 12px; color: #555; margin-bottom: 4px;">Groupe (optionnel)</label>
                <input id="opt-heur-group" type="text" placeholder="Ex: Couleur — vide = 1er groupe" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="min-width: 200px; flex: 1;">
                <label style="display: block; font-size: 12px; color: #555; margin-bottom: 4px;">Famille (règle)</label>
                <input id="opt-heur-label" type="text" placeholder="Ex: Couleur du flotteur" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="min-width: 240px; flex: 2;">
                <label style="display: block; font-size: 12px; color: #555; margin-bottom: 4px;">Mots-clés</label>
                <input id="opt-heur-keywords" type="text" placeholder="Ex: coloris, flotteur, rouge" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="min-width: 140px;">
                <label style="display: block; font-size: 12px; color: #555; margin-bottom: 4px;">Scope</label>
                <select id="opt-heur-scope" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="all">Toutes</option>
                    <option value="option">Options</option>
                    <option value="minoration">Minorations</option>
                </select>
            </div>
            <button type="button" class="btn btn-outline" id="btn-add-opt-heur">Enregistrer règle</button>
            <button type="button" class="btn btn-outline" id="btn-cancel-opt-heur-edit" style="display: none;">Annuler</button>
        </div>
        <div id="options-heur-rules-list" style="font-size: 13px; color: #444; margin-bottom: 10px;"></div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
            <button type="button" class="btn btn-success" id="btn-options-rerun-heuristic">Relancer assignation (familles + groupes)</button>
            <span id="options-heur-status" style="font-size: 12px; color: #666;"></span>
        </div>
    </div>
    <div style="margin-bottom: 10px; display: flex; gap: 15px; flex-wrap: wrap;">
        <div>
            <label style="display: block; margin-bottom: 5px; color: #666;">Filtrer par modèle bateau:</label>
            <select id="filter-model" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 300px;">
                <option value="">Tous les modèles</option>
            </select>
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; color: #666;">Recherche par nom:</label>
            <input id="filter-option-name" type="text" placeholder="Ex: console, flotteur..." style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 300px;">
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; color: #666;">Filtrer par famille:</label>
            <select id="filter-option-family" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 260px;">
                <option value="">Toutes les familles</option>
            </select>
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; color: #666;">Filtrer par groupe:</label>
            <select id="filter-option-subfamily" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 260px;">
                <option value="">Tous les groupes</option>
            </select>
        </div>
        <div style="display:flex; align-items:flex-end; gap:8px;">
            <button type="button" class="btn btn-outline" id="btn-filter-base-options">Options de base</button>
            <button type="button" class="btn btn-outline" id="btn-filter-unassigned-options">Options non assignées</button>
            <button type="button" class="btn btn-outline" id="btn-filter-auto-assigned-options">Options assignées</button>
            <button type="button" class="btn btn-outline" id="btn-options-reset-filters" title="Réinitialise modèle, nom, famille, groupe et filtres actifs">Réinitialiser les filtres</button>
            <span id="options-unassigned-warning" style="display:none; align-items:center; gap:4px; padding:4px 8px; border:1px solid #facc15; background:#fffbeb; color:#92400e; border-radius:999px; font-size:12px; font-weight:600;">
                ⚠
                <span id="options-unassigned-warning-count">0</span>
            </span>
        </div>
    </div>
    <div id="options-tab-catalog-status" style="margin-bottom:10px;font-size:13px;color:#444;line-height:1.5;"></div>
    <div id="options-family-editor-panel" style="display:none; margin-bottom:14px; border:1px solid #cfe8ff; border-radius:10px; padding:12px; background:#f8fbff;"></div>
    <div id="ugap-options-table-scroll" class="ugap-options-table-scroll">
    <table id="categories-table">
        <thead>
            <tr>
                <th>Option</th>
                <th>Détails</th>
                <th>Inclus</th>
                <th>Famille</th>
                <th>Groupe</th>
                <th>Prix Client</th>
                <th>Prix UGAP</th>
                <th>Modèles compatibles</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
    </div>
</div>
