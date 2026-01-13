<script type="module">
  import DocumentTemplateRenderer from './src/modules/editor/template/document/DocumentTemplateRenderer.js';
  import { collectionElementApi } from './src/modules/editor/shared/api/CollectionElementApi.js';
  import DocumentTemplateLoader from './src/modules/editor/template/document/DocumentTemplateLoader.js';
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Charger le JSON
      const res = await fetch('./src/modules/editor/template/document/templates/zeppelinBoatTemplate.json');
      if (!res.ok) throw new Error('Impossible de charger le template JSON');
      const zeppelinTemplate = await res.json();

      // Récupérer le container après que le DOM est prêt
      const container = document.getElementById('template-container');
      if (!container) throw new Error('Container #template-container introuvable');
      //recuperer les donnée
      const template = await DocumentTemplateLoader.loadFromJson(
  './src/modules/editor/template/document/templates/zeppelinBoatTemplate.json'
);
 const collectionId = "6957e26e62f9f076717d9798";
const elementId = "695911b422e9971825265bb4";

// 🔹 Récupération de l'élément
const element = await collectionElementApi.getById(collectionId, elementId);
console.log("element",element)
if (!element) {
  console.error("Élément non trouvé");
  return;
}




// 🔹 Créer le renderer et passer l'élément récupéré
const renderer = new DocumentTemplateRenderer(zeppelinTemplate);
renderer.render(container, element); // <- on passe element comme data


      console.log('Template rendu avec succès !');

    } catch (err) {
      console.error('Erreur lors du rendu du template :', err);
    }
  });
</script>