<?php
/**
 * Test du module Mail
 * Fichier : pages/modules/mail-test.php
 * 
 * Permet d'envoyer des emails de test et voir l'historique
 */

require_once '../../config/config.php';
require_once '../../config/database.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

// Nécessite authentification
if (!isLoggedIn()) {
    redirect(url('index.php'));
}

$page_title = 'Test Mail';
$module_name = 'mail';

require_once '../../includes/header.php';

// Token JWT pour les appels API
$jwt_token = getJWTToken();
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Test du module Mail</h1>
            <p class="hero-description">
                Envoyez des emails de test et consultez l'historique
            </p>
        </div>
    </div>
</section>

<!-- Section Envoi de test -->
<section class="section">
    <div class="container">
        <div class="card">
            <h2>Envoyer un email de test</h2>
            
            <form id="testEmailForm">
                <div class="form-group">
                    <label for="testTo">Destinataire *</label>
                    <input type="email" id="testTo" class="form-control" required placeholder="test@example.com" />
                </div>
                
                <div class="form-group">
                    <label for="testSubject">Sujet *</label>
                    <input type="text" id="testSubject" class="form-control" required placeholder="Test email" value="Test email - GDRI" />
                </div>
                
                <div class="form-group">
                    <label for="testBody">Message texte *</label>
                    <textarea id="testBody" class="form-control" rows="4" required placeholder="Corps du message">Ceci est un email de test depuis le module Mail GDRI.</textarea>
                </div>
                
                <div class="form-group">
                    <label for="testBodyHtml">Message HTML (optionnel)</label>
                    <textarea id="testBodyHtml" class="form-control" rows="4" placeholder="Version HTML"><h1>Test email</h1><p>Ceci est un email de test depuis le module Mail GDRI.</p></textarea>
                </div>
                
                <div class="form-group">
                    <label for="testProfile">Profil SMTP (optionnel)</label>
                    <select id="testProfile" class="form-control">
                        <option value="">Utiliser routing automatique</option>
                        <!-- Sera rempli dynamiquement -->
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        Envoyer l'email
                    </button>
                    <button type="button" class="btn btn-outline" id="refreshHistoryBtn">
                        Actualiser l'historique
                    </button>
                </div>
            </form>
            
            <div id="testResult" style="margin-top: var(--spacing-md);"></div>
        </div>
    </div>
</section>

<!-- Section Historique -->
<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Historique des emails</h2>
            <div class="filters">
                <select id="filterStatus" class="form-control" style="width: auto; display: inline-block;">
                    <option value="">Tous les statuts</option>
                    <option value="sent">Envoyés</option>
                    <option value="failed">Échoués</option>
                    <option value="pending">En attente</option>
                </select>
                <button class="btn btn-outline" id="applyFiltersBtn">Filtrer</button>
            </div>
        </div>
        
        <div id="emailsHistory">
            <div class="loading-state">
                <p>Chargement de l'historique...</p>
            </div>
        </div>
    </div>
</section>

<style>
.card {
    background: white;
    border-radius: 8px;
    padding: var(--spacing-lg);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: var(--spacing-lg);
}

.form-group {
    margin-bottom: var(--spacing-md);
}

.form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 600;
    color: var(--color-gray);
}

.form-control {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1px solid var(--color-light);
    border-radius: 4px;
    font-size: 1rem;
}

.form-actions {
    margin-top: var(--spacing-md);
    display: flex;
    gap: var(--spacing-md);
}

#testResult {
    padding: var(--spacing-md);
    border-radius: 4px;
}

#testResult.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

#testResult.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

.filters {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
}

.emails-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
}

.email-item {
    background: white;
    border-radius: 8px;
    padding: var(--spacing-md);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border-left: 4px solid;
}

.email-item.sent {
    border-left-color: #28a745;
}

.email-item.failed {
    border-left-color: #dc3545;
}

.email-item.pending {
    border-left-color: #ffc107;
}

.email-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
}

.email-subject {
    font-weight: 600;
    color: var(--color-primary);
    margin: 0;
}

.email-meta {
    display: flex;
    gap: var(--spacing-md);
    color: var(--color-gray);
    font-size: 0.9rem;
    margin-bottom: var(--spacing-xs);
}

.email-status {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
}

.email-status.sent {
    background: #d4edda;
    color: #155724;
}

.email-status.failed {
    background: #f8d7da;
    color: #721c24;
}

.email-status.pending {
    background: #fff3cd;
    color: #856404;
}

.loading-state {
    text-align: center;
    padding: var(--spacing-xl);
}

.empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-gray);
}
</style>

<script>
const API_BASE_URL = 'http://localhost:3000/api/mail';
const JWT_TOKEN = '<?php echo $jwt_token; ?>';
const MODULE_NAME = '<?php echo $module_name; ?>';

document.addEventListener('DOMContentLoaded', function() {
    loadEmailsHistory();
    loadProfils();
    
    document.getElementById('testEmailForm').addEventListener('submit', sendTestEmail);
    document.getElementById('refreshHistoryBtn').addEventListener('click', loadEmailsHistory);
    document.getElementById('applyFiltersBtn').addEventListener('click', loadEmailsHistory);
});

function loadProfils() {
    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, {
        headers: {
            'Authorization': `Bearer ${JWT_TOKEN}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.config && data.config.smtp_profiles) {
            const select = document.getElementById('testProfile');
            const profiles = Object.keys(data.config.smtp_profiles);
            
            profiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile;
                option.textContent = profile;
                select.appendChild(option);
            });
        }
    })
    .catch(error => {
        console.error('Erreur chargement profils:', error);
    });
}

function sendTestEmail(e) {
    e.preventDefault();
    
    const resultDiv = document.getElementById('testResult');
    resultDiv.className = '';
    resultDiv.textContent = 'Envoi en cours...';
    
    const emailData = {
        to: document.getElementById('testTo').value,
        subject: document.getElementById('testSubject').value,
        body: document.getElementById('testBody').value,
        body_html: document.getElementById('testBodyHtml').value || null,
        profile: document.getElementById('testProfile').value || null,
        module_name: MODULE_NAME
    };
    
    fetch(`${API_BASE_URL}/test/send`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${JWT_TOKEN}`
        },
        body: JSON.stringify(emailData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            resultDiv.className = 'success';
            resultDiv.textContent = `✅ Email envoyé avec succès ! ID: ${data.email_id}`;
            
            // Recharger l'historique
            setTimeout(loadEmailsHistory, 1000);
        } else {
            resultDiv.className = 'error';
            resultDiv.textContent = `❌ Erreur : ${data.message || 'Erreur inconnue'}`;
        }
    })
    .catch(error => {
        resultDiv.className = 'error';
        resultDiv.textContent = '❌ Erreur de connexion au serveur';
        console.error(error);
    });
}

function loadEmailsHistory() {
    const historyDiv = document.getElementById('emailsHistory');
    historyDiv.innerHTML = '<div class="loading-state"><p>Chargement de l\'historique...</p></div>';
    
    const statusFilter = document.getElementById('filterStatus').value;
    const params = new URLSearchParams();
    if (statusFilter) {
        params.append('status', statusFilter);
    }
    params.append('limit', '50');
    
    fetch(`${API_BASE_URL}/emails?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${JWT_TOKEN}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayEmails(data.emails);
        } else {
            historyDiv.innerHTML = `<div class="error-state"><p>Erreur : ${data.message || 'Erreur inconnue'}</p></div>`;
        }
    })
    .catch(error => {
        historyDiv.innerHTML = '<div class="error-state"><p>Erreur de connexion au serveur</p></div>';
        console.error(error);
    });
}

function displayEmails(emails) {
    const historyDiv = document.getElementById('emailsHistory');
    
    if (emails.length === 0) {
        historyDiv.innerHTML = '<div class="empty-state"><p>Aucun email dans l\'historique</p></div>';
        return;
    }
    
    const emailsList = document.createElement('div');
    emailsList.className = 'emails-list';
    
    emails.forEach(email => {
        const emailItem = document.createElement('div');
        emailItem.className = `email-item ${email.status}`;
        
        const sentDate = email.sent_at ? new Date(email.sent_at).toLocaleString('fr-FR') : 'Non envoyé';
        const statusText = {
            'sent': 'Envoyé',
            'failed': 'Échoué',
            'pending': 'En attente'
        }[email.status] || email.status;
        
        emailItem.innerHTML = `
            <div class="email-header">
                <h3 class="email-subject">${escapeHtml(email.subject)}</h3>
                <span class="email-status ${email.status}">${statusText}</span>
            </div>
            <div class="email-meta">
                <span><strong>À :</strong> ${escapeHtml(email.to)}</span>
                <span><strong>De :</strong> ${escapeHtml(email.from.name)} &lt;${escapeHtml(email.from.email)}&gt;</span>
                <span><strong>Profil :</strong> ${escapeHtml(email.profile_used)}</span>
                <span><strong>Date :</strong> ${sentDate}</span>
            </div>
            ${email.error ? `<div style="color: #dc3545; margin-top: var(--spacing-xs);"><strong>Erreur :</strong> ${escapeHtml(email.error)}</div>` : ''}
        `;
        
        emailsList.appendChild(emailItem);
    });
    
    historyDiv.innerHTML = '';
    historyDiv.appendChild(emailsList);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
</script>

<?php require_once '../../includes/footer.php'; ?>

