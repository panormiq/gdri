<div id="tab-models" class="tab-panel active">
    <div class="subtabs" id="extraction-subtabs">
        <button class="subtab-btn active" data-extraction-subtab="model" onclick="switchExtractionSubtab('model')">Model</button>
        <button class="subtab-btn" data-extraction-subtab="option" onclick="switchExtractionSubtab('option')">Option</button>
        <button class="subtab-btn" data-extraction-subtab="baseoptions" onclick="switchExtractionSubtab('baseoptions')">Options de base</button>
        <button class="subtab-btn" data-extraction-subtab="minoration" onclick="switchExtractionSubtab('minoration')">Minoration</button>
        <button class="subtab-btn" data-extraction-subtab="pr" onclick="switchExtractionSubtab('pr')">PR</button>
    </div>

    <?php require __DIR__ . '/extraction/subtab-model.php'; ?>
    <?php require __DIR__ . '/extraction/subtab-option.php'; ?>
    <?php require __DIR__ . '/extraction/subtab-baseoptions.php'; ?>
    <?php require __DIR__ . '/extraction/subtab-minoration.php'; ?>
    <?php require __DIR__ . '/extraction/subtab-pr.php'; ?>
</div>
