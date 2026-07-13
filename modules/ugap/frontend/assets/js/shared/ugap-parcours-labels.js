/**
 * Libellés UI — parcours UGAP (template de base → variantes parcours → modèle catalogue).
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
        /** Variantes d’un template de base (onglet Templates de base — ex. Standard, Pompiers). */
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
            variantDefaultButton: 'Variante par défaut',
        },
        /** Configuration optionnelle sur un poste catalogue (onglet Modèles). */
        modele: {
            title: 'Modèles',
            singular: 'modèle',
            plural: 'modèles',
            create: 'Ajouter un modèle',
            empty: 'Aucun modèle — ajoutez-en un (ex. Pompiers, Police…).',
            pickOptions: 'Choisir les options',
            pickHint: 'Cliquez sur une ligne pour choisir une option (catalogue complet).',
            nameTitle: 'Nom du modèle',
            created: 'Modèle créé.',
            deletedConfirm: 'Supprimer ce modèle ?',
            saved: 'Modèle enregistré.',
            tabDescription: 'Catalogue importé par poste. Choisissez un <strong>template de base</strong>, puis créez des <strong>modèles</strong> (options par configuration).',
            templateField: 'Template de base',
            templateMissing: 'Aucun template de base — créez-en un dans Templates de base.',
            templateSelectPlaceholder: '— Choisir un template de base —',
            variantField: 'Variante parcours',
            variantSelectPlaceholder: '— Variante par défaut —',
            viewModeField: 'Vue parcours',
            viewModeVariant: 'Défaut (variante)',
            viewModeCustom: 'Personnalisé',
            reorderParcours: 'Réordonner',
            reorderHint: 'Glissez les blocs pour adapter l’ordre d’affichage de ce modèle.',
        },
        legacyOrdreDesOptions: 'Ordre des options',
        /** Libellés tableau réordonnancement (structure + ordre). */
        reorder: {
            implicitDirectOptions: 'Options directes',
            implicitDirectOptionsHint: 'Emplacement des options rattachées directement à ce nœud (pas une sous-catégorie distincte).',
            categoryLevelTag: 'Catégorie',
            categoryDragTitle: 'Réordonner les catégories entre elles',
            subcategoryDragTitle: 'Réordonner les sous-catégories de cette catégorie',
            implicitSlotDragTitle: 'Réordonner l’emplacement des options directes parmi les sous-catégories',
            subnodeDragTitle: 'Réordonner les sous-nœuds de ce parent',
            tableHint: 'Col. 1 <strong>Catégorie</strong> : réordonner les catégories entre elles. Col. 2 / 3 : sous-nœuds du parcours ; la ligne <strong>Options directes</strong> n’apparaît que lorsqu’un nœud a des sous-nœuds catalogue rattachés.',
            treeHint: 'Affichage <strong>tableau</strong> (3 colonnes) avec structure imbriquée : réordonnez uniquement dans la même zone (sous-catégories ou sous-nœuds).',
        },
    };

    function parametragePathHtml() {
        return `<strong>${L.templateDeBase.parametragePath}</strong>`;
    }

    global.UgapParcoursLabels = {
        ...L,
        parametragePathHtml,
    };
})(window);
