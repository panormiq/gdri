<div id="tab-activity" class="tab-panel">
    <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;">
        <div>
            <label style="display: block; margin-bottom: 5px; color: #666;">Type d'événement:</label>
            <select id="filter-log-event" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 220px;">
                <option value="">Tous</option>
                <option value="login">Connexion</option>
                <option value="page_view">Vue page</option>
                <option value="tab_view">Vue onglet</option>
            </select>
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; color: #666;">Email utilisateur:</label>
            <input id="filter-log-email" type="text" placeholder="ex: admin@gdri.fr" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 260px;">
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; color: #666;">Du:</label>
            <input id="filter-log-from" type="datetime-local" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; color: #666;">Au:</label>
            <input id="filter-log-to" type="datetime-local" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <button id="btn-refresh-logs" class="btn btn-primary">Actualiser</button>
        <span id="activity-logs-status" style="color: #666;"></span>
    </div>
    <table id="activity-logs-table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Événement</th>
                <th>Détails</th>
                <th>IP</th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
</div>
