modules/editor/
│
├─app.js   # point d'entrée
├─ shared/
│   ├─ api/
│   │   ├─ CollectionApi.js
│   │   ├─ TemplateApi.js
│   │   └─ DocumentApi.js
│   └─ fields/
│       ├─ Field.js
│       ├─ FieldRenderer.js
│       └─ ...
│
├─ editor/
│   ├─ EditorListTemplate.js   # template générique liste
│   ├─ EditorFormTemplate.js   # template générique form create/edit
│
├─ collection/
│   ├─ CollectionListPage.js
│   ├─ CollectionEditPage.js
│   ├─ CollectionCreatePage.js
│   └─ CollectionCard.js
│
├─ template/
│   ├─ TemplateListPage.js
│   ├─ TemplateEditPage.js
│   ├─ TemplateCreatePage.js
│   └─ TemplateCard.js
│
├─ templateBuilder/
│   ├─ TemplateBuilderPage.js   # Page principale (layout 3 colonnes)
│   ├─ TemplateBuilderPage.css
│   ├─ components/
│   │   ├─ editor/
│   │   │   ├─ RichTextEditor.js   # Éditeur WYSIWYG central (contentEditable)
│   │   │   └─ RichTextEditor.css
│   │   ├─ leftPanel/
│   │   │   ├─ LeftPanel.js   # Panel gauche (TOC sections, drag & drop)
│   │   │   └─ LeftPanel.css
│   │   └─ rightPanel/
│   │       ├─ RightPanel.js   # Panel droit (onglets verticaux)
│   │       ├─ RightPanel.css
│   │       ├─ FormatTab.js   # Onglet Format (gras, italique, h1/h2/h3, etc.)
│   │       ├─ FormatTab.css
│   │       ├─ CollectionsTab.js   # Onglet Collections (affichage collections/champs)
│   │       ├─ CollectionsTab.css
│   │       ├─ SectionTab.js   # Onglet Section (propriétés section)
│   │       ├─ SectionTab.css
│   │       ├─ LayoutTab.js   # Onglet Mise en page (numérotation, padding, police, titres)
│   │       └─ LayoutTab.css
│   └─ utils/
│       ├─ numberingUtils.js   # Numérotation hiérarchique (numeric, alpha, roman, custom)
│       ├─ sectionHierarchy.js   # Gestion hiérarchie sections (flatten, build, extract, insert)
│       └─ templateRefactorer.js   # Extraction structure depuis HTML
│
└─ document/
    ├─ DocumentListPage.js
    ├─ DocumentEditPage.js
    ├─ DocumentCreatePage.js
    └─ DocumentCard.js