# Comment faire la révision (Review) Facebook

Ce guide décrit **étape par étape** comment soumettre votre app à la révision Facebook pour pouvoir passer en Production (et recevoir de vrais webhooks, commentaires, etc.).

---

## 1. À quoi sert la révision ?

- **Sans révision** : l’app reste en **mode Développement**. Vous ne recevez pas de vrais webhooks (commentaires, posts, messages).
- **Après révision approuvée** : vous pouvez passer en **Production**. Les vrais événements (commentaires, messages, etc.) déclencheront des webhooks.

**À savoir :** Pour les permissions **standard** (ex. `pages_read_engagement`, `pages_show_list`, `pages_manage_posts`), Facebook peut parfois autoriser le passage en Production sans révision complète, si les infos de base sont remplies. Pour **pages_messaging** (messages privés), une révision est en général **obligatoire**.

---

## 2. Avant de soumettre : checklist rapide

- [ ] **Politique de confidentialité** : URL valide dans Paramètres → Informations de base
- [ ] **Conditions d’utilisation** : URL valide (ou lien vers une page légale)
- [ ] **Contact** : email du développeur à jour
- [ ] **Webhook** : URL configurée et **vérifiée** (statut vert dans Facebook Developer)
- [ ] **Au moins un appel API** pour chaque permission demandée (ex. `pages_messaging` : avoir connecté une page et récupéré le dernier message ou les conversations)
- [ ] **Vidéo de démo** enregistrée (pour `pages_messaging` : lecture + envoi d’un message)
- [ ] **Texte de justification** et **instructions de test** prêts (voir `install/REVISION-PAGES-MESSAGING-TEXTE-ET-VIDEO.md`)

---

## 3. Où faire la révision ?

1. Allez sur **[developers.facebook.com](https://developers.facebook.com)** et connectez-vous.
2. Sélectionnez **votre application**.
3. Dans le menu de gauche : **Révision de l’application** (ou **App Review**).
4. Onglet **Permissions et fonctionnalités** (ou **Permissions and Features**).

Vous voyez la liste des permissions. Celles qui sont en **« Demander »** ou **« Request »** doivent être soumises pour la révision.

---

## 4. Révision pour recevoir de vrais commentaires (feed)

Pour recevoir des **vrais webhooks** (commentaires, posts), il faut que l’app puisse être en **Production**. Parfois Facebook demande une révision même pour des permissions comme `pages_read_engagement`.

### Option A : La bascule « Mise en ligne » est disponible

1. **Paramètres** → **Informations de base**.
2. En bas : **Mode de l’application**.
3. Si vous voyez **« Mise en ligne »** / **« Passer en mode Production »** et que ce n’est pas grisé, cliquez dessus et confirmez.
4. Remplissez les champs demandés (politique de confidentialité, conditions d’utilisation, etc.) si ce n’est pas déjà fait.
5. Une fois en Production, les webhooks **feed** (commentaires, posts) fonctionnent pour les pages abonnées.

### Option B : La bascule est grisée ou Facebook demande une révision

1. Allez dans **Révision de l’application** → **Permissions et fonctionnalités**.
2. Repérez les permissions utilisées par votre app (ex. `pages_read_engagement` pour les posts/commentaires).
3. Cliquez sur **« Demander »** (Request) à côté de la permission.
4. Remplissez le formulaire :
   - **Comment votre application utilise-t-elle cette permission ?**  
     Exemple : « Notre application affiche les posts et commentaires de la page dans un tableau de bord et reçoit les nouveaux commentaires par webhook pour les analyser et notifier les équipes. »
   - **Instructions pour les réviseurs** : comment se connecter, aller sur la page, voir les posts/commentaires (ou déclencher un commentaire de test).
   - **Vidéo** : si demandée, montrez l’app qui affiche des posts/commentaires ou qui reçoit un webhook (test depuis le tableau de bord).
5. Envoyez la demande et attendez l’email de Facebook (souvent 1–7 jours).
6. Une fois approuvée, repassez dans **Paramètres** → **Informations de base** et passez en **Production**.

---

## 5. Révision pour pages_messaging (messages privés)

Si vous voulez aussi (ou seulement) la permission **pages_messaging** :

1. **Révision de l’application** → **Permissions et fonctionnalités**.
2. Trouvez **pages_messaging** → **Demander** (Request).
3. Dans le formulaire, utilisez le contenu du fichier **`install/REVISION-PAGES-MESSAGING-TEXTE-ET-VIDEO.md`** :
   - **Comment cette application utilisera-t-elle pages_messaging ?**  
     → Copiez le **texte long** de la section 1 du guide.
   - **Instructions pour les réviseurs**  
     → Copiez les instructions de la section 3 (connexion, test sur la page : afficher le dernier message, envoyer une réponse).
   - **Vidéo de démonstration**  
     → Uploadez la vidéo en suivant le script de la section 4 (connexion → lecture du message → envoi d’une réponse → vérification dans Messenger).
4. Ajoutez l’**URL de l’app** (et un compte testeur si Facebook le demande).
5. **Soumettez** la demande.
6. Après approbation, l’app pourra demander `pages_messaging` aux utilisateurs et vous pourrez passer en Production si ce n’est pas déjà fait.

---

## 6. Après la révision

- Vous recevrez un **email** (succès ou refus avec motifs).
- Dans **Révision de l’application**, le statut de chaque permission demandée sera mis à jour (Approuvée / Refusée).
- Si tout est approuvé (ou si les permissions nécessaires le sont), allez dans **Paramètres** → **Informations de base** et passez l’app en **Production**.
- Une fois en Production, les **vrais commentaires** (et autres événements selon les abonnements) déclencheront bien des webhooks vers votre URL.

---

## 7. Résumé

| Objectif | Action |
|----------|--------|
| Recevoir de **vrais commentaires** (webhooks feed) | Passer l’app en **Production** (si la bascule est dispo). Sinon, faire une révision pour les permissions utilisées (ex. `pages_read_engagement`) puis passer en Production. |
| Utiliser les **messages privés** (pages_messaging) | Faire une **révision** pour `pages_messaging` avec le texte + instructions + vidéo du guide `REVISION-PAGES-MESSAGING-TEXTE-ET-VIDEO.md`, puis passer en Production après approbation. |

Tous les textes et scripts détaillés pour **pages_messaging** sont dans : **`install/REVISION-PAGES-MESSAGING-TEXTE-ET-VIDEO.md`**.
