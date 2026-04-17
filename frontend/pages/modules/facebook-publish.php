<?php
/**
 * Publication Facebook - Publier des posts et répondre aux messages
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

function hasFacebookServiceAccessViaApi()
{
    if (hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY)) {
        return true;
    }
    if (!hasRole(ROLE_USER_ENTITY)) {
        return false;
    }
    $token = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if (!$token || !$apiBase) {
        return false;
    }
    $ch = curl_init($apiBase . '/users/me/services-context');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err || $code < 200 || $code >= 300) {
        return false;
    }
    $decoded = json_decode((string) $raw, true);
    $services = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
    foreach ($services as $service) {
        $slug = strtolower(trim((string) ($service['slug'] ?? '')));
        $name = strtolower(trim((string) ($service['name'] ?? '')));
        if ($slug === 'facebook' || strpos($name, 'facebook') !== false) {
            return true;
        }
    }
    return false;
}

$hasAccess = isLoggedIn() && hasFacebookServiceAccessViaApi();

if (!$hasAccess) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Publier sur Facebook';
require_once '../../includes/header.php';

$jwt_token = getJWTToken();
$api_base_url = getApiBaseUrl();
?>

<div class="container" style="max-width: 900px; margin: 2rem auto; padding: 0 1rem;">
    
    <div class="card">
        <div class="card-header">
            <h2>📝 Publier un post</h2>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9em; color: #666;">
                Publiez des posts (texte et image) sur vos pages Facebook directement depuis GDRI.
            </p>
        </div>
        <div class="card-body">
            
            <!-- Message si aucune page -->
            <div id="noPagesMessage" class="alert alert-info" style="display: none;">
                Vous n'avez pas encore connecté de pages Facebook. 
                <a href="<?= url('pages/modules/facebook-config.php') ?>" style="color: #007bff; text-decoration: underline;">
                    Connectez-vous d'abord avec Facebook
                </a>
            </div>
            
            <!-- Onglets pour les pages -->
            <div id="pagesTabs" style="display: none; margin-bottom: 1.5rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e0e0e0; flex-wrap: wrap; margin-bottom: 1.5rem;">
                    <!-- Les onglets seront générés dynamiquement -->
                </div>
            </div>
            
            <style>
                .page-tab {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    background: transparent;
                    border-bottom: 3px solid transparent;
                    cursor: pointer;
                    font-weight: 500;
                    color: #666;
                    transition: all 0.2s;
                    border-radius: 4px 4px 0 0;
                }
                .page-tab:hover {
                    color: #1877f2;
                    background-color: #f0f8ff;
                }
                .page-tab.active {
                    border-bottom-color: #1877f2;
                    color: #1877f2;
                }
                .page-tab-content {
                    animation: fadeIn 0.3s ease-in;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
            
            <!-- Contenu des onglets -->
            <div id="pagesContent">
                <!-- Le contenu sera généré dynamiquement -->
            </div>
            
        </div>
    </div>

</div>

<script>
const API_BASE = '<?= $api_base_url ?>';
const JWT = '<?= $jwt_token ?>';

// Charger les pages connectées
async function loadPages() {
    try {
        const res = await fetch(`${API_BASE}/facebook/config`, {
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        if (!data.success || !data.pages || data.pages.length === 0) {
            document.getElementById('noPagesMessage').style.display = 'block';
            return;
        }
        
        document.getElementById('noPagesMessage').style.display = 'none';
        
        const pages = data.pages;
        const tabsContainer = document.querySelector('#pagesTabs > div');
        const contentContainer = document.getElementById('pagesContent');
        
        if (pages.length === 1) {
            // Une seule page : pas besoin d'onglets
            document.getElementById('pagesTabs').style.display = 'none';
            contentContainer.innerHTML = '';
            createPageContent(pages[0], contentContainer, true);
        } else {
            // Plusieurs pages : créer des onglets
            document.getElementById('pagesTabs').style.display = 'block';
            tabsContainer.innerHTML = '';
            contentContainer.innerHTML = '';
            
            pages.forEach((page, index) => {
                const pageId = page.pageId;
                
                // Créer l'onglet
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'page-tab';
                tab.dataset.pageId = pageId;
                tab.textContent = page.pageName || page.pageId;
                
                if (index === 0) {
                    tab.classList.add('active');
                }
                
                tab.addEventListener('click', () => {
                    document.querySelectorAll('#pagesTabs .page-tab').forEach(t => {
                        t.classList.remove('active');
                    });
                    tab.classList.add('active');
                    
                    document.querySelectorAll('.page-tab-content').forEach(c => {
                        c.style.display = 'none';
                    });
                    const content = document.getElementById(`page-content-${pageId}`);
                    if (content) content.style.display = 'block';
                });
                
                tabsContainer.appendChild(tab);
                
                // Créer le contenu de l'onglet
                const contentDiv = document.createElement('div');
                contentDiv.id = `page-content-${pageId}`;
                contentDiv.className = 'page-tab-content';
                contentDiv.style.display = index === 0 ? 'block' : 'none';
                contentContainer.appendChild(contentDiv);
                
                createPageContent(page, contentDiv, false);
            });
        }
    } catch (e) {
        console.error('Erreur chargement pages:', e);
        document.getElementById('noPagesMessage').style.display = 'block';
    }
}

// Créer le contenu pour une page (publier post + messages)
function createPageContent(page, container, isSinglePage) {
    const pageId = page.pageId;
    
    container.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem;">${isSinglePage ? 'Publier un post' : `Publier sur "${page.pageName || page.pageId}"`}</h3>
            
            <form class="publish-post-form" data-page-id="${pageId}">
                <div style="margin-bottom: 1rem;">
                    <label for="post-message-${pageId}" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                        Message <span style="color: #dc3545;">*</span>
                    </label>
                    <textarea 
                        id="post-message-${pageId}" 
                        name="message" 
                        rows="5" 
                        maxlength="5000"
                        placeholder="Écrivez votre message ici..."
                        style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-family: inherit; font-size: 1em; resize: vertical; transition: border-color 0.2s;"
                        onfocus="this.style.borderColor='#1877f2';"
                        onblur="this.style.borderColor='#e0e0e0';"
                    ></textarea>
                    <div style="margin-top: 0.5rem; font-size: 0.85em; color: #666; text-align: right;">
                        <span id="char-count-${pageId}">0</span> / 5000 caractères
                    </div>
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="post-image-url-${pageId}" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                        URL de l'image (optionnel)
                    </label>
                    <input type="url" 
                        id="post-image-url-${pageId}" 
                        name="image_url" 
                        placeholder="https://exemple.com/image.jpg"
                        style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1em;"
                    >
                    <div style="margin-top: 0.35rem; font-size: 0.8em; color: #666;">
                        Indiquez l'URL publique d'une image (min. 200px sur un côté). Aucune permission supplémentaire requise.
                    </div>
                </div>
                
                <div style="padding: 1rem; background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px; margin-bottom: 1.5rem;">
                    <p style="margin: 0; font-size: 0.9em;">
                        <strong>ℹ️ Note :</strong> Le post sera publié immédiatement sur votre page Facebook. 
                        Cette action utilise la permission <code>pages_manage_posts</code>.
                    </p>
                </div>
                
                <button type="submit" class="btn btn-primary publish-post-btn" data-page-id="${pageId}">
                    📝 Publier sur Facebook
                </button>
                <div class="publish-post-status" data-page-id="${pageId}" style="margin-top: 1rem;"></div>
            </form>
        </div>
    `;
    
    // Ajouter le compteur de caractères
    const textarea = container.querySelector(`#post-message-${pageId}`);
    const charCount = container.querySelector(`#char-count-${pageId}`);
    if (textarea && charCount) {
        textarea.addEventListener('input', () => {
            const count = textarea.value.length;
            charCount.textContent = count;
            if (count > 4500) {
                charCount.style.color = '#dc3545';
            } else if (count > 4000) {
                charCount.style.color = '#ffc107';
            } else {
                charCount.style.color = '#666';
            }
        });
    }
    
    // Ajouter l'événement submit pour publier
    const form = container.querySelector('.publish-post-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await publishPost(pageId, form);
    });
}

// Publier un post
async function publishPost(pageId, form) {
    const textarea = form.querySelector(`#post-message-${pageId}`);
    const imageUrlInput = form.querySelector(`#post-image-url-${pageId}`);
    const message = textarea ? textarea.value.trim() : '';
    const imageUrl = imageUrlInput ? imageUrlInput.value.trim() : '';
    
    if (!message && !imageUrl) {
        alert('Veuillez saisir un message et/ou une URL d\'image');
        return;
    }
    
    const btn = form.querySelector('.publish-post-btn');
    const statusDiv = form.querySelector('.publish-post-status');
    
    btn.disabled = true;
    btn.textContent = 'Publication...';
    statusDiv.innerHTML = '';
    
    try {
        const body = { message: message || '' };
        if (imageUrl) body.image_url = imageUrl;
        const res = await fetch(`${API_BASE}/facebook/pages/${encodeURIComponent(pageId)}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT}`
            },
            body: JSON.stringify(body)
        });
        
        const contentType = res.headers.get('content-type');
        let data;
        
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Réponse non-JSON reçue:', text);
            throw new Error(`Erreur serveur (${res.status}): ${text.substring(0, 200)}`);
        }
        
        try {
            data = await res.json();
        } catch (parseError) {
            const text = await res.text();
            console.error('Erreur parsing JSON:', parseError, 'Réponse:', text);
            throw new Error(`Erreur parsing JSON: ${parseError.message}. Réponse: ${text.substring(0, 200)}`);
        }
        
        if (data.success) {
            statusDiv.innerHTML = `<div class="alert alert-success">
                ✅ ${data.message || 'Post publié avec succès !'}
                ${data.postId ? `<br><small style="font-size: 0.85em; color: #666;">ID du post: ${data.postId}</small>` : ''}
            </div>`;
            
            // Réinitialiser le formulaire
            if (textarea) textarea.value = '';
            if (imageUrlInput) imageUrlInput.value = '';
            const charCount = form.querySelector(`#char-count-${pageId}`);
            if (charCount) charCount.textContent = '0';
        } else {
            statusDiv.innerHTML = `<div class="alert alert-danger">❌ ${data.message || 'Erreur lors de la publication'}</div>`;
        }
    } catch (e) {
        console.error('Erreur publication post:', e);
        statusDiv.innerHTML = `<div class="alert alert-danger">❌ Erreur : ${e.message}<br><small style="font-size: 0.85em; color: #666;">Vérifiez la console (F12) pour plus de détails</small></div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = '📝 Publier sur Facebook';
    }
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Charger au démarrage
loadPages();
</script>

<?php require_once '../../includes/footer.php'; ?>
