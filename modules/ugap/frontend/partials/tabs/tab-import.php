<div id="tab-import" class="tab-panel<?= ($__ugapEmbedView ?? 'parametrage') !== 'prompts' ? ' active' : '' ?>">

    <div class="ugap-import-tab">

        <div id="import-list-section">

            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
                <div>
                    <h2 style="margin: 0 0 6px; font-size: 18px;">Imports Excel</h2>
                    <p style="color: #666; margin: 0; font-size: 13px;">Liste des imports en zone tampon. Ouvrez un import pour poursuivre le workflow.</p>
                </div>
                <button type="button" id="btn-import-new" class="btn btn-success">Nouvel import</button>
            </div>

            <div id="import-list-status" style="color:#666; font-size:13px; margin-bottom:10px;"></div>

            <div style="border:1px solid #e3e6ea; border-radius:8px; overflow:hidden; background:#fff;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#f9fafb; text-align:left;">
                            <th style="padding:10px 12px; border-bottom:1px solid #eef2f7;">Fichier Excel</th>
                            <th style="padding:10px 12px; border-bottom:1px solid #eef2f7; width:120px;">Statut</th>
                            <th style="padding:10px 12px; border-bottom:1px solid #eef2f7; width:150px;">Importé le</th>
                            <th style="padding:10px 12px; border-bottom:1px solid #eef2f7; width:130px;">Progression</th>
                            <th style="padding:10px 12px; border-bottom:1px solid #eef2f7; width:140px; text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="import-list-tbody">
                        <tr>
                            <td colspan="5" style="padding:16px 12px; color:#6b7280;">Chargement des imports…</td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </div>

        <div id="import-editor-section" style="display:none;">

            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <button type="button" id="btn-import-back-list" class="btn btn-outline">← Retour à la liste</button>
                    <h2 id="import-editor-title" style="margin:0; font-size:18px;">Import Excel</h2>
                </div>
            </div>

            <p style="color: #666; margin: 0 0 12px; font-size: 13px;">Validez le workflow étape par étape pour cet import.</p>

            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px;">

                <button id="btn-import" class="btn btn-success">Importer depuis Excel</button>

                <button id="btn-import-audit" class="btn btn-outline">Audit écarts Excel</button>

                <span id="import-status" style="color: #666;"></span>

            </div>

            <div id="import-staging-indicator" style="margin-bottom:14px; padding:10px 12px; border:1px solid #e3e6ea; border-radius:8px; background:#f8fafc; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">

                <div>

                    <div style="font-weight:600; color:#1f2937;">Workflow import</div>

                    <div id="import-staging-meta" style="font-size:12px; color:#6b7280; margin-top:2px;">Aucun import en cours.</div>

                    <div id="import-staging-progress" style="font-size:12px; color:#374151; margin-top:4px;">0/0 modeles valides - 0 modeles de base configures - 0/0 options configurees</div>

                </div>

                <div style="display:flex; align-items:center; gap:8px;">

                    <span id="import-staging-badge" style="font-size:12px; font-weight:600; color:#374151; background:#e5e7eb; padding:4px 8px; border-radius:999px;">Aucun</span>

                    <button id="btn-resume-import" class="btn btn-outline" style="display:none;">Reprendre l'import</button>

                </div>

            </div>

            <div id="import-workflow-section">

                <div id="import-workflow-sticky" class="ugap-import-workflow-sticky">

                    <div class="ugap-import-workflow-steps" role="tablist" aria-label="Étapes import Excel">

                        <button type="button" id="btn-import-step-models" class="btn btn-outline" data-import-step="models">1. Modèles</button>

                        <button type="button" id="btn-import-step-import-base-options" class="btn btn-outline" data-import-step="import-base-options">2. Options de base</button>

                        <button type="button" id="btn-import-step-minorations" class="btn btn-outline" data-import-step="minorations">3. Minorations</button>

                        <button type="button" id="btn-import-step-majorations" class="btn btn-outline" data-import-step="majorations">4. Majorations</button>

                        <button type="button" id="btn-import-step-families-tri" class="btn btn-outline" data-import-step="families-tri">5. Options</button>

                        <button type="button" id="btn-import-step-families-unmatched" class="btn btn-outline" data-import-step="families-unmatched">6. PR</button>

                        <button type="button" id="btn-import-step-validate" class="btn btn-outline" data-import-step="validate">7. Valider</button>

                    </div>

                    <div id="ugap-import-workflow-actions" class="ugap-import-workflow-actions" hidden aria-label="Enregistrer et étape suivante"></div>

                </div>

                <div id="import-workflow-content-models" class="ugap-import-workflow-pane"></div>

                <div id="import-workflow-content-families" class="ugap-import-workflow-pane" style="display:none;"></div>

            </div>

        </div>

    </div>

</div>
