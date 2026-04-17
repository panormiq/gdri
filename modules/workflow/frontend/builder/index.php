<?php
$page_title = 'Workflow Builder';
$extra_styles = [
    url('modules/workflow/frontend/builder/builder.css')
];
$extra_scripts = [
    url('modules/workflow/frontend/builder/builder/i18n.js'),
    url('modules/workflow/frontend/builder/builder/app.js')
];
require_once __DIR__ . '/../../../../frontend/includes/header.php';
?>

<div class="builder-app">
  <div class="builder-toolbar">
    <div class="builder-title">
      <h1 data-i18n="app.title"></h1>
      <span class="builder-subtitle" data-i18n="workflow.hint"></span>
    </div>
    <div class="builder-actions">
      <button id="add-block" class="primary" data-i18n="workflow.addBlock"></button>
      <button id="export-json" class="ghost" data-i18n="common.export"></button>
      <label class="ghost file-button">
        <span data-i18n="common.import"></span>
        <input id="import-json" type="file" accept="application/json">
      </label>
    </div>
  </div>

  <div class="builder-tabs">
    <button class="builder-tab active" data-mode="workflow" data-i18n="mode.workflow"></button>
    <button class="builder-tab" data-mode="editor" data-i18n="mode.editor"></button>
  </div>

  <section class="builder-panel active" data-mode="workflow">
    <div class="workflow-canvas-toolbar">
      <div class="toolbar-group"></div>
      <div class="toolbar-group">
        <button id="zoom-reset" class="ghost" data-i18n="workflow.zoomReset"></button>
      </div>
    </div>
    <div id="workflow-viewport" class="workflow-viewport">
      <div id="workflow-canvas" class="workflow-canvas"></div>
    </div>
    <div class="workflow-preview">
      <h2 data-i18n="preview.title"></h2>
      <div id="block-preview" class="preview-body"></div>
    </div>
  </section>

  <section class="builder-panel" data-mode="editor">
    <div class="editor-layout">
      <aside class="editor-tree">
        <div class="panel-title" data-i18n="editor.blocks"></div>
        <div id="block-tree" class="tree-list"></div>
      </aside>
      <div class="editor-content">
        <div class="panel-title" data-i18n="editor.editTitle"></div>
        <div id="editor-body" class="editor-body"></div>
      </div>
    </div>
  </section>
</div>

<?php require_once __DIR__ . '/../../../../frontend/includes/footer.php'; ?>
