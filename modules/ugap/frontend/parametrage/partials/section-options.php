<?php ?>
<section
    class="ugap-param-section-panel"
    id="ugap-section-options"
    data-section-panel="options"
    hidden
>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
            <h2 style="margin:0 0 6px;">Options</h2>
            <p class="ugap-param-lead" style="margin:0;">
                Liste des options catalogue. Le libellé Excel source est conservé pour toutes les options afin de garder la référence du tableau Excel même si le nom affiché est ensuite modifié.
            </p>
        </div>
        <button type="button" id="ugap-options-refresh" class="btn btn-outline">Rafraîchir</button>
    </div>

    <div class="card" style="margin-top:12px;padding:12px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
            <label style="display:flex;flex-direction:column;gap:4px;min-width:280px;flex:1;">
                <span style="font-size:12px;color:#64748b;">Recherche</span>
                <input
                    id="ugap-options-filter-search"
                    type="search"
                    placeholder="Rechercher une option, famille ou groupe…"
                    style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;"
                >
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;min-width:220px;">
                <span style="font-size:12px;color:#64748b;">Filtre famille</span>
                <select id="ugap-options-filter-family" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="">Toutes les familles</option>
                </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;min-width:220px;">
                <span style="font-size:12px;color:#64748b;">Filtre modèle / poste</span>
                <select id="ugap-options-filter-model" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="">Tous les modèles</option>
                </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;min-width:200px;">
                <span style="font-size:12px;color:#64748b;">Filtre statut</span>
                <select id="ugap-options-filter-status" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="all">Tous</option>
                    <option value="unassigned">Non assignées (famille)</option>
                    <option value="catalogue">Options catalogue</option>
                    <option value="mino">Minorations (MINO)</option>
                    <option value="majo">Majorations (MAJO)</option>
                    <option value="base_only">Options de base (IBP)</option>
                </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;min-width:180px;">
                <span style="font-size:12px;color:#64748b;">Filtre tag</span>
                <select id="ugap-options-filter-tag" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="all">Tous les tags</option>
                    <option value="catalogue">Catalogue</option>
                    <option value="mino">MINO</option>
                    <option value="majo">MAJO</option>
                    <option value="base">Base</option>
                    <option value="pr">PR</option>
                </select>
            </label>
        </div>

        <div style="height:1px;background:#e5e7eb;margin:12px 0;"></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
            <label style="display:flex;flex-direction:column;gap:4px;min-width:220px;">
                <span style="font-size:12px;color:#64748b;">Affecter famille</span>
                <select id="ugap-options-assign-family" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="">Choisir une famille…</option>
                </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;min-width:260px;">
                <span style="font-size:12px;color:#64748b;">Affecter groupe</span>
                <select id="ugap-options-assign-group" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="">Sans groupe</option>
                </select>
            </label>
            <button type="button" id="ugap-options-apply-manual" class="btn btn-primary">Affecter la sélection</button>
            <button type="button" id="ugap-options-delete-selected" class="btn btn-outline" style="border-color:#dc3545;color:#b91c1c;" title="Retire les options du catalogue (familles et picks inclus)">Supprimer la sélection</button>
            <button type="button" id="ugap-options-reassign-groups" class="btn btn-outline" hidden>Réassigner groupes</button>
            <button type="button" id="ugap-options-select-visible" class="btn btn-outline">Sélectionner tout</button>
            <button type="button" id="ugap-options-auto-assign" class="btn btn-outline">Auto-assigner par mots-clés</button>
        </div>
        <p id="ugap-options-action-status" class="ugap-options-action-status" hidden aria-live="polite"></p>
    </div>

    <div id="ugap-options-table-wrap" style="margin-top:14px;">
        <p class="ugap-param-placeholder">Chargement des options…</p>
    </div>
</section>
