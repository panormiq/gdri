<?php
/**
 * Configuration de l'Agent IA pour l'analyse d'intention
 * Fichier : pages/modules/analyse-intention-config.php
 * 
 * Permet de configurer le prompt, les intentions, et les paramètres SMTP
 */

require_once '../../config/config.php';
require_once '../../config/database.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

// Seuls ADMIN_GDRI et ADMIN_ENTITY peuvent accéder
if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Configuration Agent IA';
require_once '../../includes/header.php';

// Token JWT pour les appels API
$jwt_token = getJWTToken();
$api_base_url = getApiBaseUrl();
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Configuration de l'Agent IA</h1>
            <p class="hero-description">
                Configurez le prompt, les intentions et les paramètres SMTP pour l'analyse automatique des messages
            </p>
        </div>
    </div>
</section>

<!-- Section Configuration -->
<section class="section">
    <div class="container">
        <div class="card">
            <div class="card-header">
                <h2>Paramètres de l'Agent IA</h2>
            </div>
            <div class="card-body">
                <form id="agentConfigForm">
                    <!-- Prompt de base -->
                    <div class="form-group">
                        <label for="basePrompt">Prompt de base *</label>
                        <textarea 
                            id="basePrompt" 
                            name="basePrompt" 
                            class="form-control" 
                            rows="8" 
                            placeholder="Analysez le message suivant et déterminez son intention parmi : {liste des intention}

Pour chaque intention détectée, indiquez :
- La catégorie d'intention
- Le niveau de certitude (0-100%)
- Si une action urgente est requise"
                            required
                        ></textarea>
                        <small class="form-text text-muted">
                            Utilisez <code>{liste des intention}</code> dans votre prompt pour insérer automatiquement la liste des intentions configurées ci-dessous
                        </small>
                    </div>

                    <!-- Adresse email par défaut -->
                    <div class="form-group">
                        <label for="defaultEmail">
                            Adresse email par défaut *
                            <span id="defaultEmailWarning" class="email-warning" style="display: none; margin-left: 8px; color: #ff6b6b; font-size: 0.9em;">
                                ⚠️ Aucun email configuré
                            </span>
                        </label>
                        <input 
                            type="email" 
                            id="defaultEmail" 
                            name="defaultEmail" 
                            class="form-control" 
                            placeholder="exemple@email.com"
                            required
                        />
                        <small class="form-text text-muted">
                            Adresse email utilisée par défaut pour toutes les intentions non configurées.
                        </small>
                    </div>

                    <!-- Liste des intentions -->
                    <div class="form-group">
                        <label>Liste des intentions</label>
                        <div id="customIntentionsContainer" class="intentions-badges-container">
                            <!-- Les intentions ajoutées seront affichées ici sous forme de badges -->
                            <div class="empty-state" id="intentionsEmptyState">
                                <p>Aucune intention configurée. Cliquez sur "Ajouter une intention" pour commencer.</p>
                            </div>
                        </div>
                        <button type="button" class="btn btn-outline btn-sm" id="addIntentionBtn">
                            + Ajouter une intention
                        </button>
                        <small class="form-text text-muted">
                            Ajoutez les intentions que l'agent doit détecter. Elles seront automatiquement insérées dans le prompt via {liste des intention}
                        </small>
                    </div>

                    <!-- Profils SMTP -->
                    <div class="form-group">
                        <h3>Profils SMTP</h3>
                        <div id="smtpProfilesContainer" class="smtp-profiles-badges-container">
                            <!-- Les profils SMTP ajoutés seront affichés ici sous forme de badges -->
                            <div class="empty-state" id="smtpEmptyState">
                                <p>Aucun profil SMTP configuré. Cliquez sur "Créer un SMTP" pour commencer.</p>
                            </div>
                        </div>
                        <button type="button" class="btn btn-outline btn-sm" id="addSmtpProfileBtn">
                            + Créer un SMTP
                        </button>
                        <small class="form-text text-muted">
                            Ajoutez des profils SMTP. Le profil du module Mail sera chargé par défaut s'il existe.
                        </small>
                    </div>

                    <!-- Boutons d'action -->
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">
                            💾 Sauvegarder la configuration
                        </button>
                        <button type="button" class="btn btn-outline" id="testConnectionBtn">
                            🧪 Tester la connexion BackendIA
                        </button>
                        <button type="button" class="btn btn-outline" id="loadConfigBtn">
                            🔄 Charger la configuration
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</section>

<!-- Modal pour ajouter/modifier une intention -->
<div class="modal-overlay" id="intentionModal" style="display: none;">
    <div class="modal-content">
        <button class="modal-close" id="closeIntentionModal">×</button>
        <div class="modal-header">
            <h2 id="intentionModalTitle">Ajouter une intention</h2>
        </div>
        <div class="modal-body">
            <form id="intentionForm">
                <input type="hidden" id="intentionEditIndex" value="">
                
                <div class="form-group">
                    <label for="intentionName">Nom de l'intention *</label>
                    <div class="autocomplete-wrapper">
                        <input 
                            type="text" 
                            id="intentionName" 
                            class="form-control" 
                            placeholder="Sélectionnez ou saisissez un nom d'intention..."
                            autocomplete="off"
                            required
                        />
                        <div id="intentionAutocomplete" class="autocomplete-dropdown" style="display: none;"></div>
                    </div>
                    <small class="form-text text-muted">Sélectionnez une intention prédéfinie dans la liste ou saisissez un nom personnalisé</small>
                </div>
                
                <div class="form-group">
                    <label for="intentionEmail">Email pour cette intention</label>
                    <input 
                        type="email" 
                        id="intentionEmail" 
                        class="form-control" 
                        placeholder="sav@example.com (optionnel, utilisera l'email par défaut si vide)"
                    />
                    <small class="form-text text-muted">Email qui recevra les notifications pour cette intention. Si vide, l'email par défaut sera utilisé.</small>
                </div>
                
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; justify-content: flex-start;">
                        <input type="checkbox" id="intentionUrgent" style="margin: 0; cursor: pointer; flex-shrink: 0; width: auto;" />
                        <span style="white-space: nowrap;">Notification urgente (envoi immédiat)</span>
                    </label>
                    <small class="form-text text-muted">Si coché, un email sera envoyé immédiatement lorsqu'une intention urgente est détectée</small>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="cancelIntentionBtn">Annuler</button>
            <button type="button" class="btn btn-primary" id="saveIntentionBtn">Enregistrer</button>
        </div>
    </div>
</div>

<!-- Modal pour ajouter/modifier un profil SMTP -->
<div class="modal-overlay" id="smtpModal" style="display: none;">
    <div class="modal-content modal-large">
        <button class="modal-close" id="closeSmtpModal">×</button>
        <div class="modal-header">
            <h2 id="smtpModalTitle">Ajouter un profil SMTP</h2>
        </div>
        <div class="modal-body">
            <form id="smtpForm">
                <input type="hidden" id="smtpEditIndex" value="">
                
                <div class="form-group">
                    <label for="smtpProfileName">Nom du profil *</label>
                    <input 
                        type="text" 
                        id="smtpProfileName" 
                        class="form-control" 
                        placeholder="Nom du profil (ex: Gmail, Outlook...)" 
                        required
                    />
                </div>
                
                <div class="form-row">
                    <div class="form-group col-md-6">
                        <label for="smtpHost">Serveur SMTP *</label>
                        <input 
                            type="text" 
                            id="smtpHost" 
                            class="form-control" 
                            placeholder="smtp.gmail.com" 
                            required
                        />
                    </div>
                    <div class="form-group col-md-3">
                        <label for="smtpPort">Port *</label>
                        <input 
                            type="number" 
                            id="smtpPort" 
                            class="form-control" 
                            placeholder="587" 
                            value="587"
                            required
                        />
                    </div>
                    <div class="form-group col-md-3">
                        <label for="smtpSecure">Sécurité</label>
                        <select id="smtpSecure" class="form-control">
                            <option value="false">Aucune</option>
                            <option value="true" selected>TLS/SSL</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group col-md-6">
                        <label for="smtpUser">Utilisateur SMTP *</label>
                        <input 
                            type="text" 
                            id="smtpUser" 
                            class="form-control" 
                            placeholder="user@example.com" 
                            required
                        />
                    </div>
                    <div class="form-group col-md-6">
                        <label for="smtpPass">Mot de passe SMTP *</label>
                        <input 
                            type="password" 
                            id="smtpPass" 
                            class="form-control" 
                            placeholder="••••••••" 
                            required
                        />
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group col-md-6">
                        <label for="smtpFromName">Nom expéditeur *</label>
                        <input 
                            type="text" 
                            id="smtpFromName" 
                            class="form-control" 
                            placeholder="GDR-Innovation" 
                            required
                        />
                    </div>
                    <div class="form-group col-md-6">
                        <label for="smtpFromEmail">Email expéditeur *</label>
                        <input 
                            type="email" 
                            id="smtpFromEmail" 
                            class="form-control" 
                            placeholder="noreply@example.com" 
                            required
                        />
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="cancelSmtpBtn">Annuler</button>
            <button type="button" class="btn btn-primary" id="saveSmtpBtn">Enregistrer</button>
        </div>
    </div>
</div>

<script>
const API_BASE_URL = '<?= $api_base_url ?>';
const JWT_TOKEN = '<?= $jwt_token ?>';

let intentions = []; // Tableau pour stocker les intentions
let smtpProfiles = []; // Tableau pour stocker les profils SMTP
let editingIntentionIndex = null;
let editingSmtpIndex = null;

// Ouvrir le modal pour ajouter une intention
document.getElementById('addIntentionBtn').addEventListener('click', () => {
    openIntentionModal();
});

// Fermer le modal
document.getElementById('closeIntentionModal').addEventListener('click', closeIntentionModal);
document.getElementById('cancelIntentionBtn').addEventListener('click', closeIntentionModal);

// Obtenir toutes les options d'intentions disponibles
function getIntentionOptions() {
    const predefined = ['commercial', 'sav', 'technique', 'critique', 'positif', 'spam', 'generic'];
    const custom = intentions.map(i => i.name).filter(name => !predefined.includes(name));
    return [...predefined, ...custom];
}

// Afficher l'auto-complétion
function showAutocomplete(input, value, showAll = false) {
    const dropdown = document.getElementById('intentionAutocomplete');
    const options = getIntentionOptions();
    
    if (options.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    // Filtrer les options qui correspondent, ou afficher toutes si showAll
    let filtered;
    if (showAll || !value) {
        filtered = options;
    } else {
        filtered = options.filter(opt => 
            opt.toLowerCase().includes(value.toLowerCase())
        );
    }
    
    if (filtered.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    // Créer les éléments de la liste
    dropdown.innerHTML = filtered.map(opt => 
        `<div class="autocomplete-item" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</div>`
    ).join('');
    
    // Positionner le dropdown
    const rect = input.getBoundingClientRect();
    const wrapper = input.closest('.autocomplete-wrapper');
    if (wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        dropdown.style.top = (rect.bottom - wrapperRect.top + 2) + 'px';
        dropdown.style.left = (rect.left - wrapperRect.left) + 'px';
        dropdown.style.width = rect.width + 'px';
    } else {
        dropdown.style.top = (rect.bottom + window.scrollY + 2) + 'px';
        dropdown.style.left = (rect.left + window.scrollX) + 'px';
        dropdown.style.width = rect.width + 'px';
    }
    dropdown.style.display = 'block';
    
    // Gérer les clics sur les items
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            input.value = item.dataset.value;
            dropdown.style.display = 'none';
            input.focus();
        });
        
        item.addEventListener('mouseenter', () => {
            dropdown.querySelectorAll('.autocomplete-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// Gérer l'auto-complétion pour le champ intention
function initAutocomplete() {
    const intentionNameInput = document.getElementById('intentionName');
    if (!intentionNameInput) return;
    
    // Supprimer les anciens event listeners en clonant l'élément
    const wrapper = intentionNameInput.closest('.autocomplete-wrapper');
    if (!wrapper) return;
    
    // Vérifier si les listeners sont déjà attachés
    if (intentionNameInput.dataset.autocompleteInit === 'true') {
        return; // Déjà initialisé
    }
    
    intentionNameInput.dataset.autocompleteInit = 'true';
    
    intentionNameInput.addEventListener('focus', function() {
        showAutocomplete(this, this.value, true);
    });
    
    intentionNameInput.addEventListener('input', function(e) {
        showAutocomplete(this, e.target.value, false);
    });
    
    intentionNameInput.addEventListener('blur', function(e) {
        // Délai pour permettre le clic sur un item
        setTimeout(() => {
            const dropdown = document.getElementById('intentionAutocomplete');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        }, 200);
    });
    
    // Navigation au clavier
    intentionNameInput.addEventListener('keydown', function(e) {
        const dropdown = document.getElementById('intentionAutocomplete');
        if (!dropdown || dropdown.style.display === 'none') return;
        
        const items = dropdown.querySelectorAll('.autocomplete-item');
        const active = dropdown.querySelector('.autocomplete-item.active');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (active) {
                active.classList.remove('active');
                const next = active.nextElementSibling || items[0];
                if (next) next.classList.add('active');
            } else if (items[0]) {
                items[0].classList.add('active');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (active) {
                active.classList.remove('active');
                const prev = active.previousElementSibling || items[items.length - 1];
                if (prev) prev.classList.add('active');
            } else if (items[items.length - 1]) {
                items[items.length - 1].classList.add('active');
            }
        } else if (e.key === 'Enter') {
            if (active) {
                e.preventDefault();
                intentionNameInput.value = active.dataset.value;
                dropdown.style.display = 'none';
            }
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });
}

// Sauvegarder l'intention
document.getElementById('saveIntentionBtn').addEventListener('click', () => {
    const name = document.getElementById('intentionName').value.trim();
    let email = document.getElementById('intentionEmail').value.trim();
    const urgent = document.getElementById('intentionUrgent').checked;
    
    if (!name) {
        alert('Veuillez saisir un nom d\'intention');
        return;
    }
    
    // Si pas d'email, utiliser l'email par défaut
    if (!email) {
        const defaultEmail = document.getElementById('defaultEmail').value.trim();
        if (!defaultEmail) {
            alert('Veuillez saisir un email pour cette intention ou configurer un email par défaut');
            return;
        }
        email = defaultEmail;
    }
    
    const intention = {
        name,
        email,
        urgent
    };
    
    if (editingIntentionIndex !== null) {
        // Modifier une intention existante
        intentions[editingIntentionIndex] = intention;
    } else {
        // Ajouter une nouvelle intention
        intentions.push(intention);
    }
    
    renderIntentions();
    closeIntentionModal();
});

// Fonctions pour gérer le modal
function openIntentionModal(intentionIndex = null) {
    editingIntentionIndex = intentionIndex;
    const modal = document.getElementById('intentionModal');
    const form = document.getElementById('intentionForm');
    const title = document.getElementById('intentionModalTitle');
    
    if (intentionIndex !== null) {
        // Mode édition
        title.textContent = 'Modifier une intention';
        const intention = intentions[intentionIndex];
        document.getElementById('intentionName').value = intention.name;
        document.getElementById('intentionEmail').value = intention.email;
        document.getElementById('intentionUrgent').checked = intention.urgent;
        document.getElementById('intentionEditIndex').value = intentionIndex;
    } else {
        // Mode création
        title.textContent = 'Ajouter une intention';
        form.reset();
        document.getElementById('intentionEditIndex').value = '';
        // Pré-remplir l'email avec l'email par défaut si disponible
        const defaultEmail = document.getElementById('defaultEmail').value.trim();
        if (defaultEmail) {
            document.getElementById('intentionEmail').placeholder = `Email (par défaut: ${defaultEmail})`;
        }
    }
    
    modal.style.display = 'flex';
    
    // Initialiser l'auto-complétion après l'ouverture du modal
    setTimeout(() => {
        initAutocomplete();
    }, 150);
}

function closeIntentionModal() {
    document.getElementById('intentionModal').style.display = 'none';
    editingIntentionIndex = null;
    document.getElementById('intentionForm').reset();
    // Réinitialiser le flag d'auto-complétion pour permettre la réinitialisation
    const input = document.getElementById('intentionName');
    if (input) {
        input.removeAttribute('data-autocomplete-init');
    }
}

// Fermer le modal en cliquant en dehors
document.getElementById('intentionModal').addEventListener('click', (e) => {
    if (e.target.id === 'intentionModal') {
        closeIntentionModal();
    }
});

// Mettre à jour le placeholder de l'email quand l'email par défaut change
document.getElementById('defaultEmail').addEventListener('input', (e) => {
    const defaultEmail = e.target.value.trim();
    const intentionEmailInput = document.getElementById('intentionEmail');
    if (intentionEmailInput && !intentionEmailInput.value) {
        if (defaultEmail) {
            intentionEmailInput.placeholder = `Email (par défaut: ${defaultEmail})`;
        } else {
            intentionEmailInput.placeholder = "sav@example.com (optionnel, utilisera l'email par défaut si vide)";
        }
    }
});

// Afficher les intentions sous forme de badges
function renderIntentions() {
    const container = document.getElementById('customIntentionsContainer');
    const emptyState = document.getElementById('intentionsEmptyState');
    
    if (intentions.length === 0) {
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        return;
    }
    
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    container.innerHTML = '';
    
    intentions.forEach((intention, index) => {
        const badge = document.createElement('div');
        badge.className = 'intention-badge';
        badge.innerHTML = `
            <div class="intention-badge-content">
                <div class="intention-badge-info">
                    <strong>${escapeHtml(intention.name)}</strong>
                    <span class="intention-badge-email">${escapeHtml(intention.email)}</span>
                    ${intention.urgent ? '<span class="intention-badge-urgent">⚠️ Urgent</span>' : ''}
                </div>
                <div class="intention-badge-actions">
                    <button type="button" class="btn btn-sm btn-outline edit-intention" data-index="${index}">✏️</button>
                    <button type="button" class="btn btn-sm btn-danger remove-intention" data-index="${index}">🗑️</button>
                </div>
            </div>
        `;
        
        // Gérer l'édition
        badge.querySelector('.edit-intention').addEventListener('click', () => {
            openIntentionModal(index);
        });
        
        // Gérer la suppression
        badge.querySelector('.remove-intention').addEventListener('click', () => {
            if (confirm(`Êtes-vous sûr de vouloir supprimer l'intention "${intention.name}" ?`)) {
                intentions.splice(index, 1);
                renderIntentions();
            }
        });
        
        container.appendChild(badge);
    });
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Ouvrir le modal pour ajouter un profil SMTP
document.getElementById('addSmtpProfileBtn').addEventListener('click', () => {
    openSmtpModal();
});

// Fermer le modal SMTP
document.getElementById('closeSmtpModal').addEventListener('click', closeSmtpModal);
document.getElementById('cancelSmtpBtn').addEventListener('click', closeSmtpModal);

// Sauvegarder le profil SMTP
document.getElementById('saveSmtpBtn').addEventListener('click', () => {
    const profileName = document.getElementById('smtpProfileName').value.trim();
    const host = document.getElementById('smtpHost').value.trim();
    const port = parseInt(document.getElementById('smtpPort').value || '587');
    const secure = document.getElementById('smtpSecure').value === 'true';
    const user = document.getElementById('smtpUser').value.trim();
    const pass = document.getElementById('smtpPass').value.trim();
    const fromName = document.getElementById('smtpFromName').value.trim();
    const fromEmail = document.getElementById('smtpFromEmail').value.trim();
    
    if (!profileName || !host || !user || !pass || !fromName || !fromEmail) {
        alert('Veuillez remplir tous les champs requis');
        return;
    }
    
    const profile = {
        name: profileName,
        host,
        port,
        secure,
        user,
        pass,
        from_name: fromName,
        from_email: fromEmail
    };
    
    if (editingSmtpIndex !== null) {
        // Modifier un profil existant
        smtpProfiles[editingSmtpIndex] = profile;
    } else {
        // Ajouter un nouveau profil
        smtpProfiles.push(profile);
    }
    
    renderSmtpProfiles();
    closeSmtpModal();
});

// Fonctions pour gérer le modal SMTP
function openSmtpModal(profileIndex = null) {
    editingSmtpIndex = profileIndex;
    const modal = document.getElementById('smtpModal');
    const form = document.getElementById('smtpForm');
    const title = document.getElementById('smtpModalTitle');
    
    if (profileIndex !== null) {
        // Mode édition
        title.textContent = 'Modifier un profil SMTP';
        const profile = smtpProfiles[profileIndex];
        document.getElementById('smtpProfileName').value = profile.name || '';
        document.getElementById('smtpHost').value = profile.host || '';
        document.getElementById('smtpPort').value = profile.port || 587;
        document.getElementById('smtpSecure').value = profile.secure !== false ? 'true' : 'false';
        document.getElementById('smtpUser').value = profile.user || '';
        document.getElementById('smtpPass').value = profile.pass || '';
        document.getElementById('smtpFromName').value = profile.from_name || '';
        document.getElementById('smtpFromEmail').value = profile.from_email || '';
        document.getElementById('smtpEditIndex').value = profileIndex;
    } else {
        // Mode création
        title.textContent = 'Ajouter un profil SMTP';
        form.reset();
        document.getElementById('smtpPort').value = 587;
        document.getElementById('smtpSecure').value = 'true';
        document.getElementById('smtpEditIndex').value = '';
    }
    
    modal.style.display = 'flex';
}

function closeSmtpModal() {
    document.getElementById('smtpModal').style.display = 'none';
    editingSmtpIndex = null;
    document.getElementById('smtpForm').reset();
}

// Fermer le modal SMTP en cliquant en dehors
document.getElementById('smtpModal').addEventListener('click', (e) => {
    if (e.target.id === 'smtpModal') {
        closeSmtpModal();
    }
});

// Afficher les profils SMTP sous forme de badges
function renderSmtpProfiles() {
    const container = document.getElementById('smtpProfilesContainer');
    const emptyState = document.getElementById('smtpEmptyState');
    
    if (smtpProfiles.length === 0) {
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        return;
    }
    
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    container.innerHTML = '';
    
    smtpProfiles.forEach((profile, index) => {
        const badge = document.createElement('div');
        badge.className = 'smtp-profile-badge';
        badge.innerHTML = `
            <div class="smtp-profile-badge-content">
                <div class="smtp-profile-badge-info">
                    <strong>${escapeHtml(profile.name)}</strong>
                    <span class="smtp-profile-badge-details">${escapeHtml(profile.host)}:${profile.port} - ${escapeHtml(profile.from_email)}</span>
                </div>
                <div class="smtp-profile-badge-actions">
                    <button type="button" class="btn btn-sm btn-outline edit-smtp" data-index="${index}">✏️</button>
                    <button type="button" class="btn btn-sm btn-danger remove-smtp" data-index="${index}">🗑️</button>
                </div>
            </div>
        `;
        
        // Gérer l'édition
        badge.querySelector('.edit-smtp').addEventListener('click', () => {
            openSmtpModal(index);
        });
        
        // Gérer la suppression
        badge.querySelector('.remove-smtp').addEventListener('click', () => {
            if (confirm(`Êtes-vous sûr de vouloir supprimer le profil "${profile.name}" ?`)) {
                smtpProfiles.splice(index, 1);
                renderSmtpProfiles();
            }
        });
        
        container.appendChild(badge);
    });
}

// Vérifier l'email par défaut et afficher l'avertissement
function checkDefaultEmail() {
    const defaultEmailInput = document.getElementById('defaultEmail');
    const warning = document.getElementById('defaultEmailWarning');
    if (defaultEmailInput && warning) {
        if (!defaultEmailInput.value.trim()) {
            warning.style.display = 'inline';
        } else {
            warning.style.display = 'none';
        }
    }
}

// Surveiller les changements de l'email par défaut
document.getElementById('defaultEmail').addEventListener('input', checkDefaultEmail);
document.getElementById('defaultEmail').addEventListener('blur', checkDefaultEmail);

// Vérifier au chargement
checkDefaultEmail();

// Fonction pour ajouter un profil SMTP depuis les données
function addSmtpProfileFromData(profileData) {
    smtpProfiles.push({
        name: profileData.name || '',
        host: profileData.host || '',
        port: profileData.port || 587,
        secure: profileData.secure !== undefined ? profileData.secure : true,
        user: profileData.user || '',
        pass: profileData.pass || '',
        from_name: profileData.from_name || '',
        from_email: profileData.from_email || ''
    });
}

// Charger le SMTP par défaut du module mail
async function loadDefaultMailSmtp() {
    try {
        if (smtpProfiles.length > 0) {
            console.log('Déjà des profils SMTP, ne pas charger le profil par défaut');
            return; // Déjà des profils, ne pas charger
        }

        const response = await fetch(`${API_BASE_URL}/mail/config/mail`, {
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.log('Pas de configuration mail disponible');
            return; // Pas de config mail, on continue sans
        }

        const data = await response.json();
        
        if (data.success && data.config && data.config.smtp_profiles) {
            const profiles = data.config.smtp_profiles;
            
            // Debug : afficher les profils disponibles
            console.log('Profils SMTP disponibles dans mail:', Object.keys(profiles));
            
            // Chercher le profil par défaut dans cet ordre :
            // 1. Profil nommé 'default'
            // 2. Premier profil trouvé
            let profileKey = null;
            let profile = null;
            
            if (profiles['default']) {
                profileKey = 'default';
                profile = profiles['default'];
            } else {
                // Prendre le premier profil disponible
                const keys = Object.keys(profiles);
                if (keys.length > 0) {
                    profileKey = keys[0];
                    profile = profiles[profileKey];
                }
            }
            
            if (profile) {
                // Debug : afficher le profil sélectionné
                console.log('Profil SMTP sélectionné depuis mail:', profileKey, profile);
                
                // Vérifier à nouveau qu'on n'a toujours pas de profils (race condition)
                if (smtpProfiles.length === 0) {
                    // Utiliser le nom du profil original ou 'Mail (par défaut)'
                    const profileName = profileKey === 'default' ? 'Mail (par défaut)' : 
                        (profileKey.charAt(0).toUpperCase() + profileKey.slice(1).replace(/_/g, ' '));
                    
                    addSmtpProfileFromData({
                        name: profileName,
                        host: profile.smtp?.host || '',
                        port: profile.smtp?.port || 587,
                        secure: profile.smtp?.secure !== undefined ? profile.smtp.secure : true,
                        user: profile.auth?.user || '',
                        pass: profile.auth?.pass || '',
                        from_name: profile.from?.name || '',
                        from_email: profile.from?.email || ''
                    });
                    renderSmtpProfiles();
                }
            }
        }
    } catch (error) {
        console.log('Erreur lors du chargement du SMTP par défaut:', error);
    }
}

// Charger la configuration
document.getElementById('loadConfigBtn').addEventListener('click', async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/analyse/agent-config`, {
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Remplir le formulaire
            document.getElementById('basePrompt').value = data.data.basePrompt || data.data.base_prompt || '';
            document.getElementById('defaultEmail').value = data.data.defaultEmail || data.data.default_email || '';
            
            // Vérifier l'email après le chargement
            checkDefaultEmail();
            
            // Remplir les intentions
            const loadedIntentions = data.data.customIntentions || data.data.intentions || [];
            intentions = [];
            
            if (loadedIntentions.length > 0) {
                loadedIntentions.forEach(intention => {
                    addIntentionFromData(intention);
                });
            }
            
            renderIntentions();
            
            // Remplir SMTP
            const loadedSmtpProfiles = data.data.smtp_profiles || (data.data.smtpSettings ? { default: data.data.smtpSettings } : {});
            
            // Debug : afficher ce qui est chargé depuis la config sauvegardée
            console.log('Profils SMTP chargés depuis la config sauvegardée:', Object.keys(loadedSmtpProfiles));
            console.log('Détails des profils:', loadedSmtpProfiles);
            
            // Réinitialiser complètement la liste des profils SMTP AVANT de charger
            smtpProfiles = [];
            renderSmtpProfiles(); // Vider l'affichage immédiatement
            
            if (Object.keys(loadedSmtpProfiles).length > 0) {
                // Charger les profils depuis la configuration sauvegardée
                Object.entries(loadedSmtpProfiles).forEach(([profileKey, profile]) => {
                    console.log('Chargement profil SMTP depuis config sauvegardée:', profileKey, profile);
                    
                    const profileName = profileKey === 'default' ? 'Mail (par défaut)' : 
                        (profileKey.charAt(0).toUpperCase() + profileKey.slice(1).replace(/_/g, ' '));
                    
                    addSmtpProfileFromData({
                        name: profileName,
                        host: profile.smtp?.host || profile.host || '',
                        port: profile.smtp?.port || profile.port || 587,
                        secure: profile.smtp?.secure !== undefined ? profile.smtp.secure : (profile.secure !== undefined ? profile.secure : true),
                        user: profile.auth?.user || profile.user || '',
                        pass: profile.auth?.pass || profile.password || '',
                        from_name: profile.from?.name || profile.fromName || '',
                        from_email: profile.from?.email || profile.fromEmail || ''
                    });
                });
            } else {
                // Si pas de profils dans la config sauvegardée, charger le SMTP par défaut du module mail
                console.log('Aucun profil SMTP dans la config sauvegardée, chargement du profil par défaut du module mail');
                await loadDefaultMailSmtp();
            }
            
            renderSmtpProfiles();
            
            alert('✅ Configuration chargée avec succès !');
        } else {
            // Si pas de config, charger le SMTP par défaut
            await loadDefaultMailSmtp();
            // Vérifier l'email (sera vide, donc warning affiché)
            checkDefaultEmail();
            alert('⚠️ Aucune configuration trouvée.');
        }
    } catch (error) {
        console.error('Erreur:', error);
        // Charger le SMTP par défaut même en cas d'erreur
        await loadDefaultMailSmtp();
        // Vérifier l'email (sera vide, donc warning affiché)
        checkDefaultEmail();
        alert('❌ Erreur lors du chargement de la configuration');
    }
});

function addIntentionFromData(intention) {
    intentions.push({
        name: intention.name || intention.category || '',
        email: intention.email || '',
        urgent: intention.urgent || false
    });
}

// Sauvegarder la configuration
document.getElementById('agentConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Les intentions sont déjà dans le tableau global 'intentions'
    
    // Les profils SMTP sont déjà dans le tableau global 'smtpProfiles'
    // Convertir en format attendu par le backend
    const smtpProfilesObj = {};
    smtpProfiles.forEach(profile => {
        const profileKey = profile.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        smtpProfilesObj[profileKey] = {
            smtp: {
                host: profile.host,
                port: profile.port,
                secure: profile.secure
            },
            auth: {
                user: profile.user,
                pass: profile.pass
            },
            from: {
                name: profile.from_name,
                email: profile.from_email
            }
        };
    });
    
    // Préparer les données
    const configData = {
        base_prompt: document.getElementById('basePrompt').value,
        default_email: document.getElementById('defaultEmail').value,
        intentions: intentions,
        smtp_profiles: smtpProfilesObj
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/analyse/agent-config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT_TOKEN}`
            },
            body: JSON.stringify(configData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Configuration sauvegardée avec succès !');
        } else {
            alert('❌ Erreur: ' + (data.message || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('❌ Erreur lors de la sauvegarde');
    }
});

// Tester la connexion BackendIA
document.getElementById('testConnectionBtn').addEventListener('click', async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/analyse/test`, {
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Connexion au BackendIA réussie !\n\n' + JSON.stringify(data.data, null, 2));
        } else {
            alert('❌ Erreur de connexion:\n\n' + (data.message || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('❌ Erreur lors du test de connexion');
    }
});

// Charger la configuration au chargement de la page
window.addEventListener('load', () => {
    // Initialiser l'affichage vide
    renderIntentions();
    renderSmtpProfiles();
    
    // Ne PAS charger automatiquement le SMTP par défaut au chargement
    // Il sera chargé uniquement si aucune config n'est sauvegardée
    // Charger la config complète directement
    document.getElementById('loadConfigBtn').click();
});
</script>

<style>
.intentions-badges-container {
    margin-bottom: var(--spacing-md);
    min-height: 60px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: #f9f9f9;
    border-radius: 4px;
    border: 1px dashed #ddd;
}

.intention-badge {
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: var(--spacing-sm) var(--spacing-md);
    display: flex;
    align-items: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.intention-badge-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    width: 100%;
}

.intention-badge-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
}

.intention-badge-info strong {
    color: var(--color-primary);
    font-size: 0.95rem;
}

.intention-badge-email {
    font-size: 0.85rem;
    color: var(--color-gray);
}

.intention-badge-urgent {
    display: inline-block;
    background: #ff6b6b;
    color: white;
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 3px;
    margin-top: 4px;
}

.intention-badge-actions {
    display: flex;
    gap: var(--spacing-xs);
}

.empty-state {
    width: 100%;
    text-align: center;
    color: var(--color-gray);
    font-style: italic;
    padding: var(--spacing-md);
}

/* Modal styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.modal-close {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--color-gray);
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
}

.modal-close:hover {
    background: #f0f0f0;
}

.modal-header {
    padding: var(--spacing-lg);
    border-bottom: 1px solid #eee;
}

.modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
}

.modal-body {
    padding: var(--spacing-lg);
}

.modal-footer {
    padding: var(--spacing-lg);
    border-top: 1px solid #eee;
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
}

.smtp-profiles-badges-container {
    margin-bottom: var(--spacing-md);
    min-height: 60px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: #f9f9f9;
    border-radius: 4px;
    border: 1px dashed #ddd;
}

.smtp-profile-badge {
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: var(--spacing-sm) var(--spacing-md);
    display: flex;
    align-items: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.smtp-profile-badge-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    width: 100%;
}

.smtp-profile-badge-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
}

.smtp-profile-badge-info strong {
    color: var(--color-primary);
    font-size: 0.95rem;
}

.smtp-profile-badge-details {
    font-size: 0.85rem;
    color: var(--color-gray);
}

.smtp-profile-badge-actions {
    display: flex;
    gap: var(--spacing-xs);
}

.modal-large {
    max-width: 600px;
}

.form-actions {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #eee;
}

.form-actions .btn {
    margin-right: 0.5rem;
    margin-bottom: 0.5rem;
}

code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    color: var(--color-primary);
}

/* Styles pour l'auto-complétion */
.autocomplete-wrapper {
    position: relative;
}

.autocomplete-dropdown {
    position: absolute;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    margin-top: 2px;
}

.autocomplete-item {
    padding: var(--spacing-sm) var(--spacing-md);
    cursor: pointer;
    transition: background-color 0.2s;
    border-bottom: 1px solid #f0f0f0;
}

.autocomplete-item:last-child {
    border-bottom: none;
}

.autocomplete-item:hover,
.autocomplete-item.active {
    background-color: var(--color-primary);
    color: white;
}

.autocomplete-item:first-child {
    border-radius: 4px 4px 0 0;
}

.autocomplete-item:last-child {
    border-radius: 0 0 4px 4px;
}
</style>

<?php require_once '../../includes/footer.php'; ?>

