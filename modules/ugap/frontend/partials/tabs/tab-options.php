<div id="tab-options" class="tab-panel">
    <div style="margin-bottom: 15px; display: flex; gap: 15px; flex-wrap: wrap;">
        <div>
            <label style="display: block; margin-bottom: 5px; color: #666;">Filtrer par catégorie:</label>
            <select id="filter-category" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 300px;">
                <option value="">Toutes les catégories</option>
            </select>
        </div>
        <div id="filter-subcategory-container" style="display: none;">
            <label style="display: block; margin-bottom: 5px; color: #666;">Filtrer par sous-catégorie:</label>
            <select id="filter-subcategory" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 300px; background: white; cursor: pointer;">
                <option value="">Choisir une sous-catégorie</option>
            </select>
        </div>
    </div>
    <table id="categories-table">
        <thead>
            <tr>
                <th>Catégorie</th>
                <th>Sous-catégorie</th>
                <th>Option</th>
                <th>Prix Client</th>
                <th>Prix UGAP</th>
                <th>Modèles compatibles</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
</div>
