/**
 * FICHIER : modules/banque/frontend/assets/js/banque-app.js
 * RÔLE : App Import bancaire Oxygène — upload PDF, tableau éditable, export CSV.
 *
 * ENTRÉES : window.BANQUE_CONFIG { apiBase, jwt } injecté par banque.php
 * SORTIES : appels /api/banque/extract et /api/banque/export-csv
 */

(function () {
    var CONFIG = window.BANQUE_CONFIG || {};
    var API_BASE = CONFIG.apiBase || '';
    var JWT = CONFIG.jwt || '';

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
