    <div class="ugap-container">
        <div class="card" id="ugap-configurator-hero">
            <h1>Configurateur UGAP</h1>
            <p style="color: #666; margin: 0;">Créez votre devis personnalisé</p>
        </div>

        <div id="ugap-configurator-app">
            <div id="loader" class="loader"></div>
            
            <div id="content" class="hidden">
                <div class="card" id="ugap-configurator-entry">
                    <h2>Que souhaitez-vous faire ?</h2>
                    <p style="color:#666; margin-top: 0;">Choisissez de créer un nouveau devis ou de reprendre un devis sauvegardé.</p>
                    <div class="ugap-entry-actions">
                        <button class="btn btn-primary" type="button" onclick="startNewDevis()">Créer un nouveau devis</button>
                    </div>
                    <div class="ugap-entry-open">
                        <h3>Ouvrir un devis sauvegardé</h3>
                        <p class="ugap-entry-open-hint">Le <strong>nom court</strong> et l’option <strong>Lignes incluses</strong> se règlent sur chaque carte dans <strong>Paramétrage → Modèles de devis</strong> (cochez aussi « Utiliser en rapide » pour le bouton imprimante).</p>
                        <div class="ugap-entry-filters">
                            <input type="text" id="ugap-saved-devis-filter-name" placeholder="Filtrer par nom" oninput="onSavedDevisFilterChange()">
                            <select id="ugap-saved-devis-filter-date-order" onchange="onSavedDevisFilterChange()">
                                <option value="desc">Plus récent</option>
                                <option value="asc">Moins récent</option>
                            </select>
                            <button class="btn btn-secondary" type="button" onclick="resetSavedDevisFilters()">Réinitialiser</button>
                        </div>
                        <div class="ugap-entry-open-list" id="ugap-saved-devis-list">
                            <div class="ugap-entry-open-empty">Aucun devis sauvegardé</div>
                        </div>
                        <div class="ugap-entry-open-row">
                            <button class="btn btn-secondary" type="button" id="ugap-saved-devis-open-btn" onclick="openSavedDevis()">Ouvrir</button>
                        </div>
                    </div>
                </div>

                <!-- Step Indicator -->
                <div class="step-indicator">
                    <div class="step active" data-step="1">
                        <div class="step-number">1</div>
                        <span>Info client</span>
                        <span class="ugap-step-warning" id="ugap-step-client-warning" hidden aria-live="polite">Incomplet</span>
                    </div>
                    <div class="step" data-step="2">
                        <div class="step-number">2</div>
                        <span>Modèle</span>
                    </div>
                    <div class="step" data-step="3">
                        <div class="step-number">3</div>
                        <span>Configuration</span>
                    </div>
                    <div class="step" data-step="4">
                        <div class="step-number">4</div>
                        <span>Options</span>
                    </div>
                </div>

                <!-- Step 1: Client info -->
                <div class="card step-content active" id="step-client">
                    <h2>1. Informations client</h2>
                    <p style="color:#666;margin-top:0;">Sélectionnez un client enregistré ou créez-en un nouveau.</p>

                    <div class="ugap-devis-form-grid" style="margin-top:12px;">
                        <label class="ugap-devis-span2">Commercial
                            <select id="ugap-devis-commercial-select">
                                <option value="">— Sélectionner —</option>
                            </select>
                        </label>
                        <label class="ugap-devis-span2">Client
                            <select id="ugap-devis-client-select">
                                <option value="">— Sélectionner —</option>
                            </select>
                        </label>
                    </div>

                    <div class="ugap-client-actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                        <button type="button" class="btn btn-outline" id="ugap-client-new-btn">Ajouter un nouveau client</button>
                        <button type="button" class="btn btn-outline" id="ugap-client-edit-btn" hidden>Modifier client</button>
                    </div>

                    <div id="ugap-client-form-panel" hidden>
                    <form id="ugap-client-info-form" class="ugap-devis-form-grid" style="margin-top:14px;" autocomplete="off">
                        <fieldset class="ugap-devis-fieldset">
                            <legend>Client</legend>
                            <label class="ugap-devis-span2">Type
                                <select name="type">
                                    <option value="entreprise">Entreprise</option>
                                    <option value="particulier">Particulier</option>
                                </select>
                            </label>
                            <label data-client-field-scope="entreprise" class="ugap-devis-span2">Raison sociale <input type="text" name="raisonSociale"></label>
                            <label data-client-field-scope="particulier">Prénom <input type="text" name="prenom"></label>
                            <label data-client-field-scope="particulier">Nom <input type="text" name="nom"></label>
                            <label data-client-field-scope="entreprise">SIRET <input type="text" name="siret"></label>
                            <label data-client-field-scope="both">N° TVA <input type="text" name="tvaIntracommunautaire"></label>
                        </fieldset>

                        <fieldset class="ugap-devis-fieldset">
                            <legend>Adresse</legend>
                            <label class="ugap-devis-span2" data-client-field-scope="both">Adresse <input type="text" name="adresse"></label>
                            <label class="ugap-devis-span2" data-client-field-scope="both">Complément <input type="text" name="adresseComplement"></label>
                            <label data-client-field-scope="both">Code postal <input type="text" name="codePostal"></label>
                            <label data-client-field-scope="both">Ville <input type="text" name="ville"></label>
                            <label data-client-field-scope="both">Pays <input type="text" name="pays" value="France"></label>
                        </fieldset>

                        <fieldset class="ugap-devis-fieldset">
                            <legend>Contact</legend>
                            <label data-client-field-scope="both">Téléphone <input type="tel" name="telephone"></label>
                            <label data-client-field-scope="both">Email <input type="email" name="email"></label>
                            <label data-client-field-scope="entreprise">Contact (nom) <input type="text" name="contactNom"></label>
                            <label data-client-field-scope="entreprise">Fonction du contact <input type="text" name="contactFonction"></label>
                            <label class="ugap-devis-span2" data-client-field-scope="both">Notes <textarea name="notes" rows="2"></textarea></label>
                        </fieldset>

                        <div class="ugap-devis-form-actions ugap-devis-span2">
                            <button type="button" class="btn btn-primary" id="ugap-client-save-to-directory">Enregistrer dans le répertoire clients</button>
                            <button type="button" class="btn btn-outline" id="ugap-client-form-cancel">Annuler</button>
                        </div>
                    </form>
                    </div>

                    <div class="actions" style="margin-top:16px;">
                        <button class="btn btn-secondary" type="button" onclick="backToDevisEntry()">Retour</button>
                        <button class="btn btn-primary" type="button" onclick="confirmClientStep()">Suivant</button>
                    </div>
                </div>

                <!-- Step 2: Model Selection -->
                <div class="card step-content" id="step-1">
                    <h2>2. Choisissez votre modèle</h2>
                    <div class="models-grid" id="models-container"></div>
                    <div class="actions">
                        <button class="btn btn-secondary" onclick="goToStep(1)">Précédent</button>
                    </div>
                </div>

                <!-- Step 3: Configuration Selection -->
                <div class="card step-content" id="step-2">
                    <h2>3. Choisissez la configuration</h2>
                    <p style="color: #666;">Modèle sélectionné: <strong id="selected-model-name"></strong></p>
                    <div class="configs-grid" id="configs-container"></div>
                    <div class="actions">
                        <button class="btn btn-secondary" onclick="goToStep(1)">Info client</button>
                        <button class="btn btn-secondary" onclick="goToStep(2)">Précédent</button>
                    </div>
                </div>

                <!-- Step 4: Options Selection -->
                <div class="card step-content" id="step-3">
                    <h2>4. Sélectionnez vos options</h2>
                    <div class="ugap-devis-header-row">
                        <div class="ugap-devis-name-field">
                            <label for="ugap-devis-name-input">Nom du devis</label>
                            <input type="text" id="ugap-devis-name-input" placeholder="Ex: Devis vedette 28 — client Dupont" oninput="onDevisNameInput(event)">
                        </div>
                        <div class="ugap-devis-display-toggles" role="group" aria-label="Affichage du devis">
                            <span class="ugap-devis-display-toggles-label">Affichage</span>
                            <button
                                type="button"
                                class="ugap-devis-display-toggle"
                                id="ugap-devis-show-included-lines"
                                data-devis-display-toggle="showIncludedLines"
                                aria-pressed="false"
                                title="Afficher toutes les lignes du parcours, y compris celles marquées « Inclus »"
                                onclick="onDevisDisplayToggleClick(event)"
                            >Lignes incluses</button>
                        </div>
                    </div>
                    <div class="ugap-devis-view-tabs" id="ugap-devis-view-tabs" role="tablist" aria-label="Vues devis">
                        <button type="button" class="ugap-devis-view-tab is-active" data-devis-view="parcours" id="ugap-devis-tab-parcours">Parcours options</button>
                        <button type="button" class="ugap-devis-view-tab" data-devis-view="versions" id="ugap-devis-tab-versions">Versions</button>
                    </div>
                    <div id="ugap-devis-parcours-panel">
                    <p style="color: #666;">Modèle: <strong id="selected-model-name-2"></strong> | Configuration: <strong id="selected-config-name"></strong></p>
                    <p id="ugap-step3-views-hint" style="margin:12px 0 6px;font-size:13px;font-weight:600;color:#334155;">Parcours options</p>
                    <p id="ugap-step3-views-desc" style="margin:0 0 10px;font-size:12px;color:#64748b;line-height:1.45;"></p>
                    <div class="tabs" id="category-tabs" aria-label="Vues métier"></div>
                    
                    <div id="subcategories-container"></div>
                    <div id="options-container"></div>

                    <!-- Section 5% Devis -->
                    <div class="five-percent-section">
                        <h3>Options supplémentaires (5% du devis)</h3>
                        <div class="five-percent-options" id="five-percent-options"></div>
                    </div>
                    </div>
                    <div id="ugap-devis-versions-panel" class="ugap-devis-versions-panel" hidden></div>

                    <!-- Summary -->
                    <div id="ugap-devis-update-status" class="ugap-devis-update-status hidden" role="status" aria-live="polite">
                        <span class="ugap-devis-update-hourglass" aria-hidden="true"></span>
                        <span>Mise à jour du devis en cours…</span>
                    </div>
                    <div class="summary">
                        <h3>Récapitulatif</h3>
                        <div class="summary-item">
                            <span>Modèle:</span>
                            <span id="summary-model">-</span>
                        </div>
                        <div class="summary-item">
                            <span>Configuration:</span>
                            <span id="summary-config">-</span>
                        </div>
                        <div class="summary-item">
                            <span>Options sélectionnées:</span>
                            <span id="summary-options-count">0</span>
                        </div>
                        <div class="summary-item">
                            <span>Sous-total:</span>
                            <span id="summary-subtotal">0,00 €</span>
                        </div>
                        <div class="summary-item" id="summary-5percent-item">
                            <span>Budget 5%:</span>
                            <span id="summary-5percent">0,00 €</span>
                        </div>
                        <div class="summary-total">
                            <span>Total HT:</span>
                            <span id="summary-total">0,00 €</span>
                        </div>
                    </div>

                    <div class="actions">
                        <button class="btn btn-secondary" onclick="goToStep(1)">Info client</button>
                        <button class="btn btn-secondary" onclick="goToStep(3)">Précédent</button>
                        <button class="btn btn-primary" type="button" onclick="saveCurrentDevis()">Sauvegarder</button>
                        <button class="btn btn-success" type="button" id="ugap-generate-devis-btn" onclick="generateDevis()">Générer le devis PDF</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="ugap-devis-open-overlay" class="ugap-devis-open-overlay hidden" aria-hidden="true" role="status">
        <div class="ugap-devis-open-overlay__panel">
            <div class="ugap-devis-open-hourglass" aria-hidden="true"></div>
            <p class="ugap-devis-open-overlay__label">Ouverture du devis…</p>
        </div>
    </div>

    <!-- Modal option 5% par groupe (tableau catégorie) -->
    <div class="modal" id="five-percent-group-modal">
        <div class="modal-content" style="max-width:520px;">
            <div class="modal-header">
                <h2 id="five-percent-group-modal-title">Option 5%</h2>
                <button type="button" class="modal-close" onclick="closeFivePercentGroupModal()">&times;</button>
            </div>
            <div id="five-percent-group-modal-body" style="padding:4px 0 8px;"></div>
        </div>
    </div>

    <!-- Modal pour afficher les options d'une sous-catégorie -->
    <div class="modal" id="subcategory-modal">
        <div class="modal-content modal-picker">
            <div class="modal-header">
                <h2 id="subcategory-modal-title">Options</h2>
                <button class="modal-close" onclick="closeSubCategoryModal()">&times;</button>
            </div>
            <div id="subcategory-options-list"></div>
        </div>
    </div>
