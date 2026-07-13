/**
 * Tests dataset intentions — module Facebook
 * Fichier : frontend/assets/js/facebook/dataset-tests.js
 */
(function () {
    const cfg = window.FB_DATASET_TESTS_CONFIG || {};
    const API_BASE_URL = cfg.apiBaseUrl || '';
    const JWT_TOKEN = cfg.jwtToken || '';

    let datasetTestResults = [];
    let datasetTestStats = null;
    let datasetTestRunning = false;

    async function fetchDatasetTestJson(url, options = {}, retries = 3) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            const response = await fetch(url, options);
            const contentType = response.headers.get('content-type') || '';

            if (response.status === 429 && attempt < retries) {
                const waitSec = parseInt(response.headers.get('retry-after') || '60', 10);
                await new Promise((resolve) => setTimeout(resolve, Math.min(waitSec, 60) * 1000));
                continue;
            }

            const raw = await response.text();
            if (!contentType.includes('application/json')) {
                const preview = raw.trim().slice(0, 200);
                throw new Error(`Réponse non-JSON (${response.status}) : ${preview || 'réponse vide'}`);
            }

            let data;
            try {
                data = JSON.parse(raw);
            } catch (e) {
                throw new Error('Réponse JSON invalide : ' + raw.trim().slice(0, 200));
            }

            if (!response.ok && !data.success) {
                throw new Error(data.message || `Erreur HTTP ${response.status}`);
            }

            return data;
        }

        throw new Error('Trop de requêtes. Réessayez dans une minute.');
    }

    function updateDatasetTestProgress(processed, total) {
        const wrap = document.getElementById('datasetTestProgressWrap');
        const bar = document.getElementById('datasetTestProgressBar');
        const text = document.getElementById('datasetTestProgressText');
        if (!wrap || !bar || !text) return;

        wrap.style.display = 'block';
        const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
        bar.style.width = pct + '%';
        text.textContent = `${processed} / ${total} emails analysés (${pct}%)`;
    }

    function setDatasetTestButtonsDisabled(disabled, runningLabel) {
        const btn10 = document.getElementById('testDataset10Btn');
        const btn10Random = document.getElementById('testDataset10RandomBtn');
        const btnAll = document.getElementById('testDatasetBtn');
        if (btn10) {
            btn10.disabled = disabled;
            if (!disabled) btn10.textContent = '🧪 Tester 10 emails';
            else if (runningLabel) btn10.textContent = runningLabel;
        }
        if (btn10Random) {
            btn10Random.disabled = disabled;
            if (!disabled) btn10Random.textContent = '🎲 Tester 10 aléatoires';
            else if (runningLabel) btn10Random.textContent = runningLabel;
        }
        if (btnAll) {
            btnAll.disabled = disabled;
            if (!disabled) btnAll.textContent = '📧 Tester 1000 emails';
            else if (runningLabel) btnAll.textContent = runningLabel;
        }
    }

    function computeDatasetAccuracyStats(results) {
        const evaluated = results.filter((item) => item.correct !== null && item.correct !== undefined);
        const correct = evaluated.filter((item) => item.correct === true);
        const incorrect = evaluated.filter((item) => item.correct === false);
        const withoutExpected = results.length - evaluated.length;
        const accuracyPct = evaluated.length > 0
            ? Math.round((correct.length / evaluated.length) * 1000) / 10
            : null;

        return {
            total: results.length,
            evaluated: evaluated.length,
            correct: correct.length,
            incorrect: incorrect.length,
            withoutExpected,
            accuracyPct
        };
    }

    function formatDatasetAccuracyMessage(stats) {
        if (!stats || stats.evaluated === 0) {
            return 'Aucune intention attendue disponible pour calculer le taux de réussite.';
        }
        return `Taux de bonnes réponses : ${stats.accuracyPct}% (${stats.correct}/${stats.evaluated})`;
    }

    function updateDatasetTestStats(stats) {
        const wrap = document.getElementById('datasetTestStatsWrap');
        const text = document.getElementById('datasetTestStatsText');
        if (!wrap || !text) return;

        if (!stats || stats.evaluated === 0) {
            wrap.style.display = 'none';
            text.textContent = '';
            return;
        }

        wrap.style.display = 'block';
        text.textContent = formatDatasetAccuracyMessage(stats);
        if (stats.incorrect > 0) {
            text.classList.add('dataset-test-stats-warning');
        } else {
            text.classList.remove('dataset-test-stats-warning');
        }
    }

    function escapeDatasetHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDetectedIntentionsLabel(result) {
        if (result.error) {
            return `Erreur : ${result.error}`;
        }
        if (!Array.isArray(result.intentions) || result.intentions.length === 0) {
            return result.intention_principale || 'Aucune intention détectée';
        }
        return result.intentions
            .map((item) => {
                const name = item.categorie || item.category || 'inconnue';
                const certitude = item.certitude ?? item.certainty;
                return certitude != null ? `${name} (${certitude}%)` : name;
            })
            .join(', ');
    }

    function updateDatasetTestFailures(results) {
        const wrap = document.getElementById('datasetTestFailuresWrap');
        const title = document.getElementById('datasetTestFailuresTitle');
        const list = document.getElementById('datasetTestFailuresList');
        if (!wrap || !title || !list) return;

        const failures = (results || []).filter((item) => item.correct === false);
        if (!failures.length) {
            wrap.style.display = 'none';
            title.textContent = '';
            list.innerHTML = '';
            return;
        }

        wrap.style.display = 'block';
        title.textContent = `Emails ratés (${failures.length})`;

        list.innerHTML = failures.map((item) => {
            const subject = item.subject || '(sans sujet)';
            const message = item.message || '';
            const attendu = item.intention_attendue || '—';
            const detecte = formatDetectedIntentionsLabel(item);
            const multiTag = item.multi_intention ? '<span class="dataset-test-failure-tag">multi-intention</span>' : '';

            return `
            <article class="dataset-test-failure-item">
                <div class="dataset-test-failure-header">
                    <strong>#${escapeDatasetHtml(item.id)} — ${escapeDatasetHtml(subject)}</strong>
                    ${multiTag}
                </div>
                <div class="dataset-test-failure-meta">
                    <span><strong>Attendu :</strong> ${escapeDatasetHtml(attendu)}</span>
                    <span><strong>Détecté :</strong> ${escapeDatasetHtml(detecte)}</span>
                </div>
                <details class="dataset-test-failure-details">
                    <summary>Voir le message complet</summary>
                    <pre class="dataset-test-failure-message">${escapeDatasetHtml(message)}</pre>
                </details>
            </article>
        `;
        }).join('');
    }

    function downloadDatasetResultsJson() {
        if (!datasetTestResults.length) {
            alert('Aucun résultat à télécharger.');
            return;
        }

        const stats = datasetTestStats || computeDatasetAccuracyStats(datasetTestResults);
        const payload = {
            generatedAt: new Date().toISOString(),
            total: datasetTestResults.length,
            stats,
            results: datasetTestResults
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = url;
        link.download = `facebook-dataset-${datasetTestResults.length}-emails-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function getSelectedPageId() {
        const sel = document.getElementById('facebookPageSelect');
        return sel && sel.value ? sel.value : '';
    }

    async function loadFacebookPagesForSelect() {
        const sel = document.getElementById('facebookPageSelect');
        if (!sel) return;
        while (sel.options.length > 1) sel.remove(1);
        try {
            const res = await fetch(`${API_BASE_URL}/facebook/pages/summary`, {
                headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.success && data.pages && data.pages.length > 0) {
                data.pages.forEach((p) => {
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

    async function runDatasetTest(maxEmails = 1000, { random = false } = {}) {
        if (datasetTestRunning) return;

        const isQuickTest = maxEmails <= 10;
        let confirmMessage;
        if (random) {
            confirmMessage = 'Lancer l\'analyse de 10 emails tirés au hasard parmi les 1000 ?\n\nAucun mail ne sera envoyé.';
        } else if (isQuickTest) {
            confirmMessage = 'Lancer l\'analyse des 10 premiers emails de test ?\n\nAucun mail ne sera envoyé.';
        } else {
            confirmMessage = 'Lancer l\'analyse de 1000 emails ?\n\nAucun mail ne sera envoyé. L\'opération peut prendre du temps.';
        }

        if (!confirm(confirmMessage)) return;

        const downloadBtn = document.getElementById('downloadDatasetResultsBtn');
        const pageId = getSelectedPageId() || null;

        datasetTestRunning = true;
        datasetTestResults = [];
        datasetTestStats = null;
        setDatasetTestButtonsDisabled(true, '⏳ Analyse en cours...');
        if (downloadBtn) downloadBtn.style.display = 'none';
        updateDatasetTestStats(null);
        updateDatasetTestFailures(null);

        let datasetTotal = maxEmails;
        let offset = 0;
        const batchSize = isQuickTest ? 5 : 10;
        const excludeIds = [];

        try {
            const infoData = await fetchDatasetTestJson(`${API_BASE_URL}/facebook/test-dataset`, {
                headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
            });
            if (infoData.success && infoData.data && infoData.data.total) {
                datasetTotal = isQuickTest
                    ? Math.min(maxEmails, infoData.data.total)
                    : infoData.data.total;
            }
        } catch (e) {
            console.warn('Impossible de charger les infos dataset:', e);
        }

        const total = datasetTotal;
        updateDatasetTestProgress(0, total);

        try {
            while (datasetTestResults.length < total) {
                const remaining = total - datasetTestResults.length;
                const currentLimit = random
                    ? Math.min(batchSize, remaining)
                    : batchSize;

                const requestBody = random
                    ? { random: true, limit: currentLimit, excludeIds, pageId }
                    : { offset, limit: currentLimit, pageId };

                const data = await fetchDatasetTestJson(`${API_BASE_URL}/facebook/test-dataset`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${JWT_TOKEN}`
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!data.success) {
                    throw new Error(data.message || 'Erreur lors de l\'analyse du dataset');
                }

                if (Array.isArray(data.results)) {
                    datasetTestResults.push(...data.results);
                    if (random) {
                        data.results.forEach((item) => {
                            if (item.id != null) excludeIds.push(item.id);
                        });
                    }
                    updateDatasetTestFailures(datasetTestResults);
                }

                if (random) {
                    updateDatasetTestProgress(datasetTestResults.length, total);
                    if ((data.processed || 0) === 0 || datasetTestResults.length >= total) break;
                } else {
                    offset += data.processed || batchSize;
                    updateDatasetTestProgress(Math.min(offset, total), total);
                    if (data.done || (data.processed || 0) === 0 || offset >= total) break;
                }
            }

            updateDatasetTestProgress(total, total);
            if (downloadBtn) downloadBtn.style.display = 'inline-block';
            datasetTestStats = computeDatasetAccuracyStats(datasetTestResults);
            updateDatasetTestStats(datasetTestStats);
            updateDatasetTestFailures(datasetTestResults);

            const accuracyLine = datasetTestStats.evaluated > 0
                ? `\n${formatDatasetAccuracyMessage(datasetTestStats)}`
                : '';
            alert(`✅ Analyse terminée : ${datasetTestResults.length} email(s) traité(s).${accuracyLine}\nVous pouvez télécharger le JSON des résultats.`);
        } catch (error) {
            console.error('Erreur test dataset:', error);
            alert('❌ Erreur pendant le test dataset : ' + error.message);
            if (datasetTestResults.length && downloadBtn) {
                downloadBtn.style.display = 'inline-block';
            }
        } finally {
            datasetTestRunning = false;
            setDatasetTestButtonsDisabled(false);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadFacebookPagesForSelect();

        const testDataset10Btn = document.getElementById('testDataset10Btn');
        if (testDataset10Btn) testDataset10Btn.addEventListener('click', () => runDatasetTest(10));

        const testDataset10RandomBtn = document.getElementById('testDataset10RandomBtn');
        if (testDataset10RandomBtn) testDataset10RandomBtn.addEventListener('click', () => runDatasetTest(10, { random: true }));

        const testDatasetBtn = document.getElementById('testDatasetBtn');
        if (testDatasetBtn) testDatasetBtn.addEventListener('click', () => runDatasetTest(1000));

        const downloadDatasetResultsBtn = document.getElementById('downloadDatasetResultsBtn');
        if (downloadDatasetResultsBtn) downloadDatasetResultsBtn.addEventListener('click', downloadDatasetResultsJson);

        const testConnectionBtn = document.getElementById('testConnectionBtn');
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/facebook/agent/test`, {
                        headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        alert('✅ Connexion IA réussie !\n\n' + JSON.stringify(data.data || data, null, 2));
                    } else {
                        alert('❌ Erreur de connexion:\n\n' + (data.message || 'Erreur inconnue'));
                    }
                } catch (error) {
                    console.error('Erreur:', error);
                    alert('❌ Erreur lors du test de connexion');
                }
            });
        }
    });
})();
