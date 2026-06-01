<?php
/**
 * FICHIER : modules/ugap/frontend/admin.php
 * RÔLE : Routeur d'entrée admin — redirige vers paramétrage v2 ou délègue au legacy.
 *
 * ENTRÉES : query `legacy=1`, `ugapView=prompts`, `embedded=1`
 * SORTIES : redirection HTTP ou inclusion _old/admin.php
 *
 * DÉPEND DE : parametrage/index.php, _old/admin.php
 * NE PAS : réimplémenter l'UI admin ici
 * APPELÉ PAR : dashboard, bookmarks, prompts IA (legacy)
 */
$useLegacy = (isset($_GET['legacy']) && $_GET['legacy'] === '1')
    || (isset($_GET['ugapView']) && $_GET['ugapView'] === 'prompts');

if ($useLegacy) {
    require __DIR__ . '/_old/admin.php';
    exit;
}

$query = $_SERVER['QUERY_STRING'] ?? '';
$target = '/modules/ugap/frontend/parametrage/index.php';
if ($query !== '') {
    $target .= '?' . $query;
}
header('Location: ' . $target, true, 302);
exit;
