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

// Vérifier qu'une entreprise est sélectionnée (sauf pour ADMIN_GDRI)
// Cette vérification se fait APRÈS le header car $currentEntreprise est défini dans header.php
if (!hasRole(ROLE_ADMIN_GDRI) && empty($currentEntreprise)) {
    // Si aucune entreprise n'est sélectionnée, rediriger vers le dashboard
    // où l'utilisateur pourra sélectionner une entreprise
    echo '<script>
        alert("Veuillez sélectionner une entreprise avant d\'accéder à cette page.");
        window.location.href = "' . url('pages/dashboard.php') . '";
    </script>';
    exit;
}

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
                    <!-- Page Facebook (paramétrage par page) -->
                    <div class="form-group">
                        <label for="facebookPageSelect">Page Facebook</label>
                        <select id="facebookPageSelect" name="facebookPage" class="form-control" style="max-width: 400px;">
                            <option value="">Toutes les pages (défaut)</option>
                            <!-- Options chargies dynamiquement depuis les pages connectées -->
                        </select>
                        <small class="form-text text-muted">
                            Choisissez une page pour appliquer une configuration spécifique, ou « Toutes les pages » pour la config par défaut (utilisée si aucune config par page n'existe).
                        </small>
                    </div>
                    <!-- Prompt de base -->
                    <div class="form-group">
                        <label for="basePrompt">Prompt de base *</label>
                        <textarea 
                            id="basePrompt" 
                            name="basePrompt" 
                            class="form-control" 
                            rows="15" 
                            required
                        >Tu es un spécialiste expert en analyse d'intention de messages. Ton rôle est d'analyser précisément les messages reçus et d'identifier leur(s) intention(s) parmi les catégories suivantes :

{{Liste des intentions}}

Pour chaque message analysé, tu dois :

1. IDENTIFIER toutes les intentions possibles présentes dans le message
   - Un message peut contenir PLUSIEURS intentions simultanées (ex: SAV + Commercial, Technique + Information)
   - Pour chaque intention détectée, indique :
     * La catégorie d'intention
     * Le niveau de probabilité (de 0 à 100%)
     * Une brève explication de pourquoi cette intention a été détectée

2. ÉVALUER le niveau de certitude global de ton analyse (de 0 à 100%)

3. DÉTERMINER si une action urgente est requise (notamment pour les messages critiques, réclamations importantes, ou demandes nécessitant une réponse immédiate)

Instructions importantes :
- Sois précis et objectif dans ton analyse
- Prends en compte le contexte, le ton et le contenu du message
- Si plusieurs intentions sont possibles, liste-les toutes avec leur probabilité respective
- Pour les messages ambigus, indique un niveau de certitude plus faible
- Les messages urgents nécessitent une attention immédiate et doivent être traités en priorité

Réponds au format JSON avec un tableau d'intentions détectées, chacune avec sa probabilité.

Analyse maintenant le(s) message(s) suivant(s) :</textarea>
                        <small class="form-text text-muted">
                            Utilisez <code>{{Liste des intentions}}</code> dans votre prompt pour insérer automatiquement la liste des intentions configurées ci-dessous
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

                    <!-- Fréquence des rapports -->
                    <div class="form-group report-frequency-section" style="margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                        <h3 style="margin: 0 0 1rem 0; font-size: 1.05rem;">Fréquence des rapports</h3>
                        <p class="form-text text-muted" style="margin-bottom: 1rem;">Définissez quand envoyer un mail pour chaque type de message.</p>
                        <!-- Messages urgents -->
                        <div class="form-group">
                            <label><strong>Messages urgents</strong></label>
                            <select id="reportUrgentSchedule" name="reportUrgentSchedule" class="form-control" style="max-width: 320px;">
                                <option value="immediate">Envoyer un mail immédiatement</option>
                                <option value="daily_1">1 fois par jour (à l'heure choisie)</option>
                                <option value="daily_2">2 fois par jour (heures choisies)</option>
                                <option value="daily_3">3 fois par jour (heures choisies)</option>
                            </select>
                            <div id="reportUrgentTimesWrap" style="display: none; margin-top: 0.5rem;">
                                <div id="reportUrgentTime1Wrap" class="report-urgent-time-row" style="margin-bottom: 0.35rem;">
                                    <label>Heure 1</label>
                                    <input type="time" id="reportUrgentTime1" class="form-control report-urgent-time" style="max-width: 100px; display: inline-block;" value="09:00">
                                </div>
                                <div id="reportUrgentTime2Wrap" class="report-urgent-time-row" style="display: none; margin-bottom: 0.35rem;">
                                    <label>Heure 2</label>
                                    <input type="time" id="reportUrgentTime2" class="form-control report-urgent-time" style="max-width: 100px; display: inline-block;" value="14:00">
                                </div>
                                <div id="reportUrgentTime3Wrap" class="report-urgent-time-row" style="display: none; margin-bottom: 0.35rem;">
                                    <label>Heure 3</label>
                                    <input type="time" id="reportUrgentTime3" class="form-control report-urgent-time" style="max-width: 100px; display: inline-block;" value="18:00">
                                </div>
                            </div>
                        </div>
                        <!-- Messages à répondre -->
                        <div class="form-group">
                            <label><strong>Messages à répondre</strong></label>
                            <select id="reportReplySchedule" name="reportReplySchedule" class="form-control" style="max-width: 320px;">
                                <option value="immediate">Envoyer un mail immédiatement</option>
                                <option value="daily">Quotidien (à l'heure choisie)</option>
                                <option value="weekly_1">1 fois par semaine (jour + heure)</option>
                                <option value="weekly_2">2 fois par semaine (jours + heure)</option>
                                <option value="weekly_3">3 fois par semaine (jours + heure)</option>
                            </select>
                            <div id="reportReplyDailyWrap" style="display: none; margin-top: 0.5rem;">
                                <label for="reportReplyDailyHour">Heure d'envoi</label>
                                <input type="time" id="reportReplyDailyHour" class="form-control" style="max-width: 100px; display: inline-block;" value="09:00">
                            </div>
                            <div id="reportReplyWeeklyWrap" style="display: none; margin-top: 0.5rem;">
                                <div class="report-weekly-rows">
                                    <div class="report-weekly-row" data-n="1">
                                        <label>Jour 1</label>
                                        <select id="reportReplyWeekDay1" class="form-control report-reply-weekday" style="max-width: 140px; display: inline-block;">
                                            <option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option><option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option>
                                        </select>
                                    </div>
                                    <div class="report-weekly-row" data-n="2" style="display: none;">
                                        <label>Jour 2</label>
                                        <select id="reportReplyWeekDay2" class="form-control report-reply-weekday" style="max-width: 140px; display: inline-block;">
                                            <option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option><option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option>
                                        </select>
                                    </div>
                                    <div class="report-weekly-row" data-n="3" style="display: none;">
                                        <label>Jour 3</label>
                                        <select id="reportReplyWeekDay3" class="form-control report-reply-weekday" style="max-width: 140px; display: inline-block;">
                                            <option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option><option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option>
                                        </select>
                                    </div>
                                </div>
                                <div style="margin-top: 0.35rem;">
                                    <label for="reportReplyWeeklyHour">Heure d'envoi</label>
                                    <input type="time" id="reportReplyWeeklyHour" class="form-control" style="max-width: 100px; display: inline-block;" value="09:00">
                                </div>
                            </div>
                        </div>
                        <!-- Interactions / Statistiques -->
                        <div class="form-group">
                            <label><strong>Interactions / Statistiques</strong></label>
                            <select id="reportInteractionFrequency" name="reportInteractionFrequency" class="form-control" style="max-width: 280px;">
                                <option value="daily">1 fois par jour</option>
                                <option value="weekly">1 fois par semaine</option>
                                <option value="monthly">1 fois par mois</option>
                            </select>
                            <div class="form-check" style="margin-top: 0.5rem;">
                                <input type="checkbox" id="reportInteractionSendEmail" name="reportInteractionSendEmail" class="form-check-input">
                                <label class="form-check-label" for="reportInteractionSendEmail">Envoyer un mail avec le rapport</label>
                            </div>
                        </div>
                    </div>

                    <!-- Liste des intentions -->
                    <div class="form-group">
                        <label>Liste des intentions</label>
                        
                        <!-- Intentions par défaut -->
                        <div class="default-intentions-section">
                            <h4 style="margin-bottom: 12px; font-size: 1rem; color: var(--color-primary);">Intentions par défaut</h4>
                            <div id="defaultIntentionsContainer" class="default-intentions-checkboxes">
                                <!-- Les checkboxes seront générées par JavaScript -->
                            </div>
                        </div>
                        
                        <!-- Intentions personnalisées -->
                        <div class="custom-intentions-section" style="margin-top: 24px;">
                            <h4 style="margin-bottom: 12px; font-size: 1rem; color: var(--color-primary);">Intentions personnalisées</h4>
                            <div id="customIntentionsContainer" class="intentions-badges-container">
                                <!-- Les intentions personnalisées ajoutées seront affichées ici sous forme de badges -->
                                <div class="empty-state" id="intentionsEmptyState">
                                    <p>Aucune intention personnalisée. Cliquez sur "Ajouter une intention personnalisée" pour en créer une.</p>
                                </div>
                            </div>
                            <button type="button" class="btn btn-outline btn-sm" id="addIntentionBtn">
                                + Ajouter une intention personnalisée
                            </button>
                        </div>
                        
                        <small class="form-text text-muted" style="margin-top: 12px; display: block;">
                            Les intentions sélectionnées seront automatiquement insérées dans le prompt via {{Liste des intentions}}
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
                
                <div class="form-group intention-modal-section">
                    <label for="intentionDefinition">Définition affinée</label>
                    <textarea 
                        id="intentionDefinition" 
                        class="form-control" 
                        rows="3" 
                        placeholder="Décrivez précisément ce que recouvre cette intention pour l'analyse..."
                    ></textarea>
                    <small class="form-text text-muted">Précisez le périmètre de cette intention pour améliorer la détection par l'IA</small>
                </div>
                
                <div class="form-group intention-modal-section">
                    <label for="intentionPriority">Ordre de priorité du rapport</label>
                    <select id="intentionPriority" class="form-control">
                        <option value="immediate">Immédiat — notification dès qu'une intention est détectée</option>
                        <option value="daily">Journalier — rapport récapitulatif chaque jour</option>
                        <option value="weekly">Rapport par semaine — rapport récapitulatif hebdomadaire</option>
                        <option value="monthly">Mensuel — rapport récapitulatif mensuel</option>
                    </select>
                    <small class="form-text text-muted">Définit comment et quand les rapports pour cette intention sont envoyés</small>
                </div>
                
                <div class="form-group intention-modal-section">
                    <label>Destinataires du rapport d'intention</label>
                    <div id="intentionRecipientsContainer" class="recipients-container">
                        <!-- Les destinataires seront ajoutés ici dynamiquement -->
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <input 
                            type="email" 
                            id="intentionEmailInput" 
                            class="form-control" 
                            placeholder="email@exemple.com"
                            style="flex: 1;"
                        />
                        <button type="button" class="btn btn-outline btn-sm" id="addRecipientBtn">
                            + Ajouter
                        </button>
                    </div>
                    <small class="form-text text-muted">Un ou plusieurs emails qui recevront les notifications pour cette intention. Si vide, l'email par défaut sera utilisé.</small>
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

// Debug : afficher l'URL de l'API au chargement
console.log('🌐 Configuration Agent Facebook - API_BASE_URL:', API_BASE_URL);
console.log('🔑 JWT_TOKEN présent:', JWT_TOKEN ? 'Oui (' + JWT_TOKEN.substring(0, 20) + '...)' : 'Non');

// Intentions par défaut disponibles
const DEFAULT_INTENTIONS = [
    { name: 'commercial', label: 'Commercial', description: 'Demandes de produits, prix, devis, informations commerciales' },
    { name: 'sav', label: 'SAV', description: 'Problèmes techniques, bugs, dysfonctionnements' },
    { name: 'technique', label: 'Technique', description: 'Questions d\'utilisation, configuration, installation' },
    { name: 'critique', label: 'Critique', description: 'Signalements d\'erreurs, corrections d\'informations' },
    { name: 'positif', label: 'Positif', description: 'Commentaires positifs, remerciements' },
    { name: 'spam', label: 'Spam', description: 'Messages publicitaires, indésirables' },
    { name: 'generic', label: 'Générique', description: 'Si aucune autre catégorie ne s\'applique' }
];

let defaultIntentionsEnabled = {}; // Objet pour stocker l'état des intentions par défaut {name: true/false}
let defaultIntentionOverrides = {}; // { name: { priority, emails } } pour priorité/destinataires des intentions par défaut
let intentions = []; // Tableau pour stocker les intentions personnalisées uniquement
let smtpProfiles = []; // Tableau pour stocker les profils SMTP
let editingIntentionIndex = null;
let editingDefaultIntentionName = null; // Nom de l'intention par défaut en cours d'édition (ou null si custom)
let editingSmtpIndex = null;

// Sauvegarder le prompt par défaut
const DEFAULT_PROMPT = `Tu es un spécialiste expert en analyse d'intention de messages. Ton rôle est d'analyser précisément les messages reçus et d'identifier leur(s) intention(s) parmi les catégories suivantes :

{{Liste des intentions}}

Pour chaque message analysé, tu dois :

1. IDENTIFIER toutes les intentions possibles présentes dans le message
   - Un message peut contenir PLUSIEURS intentions simultanées (ex: SAV + Commercial, Technique + Information)
   - Pour chaque intention détectée, indique :
     * La catégorie d'intention
     * Le niveau de probabilité (de 0 à 100%)
     * Une brève explication de pourquoi cette intention a été détectée

2. ÉVALUER le niveau de certitude global de ton analyse (de 0 à 100%)

3. DÉTERMINER si une action urgente est requise (notamment pour les messages critiques, réclamations importantes, ou demandes nécessitant une réponse immédiate)

Instructions importantes :
- Sois précis et objectif dans ton analyse
- Prends en compte le contexte, le ton et le contenu du message
- Si plusieurs intentions sont possibles, liste-les toutes avec leur probabilité respective
- Pour les messages ambigus, indique un niveau de certitude plus faible
- Les messages urgents nécessitent une attention immédiate et doivent être traités en priorité

Réponds au format JSON avec un tableau d'intentions détectées, chacune avec sa probabilité.

Analyse maintenant le(s) message(s) suivant(s) :`;

// Ouvrir le modal pour ajouter une intention
document.getElementById('addIntentionBtn').addEventListener('click', () => {
    openIntentionModal();
});

// Fermer le modal
document.getElementById('closeIntentionModal').addEventListener('click', closeIntentionModal);
document.getElementById('cancelIntentionBtn').addEventListener('click', closeIntentionModal);

// Initialiser les intentions par défaut (toutes activées par défaut)
function initDefaultIntentions() {
    DEFAULT_INTENTIONS.forEach(intention => {
        defaultIntentionsEnabled[intention.name] = true;
    });
    renderDefaultIntentions();
}

// Afficher les checkboxes des intentions par défaut + bouton Modifier
function renderDefaultIntentions() {
    const container = document.getElementById('defaultIntentionsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    DEFAULT_INTENTIONS.forEach(intention => {
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'default-intention-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `default-intention-${intention.name}`;
        checkbox.checked = defaultIntentionsEnabled[intention.name] || false;
        checkbox.addEventListener('change', (e) => {
            defaultIntentionsEnabled[intention.name] = e.target.checked;
        });
        
        const label = document.createElement('label');
        label.htmlFor = `default-intention-${intention.name}`;
        label.innerHTML = `
            <strong>${escapeHtml(intention.label)}</strong>
            <small>${escapeHtml(intention.description)}</small>
        `;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'default-intention-actions';
        const modifBtn = document.createElement('button');
        modifBtn.type = 'button';
        modifBtn.className = 'btn btn-outline btn-sm btn-modifier-intention';
        modifBtn.textContent = 'Modifier';
        modifBtn.title = 'Ouvrir le paramétrage (priorité et destinataires)';
        modifBtn.dataset.intentionName = intention.name;
        modifBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openIntentionModalForDefault(intention.name);
        });
        actionsDiv.appendChild(modifBtn);
        
        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(label);
        checkboxWrapper.appendChild(actionsDiv);
        container.appendChild(checkboxWrapper);
    });
}

// Obtenir toutes les intentions actives (par défaut activées + personnalisées) avec priorité/destinataires
function getAllActiveIntentions() {
    const activeDefault = DEFAULT_INTENTIONS
        .filter(intention => defaultIntentionsEnabled[intention.name])
        .map(intention => {
            const overrides = defaultIntentionOverrides[intention.name] || {};
            const emails = overrides.emails && overrides.emails.length > 0 ? overrides.emails : [];
            const email = emails[0] || '';
            return {
                name: intention.name,
                priority: overrides.priority || 'immediate',
                emails,
                email,
                urgent: (overrides.priority || 'immediate') === 'immediate',
                isDefault: true
            };
        });
    return [...activeDefault, ...intentions];
}

// Obtenir toutes les options d'intentions disponibles pour l'auto-complétion
function getIntentionOptions() {
    const predefined = DEFAULT_INTENTIONS.map(i => i.name);
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

// Gérer les destinataires dans le modal
let currentRecipients = []; // Liste des emails pour l'intention en cours d'édition

// Ajouter un destinataire
document.getElementById('addRecipientBtn').addEventListener('click', () => {
    const emailInput = document.getElementById('intentionEmailInput');
    const email = emailInput.value.trim();
    
    if (!email) {
        alert('Veuillez saisir un email');
        return;
    }
    
    // Valider le format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Veuillez saisir un email valide');
        return;
    }
    
    // Vérifier si l'email n'est pas déjà dans la liste
    if (currentRecipients.includes(email)) {
        alert('Cet email est déjà dans la liste');
        return;
    }
    
    currentRecipients.push(email);
    emailInput.value = '';
    renderRecipients();
});

// Permettre d'ajouter un destinataire avec Enter
document.getElementById('intentionEmailInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('addRecipientBtn').click();
    }
});

// Afficher les destinataires
function renderRecipients() {
    const container = document.getElementById('intentionRecipientsContainer');
    container.innerHTML = '';
    
    if (currentRecipients.length === 0) {
        container.innerHTML = '<p style="color: #999; font-style: italic; margin: 0; padding: 8px;">Aucun destinataire ajouté (utilisera l\'email par défaut)</p>';
        return;
    }
    
    currentRecipients.forEach((email, index) => {
        const recipientBadge = document.createElement('div');
        recipientBadge.className = 'recipient-badge';
        recipientBadge.innerHTML = `
            <span>${escapeHtml(email)}</span>
            <button type="button" class="recipient-remove" data-index="${index}" title="Supprimer">×</button>
        `;
        
        recipientBadge.querySelector('.recipient-remove').addEventListener('click', () => {
            currentRecipients.splice(index, 1);
            renderRecipients();
        });
        
        container.appendChild(recipientBadge);
    });
}

// Libellés de priorité pour l'affichage
const PRIORITY_LABELS = {
    immediate: 'Immédiat',
    daily: 'Journalier',
    weekly: 'Rapport par semaine',
    monthly: 'Mensuel'
};

// Sauvegarder l'intention
document.getElementById('saveIntentionBtn').addEventListener('click', () => {
    const name = document.getElementById('intentionName').value.trim();
    const priority = document.getElementById('intentionPriority').value || 'immediate';
    const definition = (document.getElementById('intentionDefinition') && document.getElementById('intentionDefinition').value.trim()) || '';
    
    if (!name) {
        alert('Veuillez saisir un nom d\'intention');
        return;
    }
    
    // Si pas de destinataires, utiliser l'email par défaut
    let emails = [...currentRecipients];
    if (emails.length === 0) {
        const defaultEmail = document.getElementById('defaultEmail').value.trim();
        if (!defaultEmail) {
            alert('Veuillez ajouter au moins un destinataire ou configurer un email par défaut');
            return;
        }
        emails = [defaultEmail]; // Utiliser l'email par défaut comme seul destinataire
    }
    
    if (editingDefaultIntentionName) {
        // Sauvegarder les paramètres d'une intention par défaut (priorité + destinataires)
        defaultIntentionOverrides[editingDefaultIntentionName] = {
            priority,
            emails
        };
        editingDefaultIntentionName = null;
        renderDefaultIntentions();
    } else {
        const intention = {
            name,
            definition: definition || undefined,
            priority,
            emails,
            email: emails[0],
            urgent: priority === 'immediate'
        };
        if (editingIntentionIndex !== null) {
            intentions[editingIntentionIndex] = intention;
        } else {
            intentions.push(intention);
        }
        renderIntentions();
    }
    
    closeIntentionModal();
});

// Ouvrir le modal pour paramétrer une intention par défaut (priorité + destinataires)
function openIntentionModalForDefault(intentionName) {
    editingDefaultIntentionName = intentionName;
    editingIntentionIndex = null;
    const modal = document.getElementById('intentionModal');
    const title = document.getElementById('intentionModalTitle');
    const defaultIntention = DEFAULT_INTENTIONS.find(i => i.name === intentionName);
    const overrides = defaultIntentionOverrides[intentionName] || {};
    
    title.textContent = 'Paramétrer l\'intention : ' + (defaultIntention ? defaultIntention.label : intentionName);
    document.getElementById('intentionName').value = intentionName;
    document.getElementById('intentionName').readOnly = true;
    document.getElementById('intentionName').classList.add('readonly-field');
    document.getElementById('intentionDefinition').value = defaultIntention ? (defaultIntention.description || '') : '';
    document.getElementById('intentionDefinition').readOnly = true;
    document.getElementById('intentionDefinition').classList.add('readonly-field');
    document.getElementById('intentionPriority').value = overrides.priority || 'immediate';
    document.getElementById('intentionEditIndex').value = '';
    
    currentRecipients = overrides.emails && Array.isArray(overrides.emails) ? [...overrides.emails] : (overrides.email ? [overrides.email] : []);
    document.getElementById('intentionEmailInput').value = '';
    renderRecipients();
    
    modal.style.display = 'flex';
}

// Fonctions pour gérer le modal
function openIntentionModal(intentionIndex = null) {
    editingDefaultIntentionName = null;
    editingIntentionIndex = intentionIndex;
    const modal = document.getElementById('intentionModal');
    const form = document.getElementById('intentionForm');
    const title = document.getElementById('intentionModalTitle');
    const nameInput = document.getElementById('intentionName');
    const definitionInput = document.getElementById('intentionDefinition');
    
    nameInput.readOnly = false;
    nameInput.classList.remove('readonly-field');
    definitionInput.readOnly = false;
    definitionInput.classList.remove('readonly-field');
    currentRecipients = [];
    
    if (intentionIndex !== null) {
        title.textContent = 'Modifier une intention';
        const intention = intentions[intentionIndex];
        nameInput.value = intention.name || '';
        definitionInput.value = intention.definition || '';
        document.getElementById('intentionPriority').value = intention.priority || intention.reportFrequency || 'immediate';
        document.getElementById('intentionEditIndex').value = intentionIndex;
        
        if (intention.emails && Array.isArray(intention.emails)) {
            currentRecipients = [...intention.emails];
        } else if (intention.email) {
            currentRecipients = [intention.email];
        }
    } else {
        title.textContent = 'Ajouter une intention';
        form.reset();
        document.getElementById('intentionEditIndex').value = '';
        document.getElementById('intentionPriority').value = 'immediate';
    }
    
    document.getElementById('intentionEmailInput').value = '';
    renderRecipients();
    modal.style.display = 'flex';
    
    setTimeout(() => initAutocomplete(), 150);
}

function closeIntentionModal() {
    document.getElementById('intentionModal').style.display = 'none';
    editingIntentionIndex = null;
    editingDefaultIntentionName = null;
    document.getElementById('intentionForm').reset();
    const nameInput = document.getElementById('intentionName');
    const definitionInput = document.getElementById('intentionDefinition');
    if (nameInput) {
        nameInput.readOnly = false;
        nameInput.classList.remove('readonly-field');
        nameInput.removeAttribute('data-autocomplete-init');
    }
    if (definitionInput) {
        definitionInput.readOnly = false;
        definitionInput.classList.remove('readonly-field');
    }
    currentRecipients = [];
    renderRecipients();
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
    const intentionEmailInput = document.getElementById('intentionEmailInput');
    if (intentionEmailInput && !intentionEmailInput.value) {
        if (defaultEmail) {
            intentionEmailInput.placeholder = `Email (par défaut: ${defaultEmail})`;
        } else {
            intentionEmailInput.placeholder = "sav@example.com";
        }
    }
});

// Afficher les intentions personnalisées sous forme de badges
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
        // Récupérer tous les destinataires (support ancien et nouveau format)
        const emails = intention.emails && Array.isArray(intention.emails) 
            ? intention.emails 
            : (intention.email ? [intention.email] : []);
        
        const emailsDisplay = emails.length > 0 
            ? emails.map(email => escapeHtml(email)).join(', ')
            : 'Aucun destinataire';
        
        const priority = intention.priority || intention.reportFrequency || 'immediate';
        const priorityLabel = PRIORITY_LABELS[priority] || priority;
        
        const badge = document.createElement('div');
        badge.className = 'intention-badge';
        badge.setAttribute('data-index', index);
        badge.style.cursor = 'pointer';
        badge.title = 'Cliquer pour modifier la priorité et les destinataires';
        badge.innerHTML = `
            <div class="intention-badge-content">
                <div class="intention-badge-info">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <strong>${escapeHtml(intention.name)}</strong>
                        <span class="intention-badge-priority">${escapeHtml(priorityLabel)}</span>
                        ${(intention.urgent || priority === 'immediate') ? '<span class="intention-badge-urgent">⚠️ Urgent</span>' : ''}
                    </div>
                    <span class="intention-badge-email" title="${emails.length > 1 ? emails.map(e => escapeHtml(e)).join(', ') : ''}">
                        ${emails.length > 1 ? `${emails.length} destinataires: ${emailsDisplay}` : emailsDisplay}
                    </span>
                </div>
                <div class="intention-badge-actions">
                    <button type="button" class="btn btn-outline edit-intention" data-index="${index}" title="Modifier">
                        <span style="font-size: 14px;">✏️</span>
                    </button>
                    <button type="button" class="btn btn-danger remove-intention" data-index="${index}" title="Supprimer">
                        <span style="font-size: 14px;">🗑️</span>
                    </button>
                </div>
            </div>
        `;
        
        badge.addEventListener('click', (e) => {
            if (!e.target.closest('.intention-badge-actions')) openIntentionModal(index);
        });
        badge.querySelector('.edit-intention').addEventListener('click', (e) => { e.stopPropagation(); openIntentionModal(index); });
        badge.querySelector('.remove-intention').addEventListener('click', (e) => {
            e.stopPropagation();
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
                    <button type="button" class="btn btn-outline edit-smtp" data-index="${index}" title="Modifier">
                        <span style="font-size: 14px;">✏️</span>
                    </button>
                    <button type="button" class="btn btn-danger remove-smtp" data-index="${index}" title="Supprimer">
                        <span style="font-size: 14px;">🗑️</span>
                    </button>
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

function getSelectedPageId() {
    const sel = document.getElementById('facebookPageSelect');
    return sel && sel.value ? sel.value : '';
}

// Charger la liste des pages Facebook pour le sélecteur
async function loadFacebookPagesForSelect() {
    const sel = document.getElementById('facebookPageSelect');
    if (!sel) return;
    const firstOption = sel.options[0];
    while (sel.options.length > 1) sel.remove(1);
    try {
        const res = await fetch(`${API_BASE_URL}/facebook/pages/summary`, {
            headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.pages && data.pages.length > 0) {
            data.pages.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.pageId || '';
                opt.textContent = (p.pageName || `Page ${p.pageId}`).trim();
                sel.appendChild(opt);
            });
        }
    } catch (e) {
        console.warn('Liste des pages Facebook non chargée:', e);
    }
}

// Charger la configuration
document.getElementById('loadConfigBtn').addEventListener('click', async () => {
    try {
        const pageId = getSelectedPageId();
        const url = pageId ? `${API_BASE_URL}/analyse/agent-config?pageId=${encodeURIComponent(pageId)}` : `${API_BASE_URL}/analyse/agent-config`;
        console.log('🔍 Chargement config - URL:', url);
        console.log('🔍 Token JWT présent:', JWT_TOKEN ? 'Oui' : 'Non');
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`
            }
        });
        
        console.log('📡 Réponse reçue - Status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erreur HTTP:', response.status, errorText);
            throw new Error(`Erreur ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Remplir le formulaire
            // Ne remplacer le prompt que s'il existe vraiment dans la configuration (non vide)
            const loadedPrompt = data.data.basePrompt || data.data.base_prompt || '';
            if (loadedPrompt.trim()) {
                document.getElementById('basePrompt').value = loadedPrompt;
            } else {
                // Si pas de prompt dans la config, garder le prompt par défaut
                document.getElementById('basePrompt').value = DEFAULT_PROMPT;
            }
            document.getElementById('defaultEmail').value = data.data.defaultEmail || data.data.default_email || '';
            
            // Vérifier l'email après le chargement
            checkDefaultEmail();
            
            // Fréquence des rapports
            const rf = data.data.reportFrequency || {};
            var urgentScheduleEl = document.getElementById('reportUrgentSchedule');
            if (urgentScheduleEl) {
                urgentScheduleEl.value = rf.urgentSchedule || (rf.urgentSendEmail !== false ? 'immediate' : 'daily_1');
                toggleUrgentTimes();
            }
            var replyScheduleEl = document.getElementById('reportReplySchedule');
            if (replyScheduleEl) {
                replyScheduleEl.value = rf.replyFrequency || 'immediate';
            }
            var replyDailyHourEl = document.getElementById('reportReplyDailyHour');
            if (replyDailyHourEl) replyDailyHourEl.value = rf.replyDailyHour || '09:00';
            var replyDailyWrap = document.getElementById('reportReplyDailyWrap');
            if (replyDailyWrap) replyDailyWrap.style.display = (rf.replyFrequency || 'immediate') === 'daily' ? 'block' : 'none';
            var replyWeeklyWrap = document.getElementById('reportReplyWeeklyWrap');
            if (replyWeeklyWrap) {
                replyWeeklyWrap.style.display = (rf.replyFrequency === 'weekly_1' || rf.replyFrequency === 'weekly_2' || rf.replyFrequency === 'weekly_3') ? 'block' : 'none';
                replyWeeklyWrap.querySelectorAll('.report-weekly-row').forEach(function(row) {
                    var n = parseInt(row.getAttribute('data-n'), 10);
                    row.style.display = (n <= (rf.replyFrequency === 'weekly_1' ? 1 : rf.replyFrequency === 'weekly_2' ? 2 : rf.replyFrequency === 'weekly_3' ? 3 : 0)) ? 'block' : 'none';
                });
            }
            var replyWeeklyHourEl = document.getElementById('reportReplyWeeklyHour');
            if (replyWeeklyHourEl) replyWeeklyHourEl.value = rf.replyWeeklyHour || '09:00';
            var interactionFreqEl = document.getElementById('reportInteractionFrequency');
            if (interactionFreqEl) interactionFreqEl.value = rf.interactionFrequency || 'daily';
            var interactionSendEmailEl = document.getElementById('reportInteractionSendEmail');
            if (interactionSendEmailEl) interactionSendEmailEl.checked = rf.interactionSendEmail === true;
            
            // Remplir les intentions
            const loadedIntentions = data.data.customIntentions || data.data.intentions || [];
            const loadedDefaultIntentions = data.data.defaultIntentionsEnabled || {};
            
            // Restaurer l'état des intentions par défaut
            DEFAULT_INTENTIONS.forEach(intention => {
                defaultIntentionsEnabled[intention.name] = loadedDefaultIntentions[intention.name] !== undefined 
                    ? loadedDefaultIntentions[intention.name] 
                    : true; // Par défaut, toutes activées
            });
            renderDefaultIntentions();
            
            // Charger les intentions personnalisées (exclure les intentions par défaut)
            intentions = [];
            defaultIntentionOverrides = {};
            const defaultNames = DEFAULT_INTENTIONS.map(i => i.name);
            
            if (loadedIntentions.length > 0) {
                loadedIntentions.forEach(intention => {
                    const name = intention.name || intention.category;
                    if (!name) return;
                    if (defaultNames.includes(name)) {
                        // Paramètres (priorité, destinataires) d'une intention par défaut
                        const emails = intention.emails && Array.isArray(intention.emails) ? intention.emails : (intention.email ? [intention.email] : []);
                        if (intention.priority || emails.length > 0) {
                            defaultIntentionOverrides[name] = {
                                priority: intention.priority || intention.reportFrequency || 'immediate',
                                emails
                            };
                        }
                    } else {
                        addIntentionFromData(intention);
                    }
                });
            }
            
            renderDefaultIntentions();
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
            // Si pas de config, initialiser avec toutes les intentions par défaut activées
            DEFAULT_INTENTIONS.forEach(intention => {
                defaultIntentionsEnabled[intention.name] = true;
            });
            renderDefaultIntentions();
            
            // S'assurer que le prompt par défaut est présent
            const basePromptEl = document.getElementById('basePrompt');
            if (!basePromptEl.value.trim()) {
                basePromptEl.value = DEFAULT_PROMPT;
            }
            
            // Charger le SMTP par défaut
            await loadDefaultMailSmtp();
            // Vérifier l'email (sera vide, donc warning affiché)
            checkDefaultEmail();
            alert('⚠️ Aucune configuration trouvée.');
        }
    } catch (error) {
        console.error('Erreur:', error);
        // Si erreur, initialiser avec toutes les intentions par défaut activées
        DEFAULT_INTENTIONS.forEach(intention => {
            defaultIntentionsEnabled[intention.name] = true;
        });
        renderDefaultIntentions();
        
        // S'assurer que le prompt par défaut est présent
        const basePromptEl = document.getElementById('basePrompt');
        if (!basePromptEl.value.trim()) {
            basePromptEl.value = DEFAULT_PROMPT;
        }
        
        // Charger le SMTP par défaut même en cas d'erreur
        await loadDefaultMailSmtp();
        // Vérifier l'email (sera vide, donc warning affiché)
        checkDefaultEmail();
        alert('❌ Erreur lors du chargement de la configuration');
    }
});

function addIntentionFromData(intention) {
    const emails = intention.emails && Array.isArray(intention.emails) 
        ? intention.emails 
        : (intention.email ? [intention.email] : []);
    
    intentions.push({
        name: intention.name || intention.category || '',
        definition: intention.definition || '',
        priority: intention.priority || intention.reportFrequency || 'immediate',
        emails,
        email: emails[0] || '',
        urgent: intention.urgent || intention.priority === 'immediate'
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
    // Inclure toutes les intentions actives (par défaut activées + personnalisées)
    const allActiveIntentions = getAllActiveIntentions();
    
    const configData = {
        base_prompt: document.getElementById('basePrompt').value,
        default_email: document.getElementById('defaultEmail').value,
        intentions: allActiveIntentions,
        defaultIntentionsEnabled: defaultIntentionsEnabled,
        smtp_profiles: smtpProfilesObj,
        pageId: getSelectedPageId() || null,
        reportFrequency: (function() {
            var urgentEl = document.getElementById('reportUrgentSchedule');
            var replyEl = document.getElementById('reportReplySchedule');
            var replyDailyEl = document.getElementById('reportReplyDailyHour');
            var interactionFreqEl = document.getElementById('reportInteractionFrequency');
            var interactionSendEl = document.getElementById('reportInteractionSendEmail');
            return {
                urgentSchedule: urgentEl ? urgentEl.value : 'immediate',
                urgentSendEmail: urgentEl ? (urgentEl.value === 'immediate') : true,
                replyFrequency: replyEl ? replyEl.value : 'immediate',
                replyDailyHour: replyDailyEl ? replyDailyEl.value : '09:00',
                interactionFrequency: interactionFreqEl ? interactionFreqEl.value : 'daily',
                interactionSendEmail: interactionSendEl ? interactionSendEl.checked : false
            };
        })()
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

// Fermer le modal d'entreprise dès que le DOM est prêt (avant même le chargement complet)
document.addEventListener('DOMContentLoaded', () => {
    // S'assurer que le modal d'entreprise n'est pas affiché
    // Si une entreprise est déjà sélectionnée, le modal ne devrait pas s'afficher
    const entrepriseModal = document.getElementById('entrepriseModal');
    if (entrepriseModal) {
        // Forcer la fermeture du modal
        entrepriseModal.classList.remove('active');
        entrepriseModal.style.display = 'none';
        console.log('✅ Modal d\'entreprise fermé automatiquement - une entreprise est déjà sélectionnée');
    }
});

// Fermer le modal immédiatement (avant même DOMContentLoaded)
(function() {
    const entrepriseModal = document.getElementById('entrepriseModal');
    if (entrepriseModal) {
        entrepriseModal.classList.remove('active');
        entrepriseModal.style.display = 'none';
    }
})();

// Visibilité des options "Messages urgents"
function toggleUrgentTimes() {
    const sel = document.getElementById('reportUrgentSchedule');
    if (!sel) return;
    const v = sel.value;
    const wrap = document.getElementById('reportUrgentTimesWrap');
    if (wrap) wrap.style.display = (v === 'daily_1' || v === 'daily_2' || v === 'daily_3') ? 'block' : 'none';
    const t1 = document.getElementById('reportUrgentTime1Wrap');
    if (t1) t1.style.display = wrap ? wrap.style.display : 'none';
    const t2 = document.getElementById('reportUrgentTime2Wrap');
    if (t2) t2.style.display = (v === 'daily_2' || v === 'daily_3') ? 'block' : 'none';
    const t3 = document.getElementById('reportUrgentTime3Wrap');
    if (t3) t3.style.display = (v === 'daily_3') ? 'block' : 'none';
}
var reportUrgentScheduleEl = document.getElementById('reportUrgentSchedule');
if (reportUrgentScheduleEl) reportUrgentScheduleEl.addEventListener('change', toggleUrgentTimes);

// Visibilité des options "Messages à répondre"
function toggleReplySchedule() {
    const sel = document.getElementById('reportReplySchedule');
    if (!sel) return;
    const v = sel.value;
    const dailyWrap = document.getElementById('reportReplyDailyWrap');
    if (dailyWrap) dailyWrap.style.display = v === 'daily' ? 'block' : 'none';
    const weeklyWrap = document.getElementById('reportReplyWeeklyWrap');
    if (weeklyWrap) {
        weeklyWrap.style.display = (v === 'weekly_1' || v === 'weekly_2' || v === 'weekly_3') ? 'block' : 'none';
        const n = v === 'weekly_1' ? 1 : v === 'weekly_2' ? 2 : v === 'weekly_3' ? 3 : 0;
        weeklyWrap.querySelectorAll('.report-weekly-row').forEach(function(row) {
            row.style.display = (parseInt(row.getAttribute('data-n'), 10) <= n) ? 'block' : 'none';
        });
    }
}
var reportReplyScheduleEl = document.getElementById('reportReplySchedule');
if (reportReplyScheduleEl) reportReplyScheduleEl.addEventListener('change', toggleReplySchedule);

// Au changement de page Facebook, recharger la config
var facebookPageSelectEl = document.getElementById('facebookPageSelect');
if (facebookPageSelectEl) facebookPageSelectEl.addEventListener('change', function() {
    var loadBtn = document.getElementById('loadConfigBtn');
    if (loadBtn) loadBtn.click();
});

// Charger la configuration au chargement de la page
window.addEventListener('load', async () => {
    const entrepriseModal = document.getElementById('entrepriseModal');
    if (entrepriseModal) {
        entrepriseModal.classList.remove('active');
        entrepriseModal.style.display = 'none';
        console.log('✅ Modal d\'entreprise fermé automatiquement (vérification au chargement)');
    }
    
    initDefaultIntentions();
    renderIntentions();
    renderSmtpProfiles();
    
    await loadFacebookPagesForSelect();
    document.getElementById('loadConfigBtn').click();
});
</script>

<style>
.form-check { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.form-check-input { width: 1rem; height: 1rem; margin: 0; }
.form-check-label { margin: 0; cursor: pointer; }
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
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    transition: all 0.2s ease;
    min-width: 280px;
    max-width: 100%;
}

.intention-badge:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,0.12);
    border-color: var(--color-primary);
}

.intention-badge-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
}

.intention-badge-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0; /* Permet au texte de se rétrécir si nécessaire */
}

.intention-badge-info strong {
    color: var(--color-primary);
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.3;
    word-break: break-word;
}

.intention-badge-email {
    font-size: 0.8rem;
    color: #666;
    line-height: 1.3;
    word-break: break-word;
    overflow-wrap: break-word;
}

.intention-badge-priority {
    display: inline-block;
    background: #e8f4fd;
    color: var(--color-primary);
    font-size: 0.75rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid #b3d9ff;
}

.intention-badge-urgent {
    display: inline-block;
    background: #ff6b6b;
    color: white;
    font-size: 0.7rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 12px;
    margin-top: 4px;
    align-self: flex-start;
}

.intention-badge-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0; /* Empêche les boutons de rétrécir */
    align-items: center;
}

.intention-badge-actions .btn {
    min-width: 32px;
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 14px;
    line-height: 1;
    transition: all 0.2s ease;
}

.intention-badge-actions .btn:hover {
    transform: scale(1.1);
}

.intention-badge-actions .edit-intention {
    background: #f0f7ff;
    border-color: #b3d9ff;
    color: var(--color-primary);
}

.intention-badge-actions .edit-intention:hover {
    background: #e0efff;
    border-color: var(--color-primary);
}

.intention-badge-actions .remove-intention {
    background: #fff5f5;
    border-color: #ffb3b3;
    color: #dc3545;
}

.intention-badge-actions .remove-intention:hover {
    background: #ffe0e0;
    border-color: #dc3545;
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
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    transition: all 0.2s ease;
    min-width: 280px;
    max-width: 100%;
}

.smtp-profile-badge:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,0.12);
    border-color: var(--color-primary);
}

.smtp-profile-badge-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
}

.smtp-profile-badge-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0; /* Permet au texte de se rétrécir si nécessaire */
}

.smtp-profile-badge-info strong {
    color: var(--color-primary);
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.3;
    word-break: break-word;
}

.smtp-profile-badge-details {
    font-size: 0.8rem;
    color: #666;
    line-height: 1.3;
    word-break: break-word;
    overflow-wrap: break-word;
}

.smtp-profile-badge-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0; /* Empêche les boutons de rétrécir */
    align-items: center;
}

.smtp-profile-badge-actions .btn {
    min-width: 32px;
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 14px;
    line-height: 1;
    transition: all 0.2s ease;
}

.smtp-profile-badge-actions .btn:hover {
    transform: scale(1.1);
}

.smtp-profile-badge-actions .edit-smtp {
    background: #f0f7ff;
    border-color: #b3d9ff;
    color: var(--color-primary);
}

.smtp-profile-badge-actions .edit-smtp:hover {
    background: #e0efff;
    border-color: var(--color-primary);
}

.smtp-profile-badge-actions .remove-smtp {
    background: #fff5f5;
    border-color: #ffb3b3;
    color: #dc3545;
}

.smtp-profile-badge-actions .remove-smtp:hover {
    background: #ffe0e0;
    border-color: #dc3545;
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

/* Styles pour les intentions par défaut */
.default-intentions-section {
    margin-bottom: 24px;
    padding: 16px;
    background: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
}

.default-intentions-checkboxes {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.default-intention-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    margin-bottom: 0;
    background: #f9f9f9;
    border-radius: 6px;
    transition: all 0.2s ease;
    border: 1px solid transparent;
}

.default-intention-item:hover {
    background: #f0f0f0 !important;
    border-color: #e0e0e0;
}

.default-intention-item input[type="checkbox"] {
    width: 18px !important;
    height: 18px !important;
    min-width: 18px !important;
    max-width: 18px !important;
    flex-shrink: 0;
    margin-top: 4px;
    cursor: pointer;
    accent-color: var(--color-primary);
}

.default-intention-item label {
    flex: 1;
    cursor: pointer;
    margin: 0;
    line-height: 1.4;
}

.default-intention-item label strong {
    display: block;
    color: var(--color-primary);
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 4px;
}

.default-intention-item label small {
    display: block;
    color: #666;
    font-size: 0.85em;
    line-height: 1.3;
}

.default-intention-actions {
    flex-shrink: 0;
    margin-left: auto;
}

.default-intention-actions .btn-modifier-intention {
    white-space: nowrap;
}

#intentionModal .readonly-field,
.modal-overlay#intentionModal .readonly-field {
    background: #f5f5f5;
    color: #555;
    cursor: not-allowed;
}

.custom-intentions-section {
    padding-top: 16px;
    border-top: 2px solid #e0e0e0;
}

/* Styles pour les destinataires dans le modal */
.recipients-container {
    min-height: 40px;
    max-height: 200px;
    overflow-y: auto;
    padding: 8px;
    background: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    margin-bottom: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.recipient-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 16px;
    font-size: 0.85rem;
    color: #333;
}

.recipient-badge span {
    color: #555;
}

.recipient-remove {
    background: none;
    border: none;
    color: #dc3545;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
}

.recipient-remove:hover {
    background: #ffe0e0;
    color: #c82333;
    transform: scale(1.1);
}
</style>

<?php require_once '../../includes/footer.php'; ?>

