<?php
/**
 * Redirection — ancienne page Agents assistés → À traiter / Agents.
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/functions.php';
$to = isset($_GET['inbox']) ? 'pages/agent-human-review.php' : 'pages/user-agents.php';
header('Location: ' . url($to), true, 302);
exit;
