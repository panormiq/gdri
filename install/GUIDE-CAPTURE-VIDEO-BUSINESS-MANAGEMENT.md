# Guide de capture vidéo - business_management

## Prérequis

1. **Outils nécessaires** :
   - Logiciel de capture d'écran (OBS Studio, Camtasia, ou équivalent)
   - Microphone pour la narration
   - Script de démonstration préparé

2. **Environnement préparé** :
   - Application GDRI en cours d'exécution
   - Backend démarré
   - BackendIA démarré
   - Scripts de test prêts

## Étapes de capture

### 1. Préparation (5 minutes)
- Vérifier que tous les services sont démarrés
- Préparer un commentaire de test
- Ouvrir le script `test-webhook-video-demo.js`
- Tester une fois avant la capture

### 2. Capture - Partie 1 : Connexion (30 secondes)
- Montrer la connexion à Facebook
- Expliquer brièvement l'autorisation

### 3. Capture - Partie 2 : Réception webhook (1-2 minutes)
- Exécuter `node backend/test-webhook-video-demo.js`
- Montrer la console avec le commentaire reçu
- Expliquer le processus

### 4. Capture - Partie 3 : Analyse IA (1-2 minutes)
- Montrer l'analyse en cours
- Attendre les résultats
- Expliquer les catégories détectées

### 5. Capture - Partie 4 : Résultats (30 secondes)
- Montrer les résultats de l'analyse
- Expliquer les actions possibles

## Conseils

- **Qualité audio** : Utiliser un bon microphone, parler clairement
- **Qualité vidéo** : Résolution 1080p minimum, 60 FPS si possible
- **Durée** : 3-5 minutes maximum
- **Script** : Suivre le script fourni mais rester naturel

## Points clés à montrer

✓ Réception du webhook en temps réel
✓ Analyse d'intention automatique
✓ Résultats clairs et compréhensibles
✓ Respect de la confidentialité

