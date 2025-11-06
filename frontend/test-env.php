<?php
/**
 * Script de test pour vérifier l'environnement détecté
 * Usage: http://localhost/gdri/frontend/test-env.php
 */

require_once 'config/config.php';
require_once 'includes/functions.php';

// Fonction pour détecter la branche Git
function getGitBranch() {
    try {
        $branch = @shell_exec('git rev-parse --abbrev-ref HEAD 2>nul');
        return trim($branch) ?: 'non détecté';
    } catch (Exception $e) {
        return 'erreur: ' . $e->getMessage();
    }
}

$gitBranch = getGitBranch();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Environnement</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
        }
        .info-item {
            margin: 10px 0;
            padding: 10px;
            background: #f9f9f9;
            border-radius: 4px;
        }
        .label {
            font-weight: bold;
            color: #666;
        }
        .value {
            font-family: monospace;
            color: #007bff;
            margin-left: 10px;
        }
        .production {
            background: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
            font-weight: bold;
        }
        .development {
            background: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>🔍 Test Environnement</h1>
        
        <div class="info-item">
            <span class="label">Branche Git:</span>
            <span class="value"><?php echo htmlspecialchars($gitBranch); ?></span>
        </div>
        
        <div class="info-item">
            <span class="label">ENVIRONMENT:</span>
            <span class="value"><?php echo ENVIRONMENT; ?></span>
        </div>
        
        <?php if (ENVIRONMENT === 'production'): ?>
            <div class="production">
                🚀 MODE PRODUCTION (branche master)
            </div>
        <?php else: ?>
            <div class="development">
                🛠️ MODE DÉVELOPPEMENT (branche <?php echo htmlspecialchars($gitBranch); ?>)
            </div>
        <?php endif; ?>
        
        <div class="info-item">
            <span class="label">BASE_URL:</span>
            <span class="value"><?php echo BASE_URL; ?></span>
        </div>
        
        <div class="info-item">
            <span class="label">API_BASE_URL:</span>
            <span class="value"><?php echo API_BASE_URL; ?></span>
        </div>
        
        <div class="info-item">
            <span class="label">HTTP_HOST:</span>
            <span class="value"><?php echo $_SERVER['HTTP_HOST'] ?? 'non défini'; ?></span>
        </div>
        
        <div class="info-item">
            <span class="label">Exemple URL CSS:</span>
            <span class="value"><?php echo url('assets/css/main.css'); ?></span>
        </div>
        
        <div class="info-item">
            <span class="label">Exemple URL API:</span>
            <span class="value"><?php echo getApiBaseUrl(); ?>/health</span>
        </div>
        
        <h2>📝 Explication</h2>
        <ul>
            <li><strong>Branche master</strong> → ENVIRONMENT = 'production' → URLs en mode production</li>
            <li><strong>Branche develop</strong> → ENVIRONMENT = 'development' → URLs en mode localhost</li>
            <li>Pas besoin de changer de code, juste changer de branche Git !</li>
        </ul>
    </div>
</body>
</html>

