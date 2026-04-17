<div id="tab-prompts" class="tab-panel">
    <div style="margin-bottom: 20px;">
        <p style="color: #666; margin-bottom: 15px;">
            Personnalisez les prompts IA du module UGAP.
        </p>
        <div id="current-prompt-info" style="padding: 10px; margin-bottom: 15px; background: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px;">
            <strong>📋 Prompt actuellement utilisé :</strong>
            <div id="prompt-status" style="margin-top: 5px; font-size: 14px; color: #666;">
                Chargement...
            </div>
        </div>
    </div>

    <div class="subtabs" id="prompt-subtabs">
        <button class="subtab-btn active" data-prompt-subtab="extraction-base" onclick="switchPromptSubtab('extraction-base')">Extraction base</button>
        <button class="subtab-btn" data-prompt-subtab="categorization" onclick="switchPromptSubtab('categorization')">Catégorisation</button>
        <button class="subtab-btn" data-prompt-subtab="minoration" onclick="switchPromptSubtab('minoration')">Minoration</button>
        <button class="subtab-btn" data-prompt-subtab="famille" onclick="switchPromptSubtab('famille')">Famille</button>
        <button class="subtab-btn" data-prompt-subtab="assignation" onclick="switchPromptSubtab('assignation')">Assignation</button>
    </div>
    <div id="prompt-ia-runtime" style="padding: 12px 14px; margin: 0 0 12px 0; background: #d1ecf1; border-left: 4px solid #0c5460; border-radius: 4px; font-size: 14px; color: #0c5460;">
        Chargement de la configuration IA (serveur / modèle)…
    </div>

    <?php require __DIR__ . '/prompts/subtab-extraction-base.php'; ?>
    <?php require __DIR__ . '/prompts/subtab-categorization.php'; ?>
    <?php require __DIR__ . '/prompts/subtab-minoration.php'; ?>
    <?php require __DIR__ . '/prompts/subtab-famille.php'; ?>
    <?php require __DIR__ . '/prompts/subtab-assignation.php'; ?>

    <div style="display: flex; gap: 10px;">
        <button id="btn-reset-prompts" class="btn btn-outline">🔄 Réinitialiser aux valeurs par défaut</button>
    </div>
</div>
