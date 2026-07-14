<?php
/**
 * Module Facebook — Posts Page : création, liste, édition et suppression.
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';
require_once '../../includes/entity-console-nav.php';

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

$jwt_token = getJWTToken();
$api_base_url = getApiBaseUrl();

$page_title = 'Posts Facebook';
require_once '../../includes/header.php';
renderConsoleLayoutStart(
    'Posts Facebook',
    'Créez, listez, modifiez et supprimez les publications de vos pages Facebook.',
    ['narrow' => true]
);
?>

    <div class="card">
        <div class="card-header">
            <h2>Posts de Page</h2>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9em; color: #666;">
                Créez des posts (texte, lien optionnel ou image via URL), listez les publications déjà en ligne, modifiez le texte ou supprimez un post.
                Un jeton Page avec la permission <code>pages_manage_posts</code> est requis (configuré à l’étape « Connexion »).
            </p>
        </div>
        <div class="card-body">

            <div id="noPagesMessage" class="alert alert-info" style="display: none;">
                Aucune Page connectée pour cette entité.
                <a href="<?= htmlspecialchars(url('pages/modules/facebook.php') . '?tab=config') ?>" style="color: #007bff; text-decoration: underline;">
                    Connecter Facebook et une Page
                </a>
            </div>

            <div id="pagesTabs" style="display: none; margin-bottom: 1.5rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e0e0e0; flex-wrap: wrap; margin-bottom: 1.5rem;">
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
                .fb-posts-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
                .fb-posts-table th, .fb-posts-table td {
                    border: 1px solid #e9ecef;
                    padding: 0.5rem 0.6rem;
                    vertical-align: top;
                    text-align: left;
                }
                .fb-posts-table th { background: #f8f9fa; }
                .fb-posts-actions { white-space: nowrap; }
                .fb-posts-actions button { margin-right: 0.35rem; margin-bottom: 0.25rem; }
                #fb-edit-overlay {
                    display: none;
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.45);
                    z-index: 10000;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                }
                #fb-edit-overlay.open { display: flex; }
                .fb-edit-box {
                    background: #fff;
                    border-radius: 8px;
                    max-width: 520px;
                    width: 100%;
                    padding: 1.25rem;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                }
            </style>

            <div id="pagesContent"></div>

        </div>
    </div>

<?php renderConsoleLayoutEnd(); ?>

<div id="fb-edit-overlay" role="dialog" aria-modal="true" aria-labelledby="fb-edit-title">
    <div class="fb-edit-box">
        <h3 id="fb-edit-title" style="margin-top: 0;">Modifier le message</h3>
        <p class="text-muted small" style="margin-bottom: 0.75rem;">
            Seul le texte du post est modifiable ici. Certains types de publications (ex. partages) peuvent restreindre l’édition côté Facebook.
        </p>
        <textarea id="fb-edit-textarea" rows="6" maxlength="5000" style="width:100%; padding:0.6rem; border:1px solid #ced4da; border-radius:6px;"></textarea>
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button type="button" class="btn btn-outline" id="fb-edit-cancel">Annuler</button>
            <button type="button" class="btn btn-primary" id="fb-edit-save">Enregistrer</button>
        </div>
    </div>
</div>

<script>
const API_BASE = '<?= $api_base_url ?>';
const JWT = '<?= $jwt_token ?>';

/** Dernier bloc pagination renvoyé par l’API pour chaque page Facebook */
const postsPagingByPage = {};

let editContext = { pageId: null, postId: null };

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function postTextPreview(p) {
    const msg = (p.message || '').trim();
    if (msg) return msg;
    const st = (p.story || '').trim();
    if (st) return st;
    return '(aucun texte — lien, photo ou type de post sans légende modifiable)';
}

function formatFbDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('fr-FR');
    } catch (e) {
        return iso;
    }
}

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

        const pages = data.pages.filter(p => p.pageId && (p.hasPageAccessToken !== false));
        if (pages.length === 0) {
            document.getElementById('noPagesMessage').style.display = 'block';
            document.getElementById('noPagesMessage').innerHTML =
                'Les Pages connectées ne semblent pas avoir de jeton actif (reconnexion peut être nécessaire). ' +
                '<a href="<?= htmlspecialchars(url('pages/modules/facebook.php') . '?tab=config') ?>">Connexion Facebook</a>';
            return;
        }

        const tabsContainer = document.querySelector('#pagesTabs > div');
        const contentContainer = document.getElementById('pagesContent');

        if (pages.length === 1) {
            document.getElementById('pagesTabs').style.display = 'none';
            contentContainer.innerHTML = '';
            createPageContent(pages[0], contentContainer, true);
        } else {
            document.getElementById('pagesTabs').style.display = 'block';
            tabsContainer.innerHTML = '';
            contentContainer.innerHTML = '';

            pages.forEach((page, index) => {
                const pageId = page.pageId;
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'page-tab' + (index === 0 ? ' active' : '');
                tab.dataset.pageId = pageId;
                tab.textContent = page.pageName || page.pageId;
                tab.addEventListener('click', () => {
                    document.querySelectorAll('#pagesTabs .page-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.querySelectorAll('.page-tab-content').forEach(c => { c.style.display = 'none'; });
                    const content = document.getElementById('page-content-' + pageId);
                    if (content) content.style.display = 'block';
                });
                tabsContainer.appendChild(tab);

                const contentDiv = document.createElement('div');
                contentDiv.id = 'page-content-' + pageId;
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

function createPageContent(page, container, isSinglePage) {
    const pageId = page.pageId;
    postsPagingByPage[pageId] = { nextAfter: null, prevBefore: null, hasNext: false, hasPrevious: false };

    container.innerHTML = `
        <section style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem;">${isSinglePage ? 'Nouveau post' : 'Nouveau post sur « ' + escapeHtml(page.pageName || page.pageId) + ' »'}</h3>
            <form class="publish-post-form" data-page-id="${escapeHtml(pageId)}">
                <div style="margin-bottom: 1rem;">
                    <label for="post-message-${escapeHtml(pageId)}" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                        Message
                    </label>
                    <textarea
                        id="post-message-${escapeHtml(pageId)}"
                        name="message"
                        rows="5"
                        maxlength="5000"
                        placeholder="Texte du post…"
                        style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-family: inherit; font-size: 1em; resize: vertical;"
                    ></textarea>
                    <div style="margin-top: 0.5rem; font-size: 0.85em; color: #666; text-align: right;">
                        <span id="char-count-${escapeHtml(pageId)}">0</span> / 5000
                    </div>
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="post-link-${escapeHtml(pageId)}" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                        Lien (optionnel)
                    </label>
                    <input type="url"
                        id="post-link-${escapeHtml(pageId)}"
                        name="link"
                        placeholder="https://…"
                        style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1em;"
                    >
                    <div style="margin-top: 0.35rem; font-size: 0.8em; color: #666;">
                        Aperçu du lien sur le fil (ignoré si vous publiez une image via URL ci-dessous).
                    </div>
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="post-image-url-${escapeHtml(pageId)}" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                        URL d’image (optionnel)
                    </label>
                    <input type="url"
                        id="post-image-url-${escapeHtml(pageId)}"
                        name="image_url"
                        placeholder="https://…/image.jpg"
                        style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1em;"
                    >
                    <div style="margin-top: 0.35rem; font-size: 0.8em; color: #666;">
                        Publication via l’API « photo » ; prioritaire sur le lien ci-dessus.
                    </div>
                </div>
                <p class="small text-muted" style="margin-bottom: 1rem;">
                    Au moins un des trois champs (message, lien ou image) est requis.
                </p>
                <button type="submit" class="btn btn-primary publish-post-btn" data-page-id="${escapeHtml(pageId)}">
                    Publier
                </button>
                <div class="publish-post-status" data-page-id="${escapeHtml(pageId)}" style="margin-top: 1rem;"></div>
            </form>
        </section>
        <section>
            <h3 style="margin-bottom: 0.75rem;">Posts publiés</h3>
            <p class="small text-muted" style="margin-bottom: 0.75rem;">
                Liste fournie par Facebook (<code>published_posts</code>), avec pagination par curseurs.
            </p>
            <div id="posts-list-wrap-${escapeHtml(pageId)}">
                <div class="text-muted" id="posts-list-loading-${escapeHtml(pageId)}">Chargement…</div>
                <div id="posts-list-err-${escapeHtml(pageId)}" class="alert alert-danger" style="display:none;"></div>
                <div id="posts-list-body-${escapeHtml(pageId)}"></div>
                <div id="posts-list-pager-${escapeHtml(pageId)}" style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;"></div>
            </div>
        </section>
    `;

    const textarea = container.querySelector('#post-message-' + pageId);
    const charCount = container.querySelector('#char-count-' + pageId);
    if (textarea && charCount) {
        textarea.addEventListener('input', () => {
            const count = textarea.value.length;
            charCount.textContent = count;
            charCount.style.color = count > 4500 ? '#dc3545' : (count > 4000 ? '#ffc107' : '#666');
        });
    }

    const form = container.querySelector('.publish-post-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await publishPost(pageId, form);
    });

    loadPostsList(pageId);
}

async function loadPostsList(pageId, opts) {
    const loading = document.getElementById('posts-list-loading-' + pageId);
    const errBox = document.getElementById('posts-list-err-' + pageId);
    const body = document.getElementById('posts-list-body-' + pageId);
    const pager = document.getElementById('posts-list-pager-' + pageId);
    if (!body || !pager) return;

    opts = opts || {};
    if (loading) loading.style.display = 'block';
    if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }

    try {
        const q = new URLSearchParams({ limit: '15' });
        if (opts.after) q.set('after', opts.after);
        else if (opts.before) q.set('before', opts.before);

        const url = `${API_BASE}/facebook/pages/${encodeURIComponent(pageId)}/posts?` + q.toString();
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${JWT}` } });
        const data = await res.json();

        if (loading) loading.style.display = 'none';

        if (!data.success) {
            if (errBox) {
                errBox.style.display = 'block';
                errBox.textContent = data.message || 'Impossible de charger les posts.';
            }
            body.innerHTML = '';
            pager.innerHTML = '';
            return;
        }

        postsPagingByPage[pageId] = data.paging || postsPagingByPage[pageId];

        const posts = data.posts || [];
        if (posts.length === 0) {
            body.innerHTML = '<p class="text-muted">Aucun post dans cette vue.</p>';
        } else {
            const rows = posts.map(p => {
                const prev = postTextPreview(p);
                const short = prev.length > 200 ? prev.slice(0, 200) + '…' : prev;
                const link = p.permalink_url
                    ? '<a href="' + escapeHtml(p.permalink_url) + '" target="_blank" rel="noopener">Voir</a>'
                    : '—';
                return '<tr data-post-id="' + escapeHtml(p.id) + '">' +
                    '<td>' + escapeHtml(formatFbDate(p.created_time)) + '</td>' +
                    '<td>' + escapeHtml(short) + '</td>' +
                    '<td>' + link + '</td>' +
                    '<td class="fb-posts-actions">' +
                    '<button type="button" class="btn btn-sm btn-outline-primary fb-btn-edit" data-post-id="' + escapeHtml(p.id) + '">Éditer</button>' +
                    '<button type="button" class="btn btn-sm btn-outline-danger fb-btn-del" data-post-id="' + escapeHtml(p.id) + '">Supprimer</button>' +
                    '</td></tr>';
            }).join('');

            body.innerHTML =
                '<table class="fb-posts-table">' +
                '<thead><tr><th>Date</th><th>Aperçu</th><th>Lien Facebook</th><th>Actions</th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table>';
        }

        body.querySelectorAll('.fb-btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-post-id');
                const row = posts.find(r => r.id === id);
                openEditModal(pageId, id, row ? (row.message || '') : '');
            });
        });
        body.querySelectorAll('.fb-btn-del').forEach(btn => {
            btn.addEventListener('click', () => deletePost(pageId, btn.getAttribute('data-post-id')));
        });

        const pg = data.paging || {};
        pager.innerHTML = '';
        if (pg.hasPrevious) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-outline-secondary btn-sm';
            b.textContent = '← Précédent';
            b.addEventListener('click', () => loadPostsList(pageId, { before: pg.prevBefore }));
            pager.appendChild(b);
        }
        if (pg.hasNext) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-outline-secondary btn-sm';
            b.textContent = 'Suivant →';
            b.addEventListener('click', () => loadPostsList(pageId, { after: pg.nextAfter }));
            pager.appendChild(b);
        }
    } catch (e) {
        console.error(e);
        if (loading) loading.style.display = 'none';
        if (errBox) {
            errBox.style.display = 'block';
            errBox.textContent = e.message || 'Erreur réseau';
        }
    }
}

async function publishPost(pageId, form) {
    const textarea = form.querySelector('#post-message-' + pageId);
    const imageUrlInput = form.querySelector('#post-image-url-' + pageId);
    const linkInput = form.querySelector('#post-link-' + pageId);
    const message = textarea ? textarea.value.trim() : '';
    const imageUrl = imageUrlInput ? imageUrlInput.value.trim() : '';
    const link = linkInput ? linkInput.value.trim() : '';

    if (!message && !imageUrl && !link) {
        alert('Indiquez au moins un message, un lien ou une URL d’image.');
        return;
    }

    const btn = form.querySelector('.publish-post-btn');
    const statusDiv = form.querySelector('.publish-post-status');

    btn.disabled = true;
    const prevTxt = btn.textContent;
    btn.textContent = 'Publication…';
    statusDiv.innerHTML = '';

    try {
        const body = {};
        if (message) body.message = message;
        if (link) body.link = link;
        if (imageUrl) body.image_url = imageUrl;
        const res = await fetch(`${API_BASE}/facebook/pages/${encodeURIComponent(pageId)}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT}`
            },
            body: JSON.stringify(body)
        });
        let data = {};
        try {
            data = await res.json();
        } catch (x) {
            throw new Error('Réponse invalide du serveur');
        }
        if (data.success) {
            statusDiv.innerHTML = '<div class="alert alert-success">✓ ' + escapeHtml(data.message || 'Post publié') + '</div>';
            if (textarea) textarea.value = '';
            if (imageUrlInput) imageUrlInput.value = '';
            if (linkInput) linkInput.value = '';
            const charCount = form.querySelector('#char-count-' + pageId);
            if (charCount) charCount.textContent = '0';
            loadPostsList(pageId);
        } else {
            statusDiv.innerHTML = '<div class="alert alert-danger">✗ ' + escapeHtml(data.message || 'Erreur') + '</div>';
        }
    } catch (e) {
        statusDiv.innerHTML = '<div class="alert alert-danger">✗ ' + escapeHtml(e.message) + '</div>';
    } finally {
        btn.disabled = false;
        btn.textContent = prevTxt;
    }
}

function openEditModal(pageId, postId, initialMessage) {
    editContext = { pageId, postId };
    const ov = document.getElementById('fb-edit-overlay');
    const ta = document.getElementById('fb-edit-textarea');
    ta.value = initialMessage || '';
    ov.classList.add('open');
    ta.focus();
}

function closeEditModal() {
    document.getElementById('fb-edit-overlay').classList.remove('open');
    editContext = { pageId: null, postId: null };
}

document.getElementById('fb-edit-cancel').addEventListener('click', closeEditModal);
document.getElementById('fb-edit-overlay').addEventListener('click', (ev) => {
    if (ev.target.id === 'fb-edit-overlay') closeEditModal();
});

document.getElementById('fb-edit-save').addEventListener('click', async () => {
    const { pageId, postId } = editContext;
    if (!pageId || !postId) return;
    const message = document.getElementById('fb-edit-textarea').value.trim();
    if (!message) {
        alert('Le message ne peut pas être vide.');
        return;
    }
    const btn = document.getElementById('fb-edit-save');
    btn.disabled = true;
    try {
        const res = await fetch(`${API_BASE}/facebook/pages/${encodeURIComponent(pageId)}/posts/${encodeURIComponent(postId)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT}`
            },
            body: JSON.stringify({ message })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Mise à jour refusée');
        closeEditModal();
        loadPostsList(pageId);
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
    }
});

async function deletePost(pageId, postId) {
    if (!confirm('Supprimer définitivement ce post sur Facebook ?')) return;
    try {
        const res = await fetch(`${API_BASE}/facebook/pages/${encodeURIComponent(pageId)}/posts/${encodeURIComponent(postId)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Suppression refusée');
        loadPostsList(pageId);
    } catch (e) {
        alert(e.message);
    }
}

loadPages();
</script>

<?php require_once '../../includes/footer.php'; ?>
