<?php
/**
 * Point d'entree UGAP backoffice
 * - 2 onglets : Configurateur / Parametrage
 * - Sans administration globale pour le moment
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'UGAP';
$canManageUgap = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
$ugapTopTabs = ['configurateur', 'parametrage'];
if ($canManageUgap) {
    $ugapTopTabs[] = 'prompts-ia';
}
$activeTab = $_GET['tab'] ?? 'configurateur';
if (!in_array($activeTab, $ugapTopTabs, true)) {
    $activeTab = 'configurateur';
}
if (($activeTab === 'parametrage' || $activeTab === 'prompts-ia') && !$canManageUgap) {
    $activeTab = 'configurateur';
}

require_once '../../includes/header.php';
?>

<section class="section">
    <div class="container">
        <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:14px;">
            <h2 style="margin:0;">Module UGAP</h2>
            <a class="btn btn-secondary" href="<?= url('pages/modules.php') ?>">Retour modules</a>
        </div>

        <div class="ugap-tabs">
            <a href="<?= url('pages/modules/ugap.php?tab=configurateur') ?>" class="ugap-tab <?= $activeTab === 'configurateur' ? 'is-active' : '' ?>">
                Configurateur
            </a>
            <a href="<?= url('pages/modules/ugap.php?tab=parametrage') ?>" class="ugap-tab <?= $activeTab === 'parametrage' ? 'is-active' : '' ?>">
                Parametrage
            </a>
            <?php if ($canManageUgap): ?>
            <a href="<?= url('pages/modules/ugap.php?tab=prompts-ia') ?>" class="ugap-tab <?= $activeTab === 'prompts-ia' ? 'is-active' : '' ?>">
                Prompts IA
            </a>
            <?php endif; ?>
        </div>

        <?php
        $viewByTab = [
            'configurateur' => __DIR__ . '/ugap-tab-configurateur.php',
            'parametrage' => __DIR__ . '/ugap-tab-parametrage.php',
            'prompts-ia' => __DIR__ . '/ugap-tab-prompts-ia.php',
        ];

        $selectedView = $viewByTab[$activeTab] ?? $viewByTab['configurateur'];
        require $selectedView;
        ?>
    </div>
</section>

<style>
.ugap-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.ugap-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #d6dbe6;
    text-decoration: none;
    color: var(--color-dark);
    background: #fff;
    font-weight: 600;
}

.ugap-tab:hover {
    border-color: var(--color-primary);
}

.ugap-tab.is-active {
    color: #fff;
    background: var(--color-primary);
    border-color: var(--color-primary);
}

.ugap-panel {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: visible;
    padding: 0;
}

.ugap-embed-frame {
    width: 100%;
    border: 0;
    display: block;
    min-height: 480px;
    resize: none;
    overflow: visible;
}

.ugap-panel--placeholder {
    padding: 20px;
}

.ugap-panel--placeholder h3 {
    margin-top: 0;
}

/* Iframe + colonne rappel (sticky au scroll de la page, dans le flux). */
.ugap-import-embed-layout {
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 14px;
    width: 100%;
    max-width: 100%;
    overflow: visible;
    position: relative;
    box-sizing: border-box;
}

.ugap-import-embed-layout > .ugap-panel {
    position: relative;
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
}

#ugap-import-mino-recap-dock-host.ugap-mino-recap-dock {
    --ugap-recap-sticky-top: calc(var(--header-height, 120px) + 20px);
    --ugap-recap-dock-width: 280px;
    position: sticky;
    top: var(--ugap-recap-sticky-top);
    align-self: flex-start;
    flex: 0 0 var(--ugap-recap-dock-width);
    width: var(--ugap-recap-dock-width);
    max-width: min(var(--ugap-recap-dock-width), calc(100vw - 24px));
    z-index: 5;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #dbe3ea;
    border-radius: 10px;
    background: #f8fafc;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
    font-size: 13px;
    box-sizing: border-box;
    max-height: calc(100vh - var(--header-height, 120px) - 28px);
}

#ugap-import-mino-recap-dock-host[hidden] {
    display: none !important;
}

#ugap-import-mino-recap-dock-host .ugap-mino-recap-head {
    flex: 0 0 auto;
    position: sticky;
    top: 0;
    z-index: 3;
    padding: 14px 14px 10px;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
}

#ugap-import-mino-recap-dock-host .ugap-mino-recap-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 10px 14px 14px;
    -webkit-overflow-scrolling: touch;
}

#ugap-import-mino-recap-dock-host .ugap-mino-recap-poste-title {
    display: block;
    margin: 0 0 6px;
    padding: 0 0 4px;
    font-size: 13px;
}

section.section:has(#ugap-import-embed-root),
section.section:has(#ugap-import-embed-root) .container {
    overflow: visible;
}

@media (max-width: 1100px) {
    .ugap-import-embed-layout {
        flex-wrap: wrap;
    }
    #ugap-import-mino-recap-dock-host.ugap-mino-recap-dock {
        flex: 1 1 100%;
        width: 100%;
        max-width: 100%;
        position: static;
        max-height: none;
    }
}

</style>

<script>
(function () {
    var __ugapEmbedFrameLastHeight = 0;

    function measureEmbedFrameContentHeight(frame) {
        try {
            var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (!doc) return 0;
            var win = frame.contentWindow;
            var scrollY = win ? (win.scrollY || win.pageYOffset || 0) : 0;
            var docEl = doc.documentElement;
            var body = doc.body;
            var bottoms = [];
            var addBottom = function (el) {
                if (!el || typeof el.getBoundingClientRect !== 'function') return;
                var st = win.getComputedStyle(el);
                if (st.display === 'none' || st.visibility === 'hidden') return;
                var r = el.getBoundingClientRect();
                if (r.height <= 0 && r.width <= 0) return;
                bottoms.push(r.bottom + scrollY);
            };
            var docH = Math.max(
                docEl ? docEl.scrollHeight : 0,
                docEl ? docEl.offsetHeight : 0,
                body ? body.scrollHeight : 0,
                body ? body.offsetHeight : 0
            );
            var activePanel = doc.querySelector('.tab-panel.active');
            var panelH = activePanel
                ? Math.max(activePanel.scrollHeight, activePanel.offsetHeight || 0, 0)
                : 0;
            var card = doc.getElementById('legacy-backoffice-card');
            var cardH = card ? Math.max(card.scrollHeight, card.offsetHeight || 0, 0) : 0;
            var root = doc.querySelector('.container-xl') || body;
            var rootH = root ? Math.max(root.scrollHeight, root.offsetHeight || 0, 0) : 0;
            [
                docEl,
                body,
                activePanel,
                doc.getElementById('tab-import'),
                doc.getElementById('import-editor-section'),
                doc.getElementById('import-workflow-section'),
                doc.getElementById('import-workflow-content-families'),
                doc.querySelector('.ugap-import-mino-wrap'),
                doc.querySelector('.ugap-import-opt-tri-table-wrap'),
                doc.querySelector('.ugap-import-opt-tri-table tbody tr:last-child')
            ].forEach(addBottom);
            return Math.max(docH, panelH, cardH, rootH, bottoms.length ? Math.max.apply(null, bottoms) : 0, 200) + 32;
        } catch (e) {
            return 0;
        }
    }

    function applyEmbedFrameHeight(height) {
        var frame = document.getElementById('ugap-embed-frame');
        if (!frame) return;
        var reported = parseInt(height, 10) || 0;
        var measured = measureEmbedFrameContentHeight(frame);
        var h = Math.max(reported, measured, 200) + 48;
        h = Math.min(h, 20000);
        if (Math.abs(h - __ugapEmbedFrameLastHeight) < 6) {
            return;
        }
        __ugapEmbedFrameLastHeight = h;
        frame.style.height = h + 'px';
        frame.style.maxHeight = 'none';
        frame.style.minHeight = h + 'px';
    }

    function resetUgapMinoRecapDockStyles() {
        var host = document.getElementById('ugap-import-mino-recap-dock-host');
        if (!host) return;
        host.style.visibility = '';
        host.style.top = '';
        host.style.left = '';
        host.style.right = '';
    }

    function getRecapStickyTopPx() {
        var raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
        var header = parseInt(raw, 10);
        if (!Number.isFinite(header)) header = 120;
        return header + 20;
    }

    function escapeUgapDockText(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function isUgapEmbedFrameMessage(event) {
        var frame = document.getElementById('ugap-embed-frame');
        if (!frame || !frame.contentWindow) return false;
        return event.source === frame.contentWindow;
    }

    window.addEventListener('message', function (event) {
        if (event.origin !== window.location.origin) return;
        var data = event.data;
        if (!data || !data.type) return;
        if (data.type === 'ugap-embed-resize') {
            if (!isUgapEmbedFrameMessage(event)) return;
            applyEmbedFrameHeight(data.height);
            return;
        }
        if (data.type === 'ugap-embed-scroll') {
            if (!isUgapEmbedFrameMessage(event)) return;
            return;
        }
        if (data.type === 'ugap-import-mino-recap') {
            if (!isUgapEmbedFrameMessage(event)) return;
            var recapHost = document.getElementById('ugap-import-mino-recap-dock-host');
            if (!recapHost) return;
            if (!data.visible) {
                recapHost.hidden = true;
                recapHost.innerHTML = '';
                resetUgapMinoRecapDockStyles();
                return;
            }
            recapHost.hidden = false;
            recapHost.innerHTML = data.html || '';
            resetUgapMinoRecapDockStyles();
            return;
        }
        if (data.type === 'ugap-embed-scroll-to') {
            var frame = document.getElementById('ugap-embed-frame');
            if (!frame) return;
            var fr = frame.getBoundingClientRect();
            var offsetY = parseInt(data.offsetY, 10) || 0;
            var top = fr.top + window.pageYOffset + offsetY - 80;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
    });

    var frame = document.getElementById('ugap-embed-frame');
    function refreshEmbedFrameHeight() {
        var frame = document.getElementById('ugap-embed-frame');
        if (!frame) return;
        var h = measureEmbedFrameContentHeight(frame);
        if (h > 0) applyEmbedFrameHeight(h);
    }

    if (frame) {
        frame.addEventListener('load', function () {
            refreshEmbedFrameHeight();
            setTimeout(refreshEmbedFrameHeight, 300);
            setTimeout(refreshEmbedFrameHeight, 1200);
        });
    }

    window.addEventListener('resize', function () {
        refreshEmbedFrameHeight();
    }, { passive: true });
})();
</script>

<?php require_once '../../includes/footer.php'; ?>
