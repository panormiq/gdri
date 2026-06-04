/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-catalogue-types.js
 * RÔLE : Constantes catalogue UGAP (tags par défaut, decisionMode).
 * Le champ technique `type` (choice_set, …) reste en base pour compatibilité, sans UI.
 */
(function initUgapCatalogueTypes(global) {
    'use strict';

    const DECISION_MODES = [
        { value: 'single_choice', label: 'Choix unique' },
        { value: 'multi_choice', label: 'Liste / multi-choix' },
    ];

    const DEFAULT_TAG_REGISTRY = [
        { id: 'design', label: 'Design' },
        { id: 'garantie', label: 'Garantie' },
        { id: 'equipement', label: 'Équipement' },
        { id: 'motorisation', label: 'Motorisation' },
        { id: 'securite', label: 'Sécurité' },
        { id: 'divers', label: 'Divers' },
        { id: 'option_de_base', label: 'Option de base' },
    ];

    const BASE_OPTION_TAG_ID = 'option_de_base';

    function normalizeTagId(raw) {
        return String(raw || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function decisionModeLabel(mode) {
        const hit = DECISION_MODES.find((m) => m.value === mode);
        return hit ? hit.label : mode;
    }

    global.UgapCatalogueTypes = {
        DECISION_MODES,
        DEFAULT_TAG_REGISTRY,
        BASE_OPTION_TAG_ID,
        normalizeTagId,
        decisionModeLabel,
    };
})(typeof window !== 'undefined' ? window : global);
