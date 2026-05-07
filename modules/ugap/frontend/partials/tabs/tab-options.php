<div id="tab-options" class="tab-panel">
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
            <label style="display: block; margin-bottom: 5px; color: #666;">Filtrer par sous-famille:</label>
            <select id="filter-option-subfamily" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 260px;">
                <option value="">Toutes les sous-familles</option>
            </select>
        </div>
        <div style="display:flex; align-items:flex-end; gap:8px;">
            <button type="button" class="btn btn-outline" id="btn-filter-unassigned-options">Options non assignées</button>
            <button type="button" class="btn btn-outline" id="btn-filter-auto-assigned-options">Assignées automatiquement</button>
            <span id="options-unassigned-warning" style="display:none; align-items:center; gap:4px; padding:4px 8px; border:1px solid #facc15; background:#fffbeb; color:#92400e; border-radius:999px; font-size:12px; font-weight:600;">
                ⚠
                <span id="options-unassigned-warning-count">0</span>
            </span>
            <div style="display:flex; align-items:flex-end; margin-left:auto;">
                <button type="button" class="btn btn-danger" id="btn-options-reset-purge-temp" title="Temporaire : supprime tout le catalogue UGAP publié (ugap_data) pour cette entreprise. À retirer après usage.">Reset</button>
            </div>
        </div>
    </div>
    <table id="categories-table">
        <thead>
            <tr>
                <th>Option</th>
                <th>Famille</th>
                <th>Sous famille</th>
                <th>Prix Client</th>
                <th>Prix UGAP</th>
                <th>Modèles compatibles</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
</div>
