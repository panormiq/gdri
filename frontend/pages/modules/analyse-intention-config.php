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
                            rows="10" 
                            placeholder="Entrez le prompt de base pour l'analyse d'intention..."
                            required
                        ></textarea>
                        <small class="form-text text-muted">
                            Ce prompt sera utilisé comme base pour toutes les analyses. Vous pouvez utiliser des variables comme {messages} pour les messages à analyser.
                        </small>
                    </div>

                    <!-- Adresse email par défaut -->
                    <div class="form-group">
                        <label for="defaultEmail">Adresse email par défaut *</label>
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

                    <!-- Intentions personnalisées -->
                    <div class="form-group">
                        <label>Intentions personnalisées</label>
                        <div id="customIntentionsContainer">
                            <!-- Les intentions seront ajoutées ici dynamiquement -->
                        </div>
                        <button type="button" class="btn btn-outline" id="addIntentionBtn">
                            + Ajouter une intention
                        </button>
                        <small class="form-text text-muted">
                            Ajoutez des intentions personnalisées avec leurs emails et prompts spécifiques.
                        </small>
                    </div>

                    <!-- Paramètres SMTP -->
                    <div class="form-group">
                        <h3>Paramètres SMTP</h3>
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="smtpHost">Serveur SMTP *</label>
                                <input 
                                    type="text" 
                                    id="smtpHost" 
                                    name="smtpHost" 
                                    class="form-control" 
                                    placeholder="smtp.example.com"
                                    required
                                />
                            </div>
                            <div class="form-group col-md-6">
                                <label for="smtpPort">Port *</label>
                                <input 
                                    type="number" 
                                    id="smtpPort" 
                                    name="smtpPort" 
                                    class="form-control" 
                                    placeholder="587"
                                    value="587"
                                    required
                                />
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="smtpUser">Utilisateur *</label>
                                <input 
                                    type="text" 
                                    id="smtpUser" 
                                    name="smtpUser" 
                                    class="form-control" 
                                    placeholder="user@example.com"
                                    required
                                />
                            </div>
                            <div class="form-group col-md-6">
                                <label for="smtpPassword">Mot de passe *</label>
                                <input 
                                    type="password" 
                                    id="smtpPassword" 
                                    name="smtpPassword" 
                                    class="form-control" 
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="smtpFromEmail">Email expéditeur *</label>
                            <input 
                                type="email" 
                                id="smtpFromEmail" 
                                name="smtpFromEmail" 
                                class="form-control" 
                                placeholder="noreply@example.com"
                                required
                            />
                        </div>
                        <div class="form-group">
                            <label for="smtpFromName">Nom expéditeur</label>
                            <input 
                                type="text" 
                                id="smtpFromName" 
                                name="smtpFromName" 
                                class="form-control" 
                                placeholder="GDRI Agent IA"
                            />
                        </div>
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

<!-- Template pour une intention personnalisée -->
<template id="intentionTemplate">
    <div class="intention-item card mb-3">
        <div class="card-body">
            <div class="form-row">
                <div class="form-group col-md-4">
                    <label>Catégorie d'intention *</label>
                    <select class="form-control intention-category" required>
                        <option value="">Sélectionner...</option>
                        <option value="commercial">Commercial</option>
                        <option value="sav">SAV</option>
                        <option value="technique">Technique</option>
                        <option value="critique">Critique</option>
                        <option value="positif">Positif</option>
                        <option value="spam">Spam</option>
                        <option value="generic">Generic</option>
                    </select>
                </div>
                <div class="form-group col-md-4">
                    <label>Email pour cette intention *</label>
                    <input 
                        type="email" 
                        class="form-control intention-email" 
                        placeholder="sav@example.com"
                        required
                    />
                </div>
                <div class="form-group col-md-4">
                    <label>Actions</label>
                    <button type="button" class="btn btn-danger btn-sm btn-block remove-intention">
                        🗑️ Supprimer
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label>Prompt spécifique (optionnel)</label>
                <textarea 
                    class="form-control intention-prompt" 
                    rows="3" 
                    placeholder="Prompt spécifique pour cette intention (optionnel)..."
                ></textarea>
                <small class="form-text text-muted">
                    Si renseigné, ce prompt sera utilisé en plus du prompt de base pour cette intention spécifique.
                </small>
            </div>
        </div>
    </div>
</template>

<script>
const API_BASE_URL = '<?= $api_base_url ?>';
const JWT_TOKEN = '<?= $jwt_token ?>';

let intentionCounter = 0;

// Ajouter une intention
document.getElementById('addIntentionBtn').addEventListener('click', () => {
    const template = document.getElementById('intentionTemplate');
    const clone = template.content.cloneNode(true);
    const container = document.getElementById('customIntentionsContainer');
    
    const intentionItem = clone.querySelector('.intention-item');
    intentionItem.dataset.intentionId = intentionCounter++;
    
    // Gérer la suppression
    clone.querySelector('.remove-intention').addEventListener('click', () => {
        intentionItem.remove();
    });
    
    container.appendChild(clone);
});

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
            document.getElementById('basePrompt').value = data.data.basePrompt || '';
            document.getElementById('defaultEmail').value = data.data.defaultEmail || '';
            
            // Remplir les intentions
            if (data.data.customIntentions && data.data.customIntentions.length > 0) {
                data.data.customIntentions.forEach(intention => {
                    addIntentionFromData(intention);
                });
            }
            
            // Remplir SMTP
            if (data.data.smtpSettings) {
                document.getElementById('smtpHost').value = data.data.smtpSettings.host || '';
                document.getElementById('smtpPort').value = data.data.smtpSettings.port || '587';
                document.getElementById('smtpUser').value = data.data.smtpSettings.user || '';
                document.getElementById('smtpPassword').value = data.data.smtpSettings.password || '';
                document.getElementById('smtpFromEmail').value = data.data.smtpSettings.fromEmail || '';
                document.getElementById('smtpFromName').value = data.data.smtpSettings.fromName || '';
            }
            
            alert('✅ Configuration chargée avec succès !');
        } else {
            alert('⚠️ Aucune configuration trouvée.');
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('❌ Erreur lors du chargement de la configuration');
    }
});

function addIntentionFromData(intention) {
    const template = document.getElementById('intentionTemplate');
    const clone = template.content.cloneNode(true);
    const container = document.getElementById('customIntentionsContainer');
    
    const intentionItem = clone.querySelector('.intention-item');
    intentionItem.dataset.intentionId = intentionCounter++;
    
    clone.querySelector('.intention-category').value = intention.category || '';
    clone.querySelector('.intention-email').value = intention.email || '';
    clone.querySelector('.intention-prompt').value = intention.prompt || '';
    
    clone.querySelector('.remove-intention').addEventListener('click', () => {
        intentionItem.remove();
    });
    
    container.appendChild(clone);
}

// Sauvegarder la configuration
document.getElementById('agentConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collecter les intentions
    const intentions = [];
    document.querySelectorAll('.intention-item').forEach(item => {
        const category = item.querySelector('.intention-category').value;
        const email = item.querySelector('.intention-email').value;
        const prompt = item.querySelector('.intention-prompt').value;
        
        if (category && email) {
            intentions.push({
                category,
                email,
                prompt: prompt || null
            });
        }
    });
    
    // Préparer les données
    const configData = {
        basePrompt: document.getElementById('basePrompt').value,
        defaultEmail: document.getElementById('defaultEmail').value,
        customIntentions: intentions,
        smtpSettings: {
            host: document.getElementById('smtpHost').value,
            port: parseInt(document.getElementById('smtpPort').value),
            user: document.getElementById('smtpUser').value,
            password: document.getElementById('smtpPassword').value,
            fromEmail: document.getElementById('smtpFromEmail').value,
            fromName: document.getElementById('smtpFromName').value || ''
        }
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
    document.getElementById('loadConfigBtn').click();
});
</script>

<style>
.intention-item {
    border: 1px solid #ddd;
    border-radius: 4px;
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
</style>

<?php require_once '../../includes/footer.php'; ?>

