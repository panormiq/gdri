/**
 * Script de test pour vérifier les routes UGAP
 * Usage: node modules/ugap/test-routes.js
 */

const path = require('path');
const routes = require('./backend/routes');

console.log('🔍 Vérification des routes UGAP...\n');

// Obtenir toutes les routes enregistrées
const stack = routes.stack || [];

console.log('📋 Routes enregistrées:');
console.log('='.repeat(60));

stack.forEach((layer, index) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(', ');
    const path = layer.route.path;
    console.log(`${index + 1}. ${methods.padEnd(8)} ${path}`);
  }
});

console.log('='.repeat(60));
console.log(`\n✅ Total: ${stack.length} routes enregistrées\n`);

// Vérifier spécifiquement la route detect-subcategories
const detectRoute = stack.find(layer => 
  layer.route && 
  layer.route.path.includes('detect-subcategories')
);

if (detectRoute) {
  console.log('✅ Route detect-subcategories trouvée:');
  console.log(`   Méthodes: ${Object.keys(detectRoute.route.methods).join(', ')}`);
  console.log(`   Chemin: ${detectRoute.route.path}`);
} else {
  console.log('❌ Route detect-subcategories NON trouvée!');
}
