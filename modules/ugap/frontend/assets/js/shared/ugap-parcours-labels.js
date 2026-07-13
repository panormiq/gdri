/**
 * Libellés UI — parcours UGAP (template de base → parcours personnalisé → modèle).
 */
(function initUgapParcoursLabels(global) {
    'use strict';

    const L = {
        /** Admin : définit nœuds, ordre et options de base pour une famille de produits. */
        templateDeBase: {
            sectionTab: 'Templates de base',
            title: 'Templates de base',
            singular: 'template de base',
            plural: 'templates de base',
            create: 'Créer un template de base',
            editStructure: 'Modifier la structure',
            empty: 'Aucun template de base. Créez-en un ci-dessous.',
            searchPlaceholder: 'Rechercher un template de base…',
            count: 'templates de base',
            description: 'Sélectionnez les nœuds catalogue dans la structure. L’ordre d’affichage se règle dans le parcours Standard.',
            structureHint: 'Ajoutez ou retirez des nœuds catalogue. L’ordre d’affichage se règle dans le parcours <strong>Standard</strong>.',
            parametragePath: 'Paramétrage → Templates de base',
        },
        /** Utilisateur : dérivé d’un template de base — réordonne le parcours et choisit les options. */
        parcoursPerso: {
            title: 'Parcours personnalisés',
            singular: 'parcours personnalisé',
            plural: 'parcours personnalisés',
            create: 'Ajouter un parcours',
            empty: 'Aucun parcours personnalisé — ajoutez-en un (ex. Pompiers, Police…).',
            pickOptions: 'Choisir les options',
            reorder: 'Réordonner le parcours',
            reorderHint: 'Glissez les catégories, sous-catégories et sous-nœuds pour adapter l’ordre d’affichage. La liste reste celle du template de base.',
            pickHint: 'Cliquez sur une ligne pour choisir une option (catalogue complet).',
        },
        modele: {
            templateField: 'Template de base',
            templateMissing: 'Aucun template de base — créez-en un dans Templates de base.',
            templateSelectPlaceholder: '— Choisir un template de base —',
        },
        legacyOrdreDesOptions: 'Ordre des options',
    };

    function parametragePathHtml() {
        return `<strong>${L.templateDeBase.parametragePath}</strong>`;
    }

    global.UgapParcoursLabels = {
        ...L,
        parametragePathHtml,
    };
})(window);
