<?php
require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

if (!isLoggedIn()) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Import bancaire Oxygene';
require_once '../../includes/header.php';

$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
?>

<div class="container bank-page-wide" style="margin: 2rem auto; padding: 0 1rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
        <h1 style="margin:0;">Import releve bancaire vers Oxygene</h1>
        <a href="<?= url('pages/modules.php') ?>" class="btn btn-outline">← Modules</a>
    </div>

    <div class="alert alert-info" style="margin-bottom:1rem;">
        Workflow: 1) Upload PDF 2) Verification/edition du tableau 3) Export CSV Oxygene.
    </div>

    <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
        <input id="pdf-file" type="file" accept="application/pdf" class="form-control" style="max-width:420px;">
        <button id="btn-extract" class="btn btn-primary">Extraire operations</button>
        <button id="btn-add-row" class="btn btn-outline">Ajouter une ligne</button>
        <button id="btn-export" class="btn btn-success" disabled>Exporter CSV Oxygene</button>
    </div>

    <div id="status-box" class="alert alert-secondary">En attente d'un fichier PDF.</div>

    <div class="bank-layout">
        <div class="pdf-pane">
            <h3>PDF source</h3>
            <iframe id="pdf-viewer" title="Apercu PDF"></iframe>
        </div>
        <div class="table-pane">
            <h3>Operations detectees (editable)</h3>
            <div style="overflow:auto; max-height: 72vh; border:1px solid #ddd;">
                <table class="table table-sm table-striped" id="ops-table">
                    <colgroup>
                        <col style="width: 90px;">
                        <col style="width: 90px;">
                        <col style="width: auto;">
                        <col style="width: 90px;">
                        <col style="width: 90px;">
                        <col style="width: 38px;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th class="col-date">Date operation</th>
                            <th class="col-date">Date valeur</th>
                            <th>Libelle operation</th>
                            <th class="col-amount">Montant debit</th>
                            <th class="col-amount">Montant credit</th>
                            <th class="col-action"></th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<style>
.bank-page-wide {
    max-width: 1700px;
    margin-left: calc(50% - 850px);
    margin-right: auto;
}
.bank-layout { display:grid; grid-template-columns: 1.15fr 1.85fr; gap:1rem; }
.pdf-pane, .table-pane { background:#fff; border:1px solid #ddd; border-radius:8px; padding:0.8rem; }
#pdf-viewer { width:100%; height:70vh; border:1px solid #ddd; border-radius:4px; }
#ops-table { table-layout: fixed; width: 100%; }
#ops-table .col-date { min-width: 90px; width: 90px; }
#ops-table .col-amount { min-width: 90px; width: 90px; }
#ops-table .col-action { width: 38px; min-width: 38px; }
#ops-table input { min-width: 0; width: 100%; }
#ops-table .libelle-input { min-width: 0; width: 100%; }
#ops-table .btn-delete-row {
    padding: 0 0.35rem;
    height: 24px;
    line-height: 1;
    font-size: 16px;
    color: #c1121f;
    border-color: #e7a1a7;
}
#ops-table .btn-delete-row:hover {
    color: #fff;
    background: #c1121f;
    border-color: #c1121f;
}
@media (max-width: 1720px) {
    .bank-page-wide {
        max-width: none;
        margin-left: -3rem;
        margin-right: -3rem;
    }
}
@media (max-width: 1080px) {
    .bank-page-wide {
        margin-left: auto;
        margin-right: auto;
    }
    .bank-layout { grid-template-columns: 1fr; }
    #pdf-viewer { height:45vh; }
}
</style>

<script>
(function () {
    var API_BASE = <?= json_encode($api_base_url) ?>;
    var JWT = <?= json_encode($jwt_token) ?>;

    var fileInput = document.getElementById('pdf-file');
    var btnExtract = document.getElementById('btn-extract');
    var btnAddRow = document.getElementById('btn-add-row');
    var btnExport = document.getElementById('btn-export');
    var statusBox = document.getElementById('status-box');
    var pdfViewer = document.getElementById('pdf-viewer');
    var tbody = document.querySelector('#ops-table tbody');

    var operations = [];

    function setStatus(message, type) {
        statusBox.className = 'alert alert-' + (type || 'secondary');
        statusBox.textContent = message;
    }

    function rowTemplate(op, index) {
        return '<tr data-index="' + index + '">' +
            '<td><input type="text" class="form-control form-control-sm inp-date-op" value="' + (op.date_operation || '') + '"></td>' +
            '<td><input type="text" class="form-control form-control-sm inp-date-val" value="' + (op.date_valeur || '') + '"></td>' +
            '<td><input type="text" class="form-control form-control-sm libelle-input inp-libelle" value="' + (op.libelle_operation || '').replace(/"/g, '&quot;') + '"></td>' +
            '<td><input type="text" class="form-control form-control-sm inp-debit" value="' + (op.montant_debit || '0.00') + '"></td>' +
            '<td><input type="text" class="form-control form-control-sm inp-credit" value="' + (op.montant_credit || '0.00') + '"></td>' +
            '<td><button type="button" class="btn btn-outline btn-sm btn-delete-row" title="Supprimer">×</button></td>' +
            '</tr>';
    }

    function renderTable() {
        if (!operations.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Aucune operation.</td></tr>';
            btnExport.disabled = true;
            return;
        }
        tbody.innerHTML = operations.map(function (op, index) { return rowTemplate(op, index); }).join('');
        btnExport.disabled = false;
    }

    function collectOperationsFromTable() {
        var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr[data-index]'));
        operations = rows.map(function (row) {
            return {
                date_operation: row.querySelector('.inp-date-op').value.trim(),
                date_valeur: row.querySelector('.inp-date-val').value.trim(),
                libelle_operation: row.querySelector('.inp-libelle').value.trim(),
                montant_debit: row.querySelector('.inp-debit').value.trim() || '0.00',
                montant_credit: row.querySelector('.inp-credit').value.trim() || '0.00'
            };
        });
    }

    btnExtract.addEventListener('click', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) {
            setStatus('Selectionnez un fichier PDF.', 'warning');
            return;
        }

        pdfViewer.src = URL.createObjectURL(file);
        setStatus('Extraction en cours...', 'info');
        btnExtract.disabled = true;
        btnExport.disabled = true;

        var formData = new FormData();
        formData.append('file', file);

        fetch(API_BASE + '/banque/extract', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + JWT },
            body: formData
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            btnExtract.disabled = false;
            if (!data.success) {
                setStatus(data.message || 'Erreur extraction.', 'danger');
                return;
            }
            operations = data.operations || [];
            renderTable();
            setStatus('Extraction terminee: ' + operations.length + ' operation(s). Verifiez puis exportez.', 'success');
        })
        .catch(function () {
            btnExtract.disabled = false;
            setStatus('Erreur reseau pendant extraction.', 'danger');
        });
    });

    btnAddRow.addEventListener('click', function () {
        operations.push({
            date_operation: '',
            date_valeur: '',
            libelle_operation: '',
            montant_debit: '0.00',
            montant_credit: '0.00'
        });
        renderTable();
        setStatus('Ligne ajoutee. Vous pouvez la modifier.', 'info');
    });

    tbody.addEventListener('click', function (event) {
        var target = event.target;
        if (!target.classList.contains('btn-delete-row')) return;
        var tr = target.closest('tr[data-index]');
        if (!tr) return;
        tr.remove();
        collectOperationsFromTable();
        renderTable();
    });

    btnExport.addEventListener('click', function () {
        collectOperationsFromTable();
        if (!operations.length) {
            setStatus('Aucune operation a exporter.', 'warning');
            return;
        }

        setStatus('Generation du CSV...', 'info');
        btnExport.disabled = true;

        fetch(API_BASE + '/banque/export-csv', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + JWT,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ operations: operations })
        })
        .then(function (resp) {
            if (!resp.ok) return resp.json().then(function (j) { throw new Error(j.message || 'Erreur export'); });
            return resp.blob();
        })
        .then(function (blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'oxygene-import.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            btnExport.disabled = false;
            setStatus('CSV telecharge. Pret pour import Oxygene.', 'success');
        })
        .catch(function (err) {
            btnExport.disabled = false;
            setStatus(err.message || 'Erreur export CSV.', 'danger');
        });
    });

    renderTable();
})();
</script>

<?php require_once '../../includes/footer.php'; ?>
