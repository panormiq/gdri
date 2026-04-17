# Révision Facebook : pages_messaging — Texte et vidéo

Ce document fournit le texte à coller dans le formulaire de révision Facebook et le script pour la vidéo de démonstration.

---

## 1. Question : « Comment cette application utilisera-t-elle pages_messaging ? »

**Texte à copier-coller dans le champ de justification :**

```
Notre application est une plateforme de gestion pour les entreprises (GDRI). Elle permet aux entreprises de centraliser la gestion de leurs communications Facebook sans avoir à se connecter à Facebook au quotidien.

Utilisation de la permission pages_messaging :

1) LECTURE DES MESSAGES PRIVÉS
   - Les entreprises connectent leur page Facebook via OAuth (avec leur consentement).
   - L'application récupère les conversations et les derniers messages privés reçus sur la page, afin d'afficher dans notre interface les messages que les clients envoient à la page.
   - Ces messages sont analysés par l'IA afin de diriger les demandes vers le bon service (SAV, commercial, etc.) et de définir un degré d'urgence de réponse.
   - Les équipes voient ainsi les demandes clients les concernant depuis un seul tableau de bord.

2) RÉPONSE AUX MESSAGES
   - Les utilisateurs peuvent répondre aux messages privés directement depuis notre interface (API Send de Messenger).
   - Les réponses sont envoyées au nom de la page Facebook, comme si l'entreprise répondait depuis Facebook.

3) NOTIFICATIONS ET ANALYSE
   - Lorsqu'un message privé est reçu (via webhook), l'application analyse l'intention du message (IA) et peut envoyer un email de notification aux responsables configurés (ex. alerte SAV, demande commerciale).
   - Aucune donnée de message n'est partagée avec des tiers ; tout reste dans l'environnement de l'entreprise.

En résumé : pages_messaging est utilisé uniquement pour permettre aux entreprises de lire et répondre aux messages privés de leur propre page Facebook depuis notre plateforme, avec leur consentement explicite lors de la connexion OAuth.
```

**Version courte (si le champ est limité en caractères) :**

```
L'application permet aux entreprises de gérer les messages privés de leur page Facebook depuis une interface centralisée : (1) lecture des conversations et du dernier message pour les afficher dans l'app, (2) envoi de réponses aux utilisateurs via l'API Messenger, (3) réception des nouveaux messages par webhook pour notifications et analyse d'intention (ex. alerte SAV). Les entreprises connectent leur page via OAuth ; l'accès est limité à leurs propres pages et utilisé uniquement pour lire et répondre aux messages au nom de la page.
```

---

## 2. Checklist avant de soumettre la révision

Cocher avant d’envoyer la demande :

### App et paramètres
- [ ] **App en mode développement** avec au moins un appel API `pages_messaging` réussi (voir `install/VALIDER-PAGES-MESSAGING.md`).
- [ ] **Politique de confidentialité** et **conditions d’utilisation** renseignées dans les paramètres de l’app (URLs valides).
- [ ] **Contact développeur** et **email** à jour dans Facebook Developer.

### Permissions et technique
- [ ] **pages_messaging** ajoutée dans App Review → Permissions and Features (demande activée).
- [ ] **Scopes OAuth** : `pages_messaging` est bien demandé à la connexion (voir `backend/modules/facebook/routes.js`).
- [ ] **Webhook** configuré et vérifié (GET renvoie bien le `hub.challenge`).
- [ ] Au moins **une page connectée** et au moins **un appel API** utilisant `pages_messaging` effectué (ex. GET conversations ou dernier message) pour que Facebook affiche « 1 appel d’API sur 1 nécessaire ».

### Contenus à joindre
- [ ] **Compte test pour les réviseurs** : compte réel ajouté comme Testeur + accès fourni (voir section 3 ci-dessous).
- [ ] **Instructions de test** remplies (voir section 4 ci-dessous).
- [ ] **Vidéo de démonstration** enregistrée et uploadée (voir section 5).
- [ ] **Captures d’écran** si demandées (écran de connexion Facebook, écran liste des messages, écran de réponse).

---

## 3. Compte test pour les réviseurs Facebook

### Texte officiel Facebook (à respecter)

> **Tester et reproduire le bon fonctionnement de votre intégration**  
> Au cours du processus d’examen, nous vérifierons que l’expérience d’utilisation de l’app fonctionne comme prévu. Si vous fournissez une surface de gestion de Page aux utilisateurs, donnez-nous accès à un **compte test temporaire** pour que nous puissions la tester.
>
> **Note :** Pour l’autorisation **pages_messaging**, veuillez **créer un vrai compte sur Facebook** et lui attribuer le rôle de **testeur** dans **Rôles** dans l’application. **Ne soumettez pas** les utilisateurs test créés dans « Rôles » dans l’application, car ils ne peuvent pas recevoir de messages de bot.

### Ce que demande Facebook (résumé)

- **Compte temporaire** : un moyen pour les réviseurs de se connecter à votre application et d’utiliser la gestion des messages.
- **Pour pages_messaging** : créer ou utiliser un **vrai compte Facebook** et lui attribuer le rôle **Testeur** dans l’application. **Ne pas** soumettre les « Utilisateurs test » créés dans Rôles de l’application (ces comptes fictifs ne peuvent pas recevoir de messages Messenger).

### Étapes à suivre

#### 1. Créer ou choisir un vrai compte Facebook

- Soit créer un **compte Facebook dédié** à la révision (ex. `votre-app-review@votredomaine.com`).
- Soit utiliser un compte existant (collaborateur, vous-même) qui servira uniquement pour le test.
- Ce compte doit pouvoir se connecter à votre site GDRI et recevoir des messages Messenger (donc un vrai profil, pas un « Test User » généré par Facebook).

#### 2. Ajouter ce compte comme Testeur dans l’app Facebook

1. Allez sur [developers.facebook.com](https://developers.facebook.com) → votre application.
2. Menu **Paramètres** (ou **Settings**) → **Rôles** (ou **Roles**).
3. Dans **Testeurs** (Testers), cliquez sur **Ajouter des testeurs** (Add Testers).
4. Saisissez l’**adresse e-mail Facebook** ou le **nom du profil** du compte réel que vous avez choisi.
5. Invitez ce compte ; la personne doit **accepter l’invitation** (elle recevra une notification / e-mail).
6. Une fois acceptée, ce compte pourra utiliser l’app en mode Développement et autoriser `pages_messaging` lors de la connexion OAuth.

**Important** : n’utilisez pas la section « Utilisateurs test » (Test Users) qui crée des comptes fictifs — ces comptes ne peuvent pas recevoir de messages de bot.

#### 3. Donner l’accès à votre application (GDRI)

- Créez un **utilisateur / entité** dans GDRI pour ce compte, ou assurez-vous que le compte peut se connecter (connexion Facebook ou email selon votre auth).
- Si votre auth est par e-mail/mot de passe : créez un utilisateur avec l’e-mail du compte test et un mot de passe temporaire que vous communiquerez aux réviseurs.
- Si votre auth est « Se connecter avec Facebook » : le compte testeur Facebook pourra se connecter à GDRI une fois qu’il a accepté le rôle Testeur (et que votre app autorise les testeurs en mode Développement).

#### 4. Préparer une page de test (recommandé)

- Le compte test doit être **administrateur** ou **éditeur** d’au moins **une page Facebook**.
- Créez une page de test dédiée si besoin, ou utilisez une page existante dont le compte test est admin.
- Ainsi, les réviseurs pourront : se connecter à GDRI → connecter cette page → voir les messages et envoyer une réponse.

#### 5. Renseigner le formulaire de révision

Lorsque Facebook demande un **compte de test** ou **accès pour tester** :

- **URL de l’application** : `https://www.gdr-innovation.fr` (ou votre URL de production / staging).
- **Instructions de connexion** : par exemple :  
  « Utilisez les identifiants suivants pour vous connecter à notre application et tester la gestion des messages. Compte test : [adresse e-mail] / Mot de passe : [mot de passe temporaire]. Une fois connecté, allez dans le module Facebook, cliquez sur « Se connecter avec Facebook » et autorisez l’accès aux pages et aux conversations. Vous pouvez connecter une page dont vous êtes admin ou utiliser la page de test déjà configurée. »
- Si vous ne donnez pas de mot de passe (connexion Facebook uniquement), indiquez : « Le réviseur doit utiliser le compte Facebook [e-mail ou nom] qui a été ajouté comme Testeur dans l’application. Se connecter à l’app via « Connexion Facebook » puis suivre les instructions de test. »

**Exemple de texte à coller dans le champ « Compte de test / Instructions » :**

```
Compte de test pour les réviseurs :
- URL : https://www.gdr-innovation.fr (ou [votre URL])
- Connexion : [E-mail du compte test] / Mot de passe : [mot de passe temporaire]
  (Ou : utiliser le compte Facebook invité comme Testeur dans l’app et se connecter via "Se connecter avec Facebook".)
- Ce compte est un vrai profil Facebook ajouté comme Testeur (Roles → Testers) ; il peut recevoir des messages Messenger.
- Après connexion : Module Facebook → Se connecter avec Facebook → autoriser les pages et les conversations → sélectionner une page dont le compte est admin.
```

#### 6. Accès à la boîte mail du compte test (si l’app envoie des e-mails)

Votre application envoie des e-mails selon les cas (notifications, rapports d’intention, alertes). Pour que les réviseurs puissent **vérifier que ces e-mails sont bien envoyés**, donnez-leur accès à la **boîte mail** du compte test.

**Option A – Recommandée : même adresse pour tout**

- Utilisez **une seule adresse** pour le compte test : GDRI + Facebook + messagerie (ex. `review-gdri@votredomaine.fr`).
- Créez cette boîte mail (ou utilisez une adresse dédiée que vous contrôlez).
- Donnez à Facebook les identifiants de **connexion à la messagerie** (webmail) :
  - **URL du webmail** : ex. `https://mail.votredomaine.fr` ou `https://outlook.com` / Gmail selon l’hébergeur.
  - **Identifiant** : l’e-mail du compte test.
  - **Mot de passe** : mot de passe de la boîte mail (peut être le même que pour GDRI pour simplifier).
- Dans les instructions, précisez : *« Les notifications et rapports envoyés par l’application arrivent à cette adresse. Vous pouvez vous connecter au webmail ci-dessus pour vérifier la réception des e-mails. »*

**Option B – Compte e-mail dédié « révision »**

- Créez une adresse du type `facebook-review@votredomaine.fr` (avec sa boîte mail).
- Dans GDRI, configurez les rapports / notifications pour qu’ils soient envoyés à cette adresse (destinataires par défaut ou config du module Facebook / analyse d’intention).
- Donnez à Facebook : identifiants GDRI du compte test **et** identifiants du webmail de `facebook-review@...` pour qu’ils voient les e-mails envoyés par l’app.

**À indiquer dans le formulaire de révision (exemple) :**

```
Accès à la boîte mail (pour vérifier les e-mails envoyés par l’app) :
- URL webmail : [ex. https://webmail.votredomaine.fr ou https://outlook.live.com]
- Identifiant : [même e-mail que le compte test]
- Mot de passe : [mot de passe de la boîte mail]
L’application envoie des e-mails (notifications, rapports d’intention). Les réviseurs peuvent se connecter à cette boîte pour vérifier la réception.
```

Après la révision, vous pouvez changer les mots de passe (GDRI et/ou boîte mail) et désactiver le compte test si besoin.

---

## 4. Instructions de test à fournir à Facebook

**Texte à coller dans le champ « Instructions pour les réviseurs » :**

```
CONNEXION
1. Se connecter à notre application avec un compte ayant accès au module Facebook.
2. Aller dans la section "Facebook" / "Configuration Facebook" (ou équivalent).
3. Cliquer sur "Se connecter avec Facebook" et autoriser l’accès aux pages et à la permission "Gérer et lire les conversations de votre Page" (pages_messaging).
4. Sélectionner la page à connecter et valider.

TEST SUR LA PAGE – LECTURE DES MESSAGES (pages_messaging)
5. Envoyer au préalable un message privé à la page (depuis Messenger ou un autre compte), afin qu'il y ait au moins un message à afficher.
6. Aller sur "Publier sur Facebook" ou "Messages" (selon le menu).
7. Sélectionner une page connectée.
8. Vérifier que le dernier message privé reçu sur la page s’affiche (récupéré via l’API avec pages_messaging).

ENVOI D’UNE RÉPONSE (pages_messaging)
9. Dans le même écran, saisir une réponse dans le champ prévu et envoyer.
10. Vérifier que la réponse apparaît bien dans la conversation Messenger (côté Facebook / Page ou Messenger).

OPTIONNEL – WEBHOOK
11. Envoyer un message privé à la page depuis un autre compte Facebook.
12. Vérifier dans les logs serveur ou dans l’interface que le message est reçu (webhook + éventuelle notification).

Compte de test : voir section 3. Indiquer l'URL, l'email et le mot de passe temporaire (ou Connexion Facebook avec le compte Testeur).
URL de l’app : [ex. https://www.gdr-innovation.fr]
```

Adaptez les libellés exacts des menus à votre interface (ex. « Publier un post et répondre aux messages »).

---

## 5. Script pour la vidéo de démonstration

Oui : **Facebook demande bien un test sur la page** pour la vidéo. Ce test consiste à montrer que l’app lit et répond aux messages de la page. Il repose uniquement sur les **appels API** (récupération du dernier message, envoi d’une réponse), **pas sur les webhooks**. Donc vous pouvez faire toute la démo **en mode Développement** : pas besoin que l’app soit en Production.

### Préparer le test avant de tourner la vidéo

1. **Avoir au moins un message sur la page**  
   Avant d’enregistrer : envoyez un message privé à votre page Facebook (depuis un autre compte ou depuis Messenger en tant que « visiteur »). Comme ça, quand vous ouvrirez « Publier sur Facebook » / « Messages » dans l’app, l’appel API qui récupère le dernier message trouvera ce message et l’affichera.

2. **Vérifier que la page est connectée**  
   Dans l’app, la page doit être connectée avec un compte qui a le rôle **Admin** ou **Éditeur** sur la page et qui a autorisé `pages_messaging` à la connexion.

3. **Tester une fois le flux**  
   Ouvrir l’écran « Dernier message », vérifier que le message s’affiche, envoyer une réponse depuis l’app, puis vérifier dans Messenger que la réponse est bien reçue. Une fois que ça marche, vous pouvez enregistrer la vidéo en refaisant les mêmes étapes.

### Durée conseillée : 2 à 4 minutes

---

**Plan de la vidéo**

| Séquence | Durée approx. | Action à filmer | Commentaire à dire (optionnel) |
|----------|----------------|------------------|---------------------------------|
| 1. Contexte | 15 s | Ouvrir l’app, montrer le tableau de bord ou le menu. | « L’application permet aux entreprises de gérer leur page Facebook depuis un seul endroit. » |
| 2. Connexion Facebook | 30 s | Cliquer sur « Se connecter avec Facebook », autoriser l’app, choisir la page, valider. | « L’utilisateur connecte sa page en autorisant l’accès aux messages. » |
| 3. Liste / choix de page | 15 s | Afficher la liste des pages connectées ou l’onglet de la page. | « Ici on voit la page connectée. » |
| 4. Lecture des messages | 30 s | Ouvrir l’écran où s’affiche le dernier message (ou la liste des conversations). Montrer clairement le contenu d’un message reçu sur la page. | « Les messages privés reçus sur la page sont récupérés et affichés ici grâce à pages_messaging. » |
| 5. Réponse à un message | 30 s | Saisir une réponse dans l’interface et envoyer. Puis montrer la même conversation côté Facebook (Messenger ou Page) avec la réponse reçue. | « L’utilisateur répond depuis l’application ; la réponse est envoyée au nom de la page via l’API Messenger. » |
| 6. (Optionnel) Webhook | 20 s | Envoyer un message à la page depuis un autre compte, puis montrer l’arrivée du message dans l’app ou dans les notifications. | « Quand un nouveau message arrive, l’app le reçoit en temps réel et peut alerter l’équipe. » |

---

**Points à bien montrer à l’image**

1. **Autorisation** : l’écran Facebook qui demande l’accès aux messages / « Gérer et lire les conversations de votre Page ».
2. **Lecture** : un vrai message privé (texte) affiché dans votre interface.
3. **Envoi** : la réponse tapée dans l’app puis visible dans Messenger (ou inbox de la page).

**Conseils**

- Parler en français si la révision est pour un compte FR.
- Éviter de montrer des données personnelles réelles (utiliser un compte test et des messages de test).
- Si l’app est en HTTPS, enregistrer sur l’URL réelle (ou staging) pour que l’URL dans les instructions corresponde à la vidéo.

---

## 6. Résumé des points à ne pas oublier

- **Justification** : utiliser le texte de la section 1 (complet ou courte version).
- **Vérifications** : faire la checklist section 2 (app, permissions, webhook, au moins 1 appel API `pages_messaging`).
- **Compte test** : section 3 — vrai compte Facebook ajouté comme **Testeur** (Roles → Testers), pas un « Test User » ; fournir accès (URL + identifiants ou Connexion Facebook) aux réviseurs.
- **Instructions** : coller le texte de la section 4 en l’adaptant à votre app.
- **Vidéo** : suivre le script section 5 et montrer connexion → lecture des messages → envoi d’une réponse (et optionnellement réception par webhook).

Une fois tout cela en place, vous pouvez soumettre la demande de révision pour `pages_messaging` dans App Review → Permissions and Features.
