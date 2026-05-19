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

/* Zone iframe seule : le rappel mino est en position fixed (hors flux, ne réduit pas le tableau). */
.ugap-import-embed-layout {
    width: 100%;
    position: relative;
    box-sizing: border-box;
}

.ugap-import-embed-layout > .ugap-panel {
    width: 100%;
    min-width: 0;
}

#ugap-import-mino-recap-dock-host {
    --ugap-recap-sticky-top: calc(var(--header-height, 120px) + 20px);
    --ugap-recap-dock-width: 280px;
    position: fixed;
    top: var(--ugap-recap-sticky-top);
    left: auto;
    width: var(--ugap-recap-dock-width);
    max-width: min(var(--ugap-recap-dock-width), calc(100vw - 24px));
    z-index: 250;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #dbe3ea;
    border-radius: 10px;
    background: #f8fafc;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.14);
    font-size: 13px;
    box-sizing: border-box;
    max-height: calc(100vh - var(--header-height, 120px) - 28px);
    pointer-events: auto;
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
    position: sticky;
    top: 0;
    z-index: 2;
    display: block;
    margin: 0 0 6px;
    padding: 10px 0 6px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 4px 6px -2px rgba(248, 250, 252, 1);
}

</style>

<script>
(function () {
    var __ugapEmbedFrameLastHeight = 0;
    var __ugapMinoRecapDockPosScheduled = false;
    var __ugapMinoRecapDockIntersectionObs = null;
    var __ugapMinoRecapDockResizeObs = null;

    function measureEmbedFrameContentHeight(frame) {
        try {
            var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (!doc) return 0;
            var docEl = doc.documentElement;
            var body = doc.body;
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
            return Math.max(docH, panelH, cardH, rootH, 200);
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
            scheduleUgapMinoRecapDockPosition();
            return;
        }
        __ugapEmbedFrameLastHeight = h;
        frame.style.height = h + 'px';
        frame.style.maxHeight = 'none';
        frame.style.minHeight = h + 'px';
        scheduleUgapMinoRecapDockPosition();
    }

    function getUgapMinoRecapAnchor() {
        return document.querySelector('#ugap-import-embed-root .ugap-panel')
            || document.getElementById('ugap-import-embed-root');
    }

    function scheduleUgapMinoRecapDockPosition() {
        if (__ugapMinoRecapDockPosScheduled) return;
        __ugapMinoRecapDockPosScheduled = true;
        requestAnimationFrame(function () {
            __ugapMinoRecapDockPosScheduled = false;
            positionUgapMinoRecapDock();
        });
    }

    function stopUgapMinoRecapDockObservers() {
        if (__ugapMinoRecapDockIntersectionObs) {
            __ugapMinoRecapDockIntersectionObs.disconnect();
            __ugapMinoRecapDockIntersectionObs = null;
        }
        if (__ugapMinoRecapDockResizeObs) {
            __ugapMinoRecapDockResizeObs.disconnect();
            __ugapMinoRecapDockResizeObs = null;
        }
    }

    function startUgapMinoRecapDockObservers() {
        stopUgapMinoRecapDockObservers();
        var host = document.getElementById('ugap-import-mino-recap-dock-host');
        var anchor = getUgapMinoRecapAnchor();
        if (!host || host.hidden || !anchor) return;

        if (typeof IntersectionObserver !== 'undefined') {
            __ugapMinoRecapDockIntersectionObs = new IntersectionObserver(function () {
                scheduleUgapMinoRecapDockPosition();
            }, { root: null, threshold: [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1] });
            __ugapMinoRecapDockIntersectionObs.observe(anchor);
        }

        if (typeof ResizeObserver !== 'undefined') {
            __ugapMinoRecapDockResizeObs = new ResizeObserver(function () {
                scheduleUgapMinoRecapDockPosition();
            });
            __ugapMinoRecapDockResizeObs.observe(anchor);
            __ugapMinoRecapDockResizeObs.observe(host);
        }
    }

    function getRecapStickyTopPx() {
        var raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
        var header = parseInt(raw, 10);
        if (!Number.isFinite(header)) header = 120;
        return header + 20;
    }

    /** Panneau rappel à droite du cadre blanc (fixed, hors flux) avec comportement sticky vertical. */
    function positionUgapMinoRecapDock() {
        var host = document.getElementById('ugap-import-mino-recap-dock-host');
        if (!host || host.hidden) return;
        var anchor = getUgapMinoRecapAnchor();
        if (!anchor) return;

        var rect = anchor.getBoundingClientRect();
        var stickyTop = getRecapStickyTopPx();
        var dockW = host.offsetWidth || 280;
        var dockH = host.offsetHeight || 0;
        var gap = 14;
        var viewportH = window.innerHeight || document.documentElement.clientHeight || 0;

        if (rect.bottom < stickyTop || rect.top > viewportH) {
            host.style.visibility = 'hidden';
            return;
        }

        var left = rect.right + gap;
        var minLeft = 12;
        var maxLeft = window.innerWidth - dockW - 12;
        if (left > maxLeft) left = maxLeft;
        if (left < minLeft) left = minLeft;

        var top = Math.max(stickyTop, rect.top);
        if (dockH > 0) {
            var maxTop = rect.bottom - dockH;
            if (maxTop < top) top = Math.max(stickyTop, maxTop);
        }

        host.style.visibility = 'visible';
        host.style.top = top + 'px';
        host.style.left = left + 'px';
        host.style.right = 'auto';
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
            scheduleUgapMinoRecapDockPosition();
            return;
        }
        if (data.type === 'ugap-import-mino-recap') {
            if (!isUgapEmbedFrameMessage(event)) return;
            var recapHost = document.getElementById('ugap-import-mino-recap-dock-host');
            if (!recapHost) return;
            if (!data.visible) {
                recapHost.hidden = true;
                recapHost.innerHTML = '';
                recapHost.style.left = '';
                recapHost.style.right = '';
                recapHost.style.top = '';
                recapHost.style.visibility = '';
                stopUgapMinoRecapDockObservers();
                return;
            }
            recapHost.hidden = false;
            recapHost.style.visibility = 'visible';
            recapHost.innerHTML = data.html || '';
            requestAnimationFrame(function () {
                positionUgapMinoRecapDock();
                requestAnimationFrame(function () {
                    positionUgapMinoRecapDock();
                    startUgapMinoRecapDockObservers();
                });
            });
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
        scheduleUgapMinoRecapDockPosition();
    }, { passive: true });

    window.addEventListener('scroll', scheduleUgapMinoRecapDockPosition, { passive: true, capture: true });
    document.addEventListener('scroll', scheduleUgapMinoRecapDockPosition, { passive: true, capture: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('scroll', scheduleUgapMinoRecapDockPosition, { passive: true });
        window.visualViewport.addEventListener('resize', scheduleUgapMinoRecapDockPosition, { passive: true });
    }
})();
</script>

<?php require_once '../../includes/footer.php'; ?>
