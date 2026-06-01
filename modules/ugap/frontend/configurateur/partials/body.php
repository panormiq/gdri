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
                            <button class="btn btn-secondary" type="button" onclick="openSavedDevis()">Ouvrir</button>
                        </div>
                    </div>
                </div>

                <!-- Step Indicator -->
                <div class="step-indicator">
                    <div class="step active" data-step="1">
                        <div class="step-number">1</div>
                        <span>Modèle</span>
                    </div>
                    <div class="step" data-step="2">
                        <div class="step-number">2</div>
                        <span>Configuration</span>
                    </div>
                    <div class="step" data-step="3">
                        <div class="step-number">3</div>
                        <span>Options</span>
                    </div>
                </div>

                <!-- Step 1: Model Selection -->
                <div class="card step-content active" id="step-1">
                    <h2>1. Choisissez votre modèle</h2>
                    <div class="models-grid" id="models-container"></div>
                </div>

                <!-- Step 2: Configuration Selection -->
                <div class="card step-content" id="step-2">
                    <h2>2. Choisissez la configuration</h2>
                    <p style="color: #666;">Modèle sélectionné: <strong id="selected-model-name"></strong></p>
                    <div class="configs-grid" id="configs-container"></div>
                    <div class="actions">
                        <button class="btn btn-secondary" onclick="goToStep(1)">Précédent</button>
                    </div>
                </div>

                <!-- Step 3: Options Selection -->
                <div class="card step-content" id="step-3">
                    <h2>3. Sélectionnez vos options</h2>
                    <div class="ugap-devis-name-row">
                        <label for="ugap-devis-name-input">Nom du devis</label>
                        <input type="text" id="ugap-devis-name-input" placeholder="Ex: Devis vedette 28" oninput="onDevisNameInput(event)">
                    </div>
                    <p style="color: #666;">Modèle: <strong id="selected-model-name-2"></strong> | Configuration: <strong id="selected-config-name"></strong></p>
                    <p id="ugap-step3-views-hint" style="margin:12px 0 6px;font-size:13px;font-weight:600;color:#334155;">Parcours options</p>
                    <p id="ugap-step3-views-desc" style="margin:0 0 10px;font-size:12px;color:#64748b;line-height:1.45;"></p>
                    <div class="tabs" id="category-tabs" aria-label="Vues métier"></div>
                    
                    <div id="subcategories-container"></div>
                    <div id="options-container"></div>

                    <!-- Section 5% Devis -->
                    <div class="five-percent-section">
                        <h3>Options supplémentaires (5% du devis)</h3>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="enable-5percent" onchange="toggle5Percent()">
                            <span>Activer les options supplémentaires à hauteur de 5% du devis</span>
                        </label>
                        <div class="five-percent-options" id="five-percent-options"></div>
                    </div>

                    <!-- Summary -->
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
                        <div class="summary-item" id="summary-5percent-item" style="display: none;">
                            <span>Budget 5%:</span>
                            <span id="summary-5percent">0,00 €</span>
                        </div>
                        <div class="summary-total">
                            <span>Total HT:</span>
                            <span id="summary-total">0,00 €</span>
                        </div>
                    </div>

                    <div class="actions">
                        <button class="btn btn-secondary" onclick="goToStep(2)">Précédent</button>
                        <button class="btn btn-primary" type="button" onclick="saveCurrentDevis()">Sauvegarder</button>
                        <button class="btn btn-success" onclick="generateDevis()">Générer le devis</button>
                    </div>
                </div>
            </div>
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
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="subcategory-modal-title">Options</h2>
                <button class="modal-close" onclick="closeSubCategoryModal()">&times;</button>
            </div>
            <div id="subcategory-options-list"></div>
        </div>
    </div>
