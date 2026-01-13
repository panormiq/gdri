# 🔧 Correction : Erreur de permissions SMTP

## ❌ Problème

Erreur lors de l'envoi d'email :
```
550 5.7.60 SMTP; Client does not have permissions to send as this sender
```

## 🔍 Cause

Cette erreur se produit lorsque :
- `SMTP_FROM` (adresse d'expéditeur) est différente de `SMTP_USER` (adresse d'authentification)
- Les serveurs SMTP (Gmail, Office365, etc.) ne permettent pas d'envoyer depuis une adresse différente de celle utilisée pour l'authentification, sauf si des permissions spéciales sont configurées

## ✅ Solution appliquée

Le code a été modifié pour **utiliser automatiquement `SMTP_USER` comme adresse d'expéditeur** si `SMTP_FROM` n'est pas défini ou est différent.

### Comportement actuel

1. **Si `SMTP_USER` est défini** → Utilisé comme adresse d'expéditeur
2. **Si `SMTP_FROM` est défini ET identique à `SMTP_USER`** → Utilisé
3. **Si `SMTP_FROM` est défini MAIS différent de `SMTP_USER`** → `SMTP_USER` est utilisé (avec avertissement)

## 📝 Configuration recommandée

### Option 1 : Utiliser la même adresse (recommandé)

Dans votre fichier `.env` :
```env
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app
# Ne pas définir SMTP_FROM, ou utiliser la même adresse
SMTP_FROM=votre-email@gmail.com
```

### Option 2 : Ne pas définir SMTP_FROM

```env
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app
# SMTP_FROM non défini → SMTP_USER sera utilisé automatiquement
```

## 🔐 Utiliser une adresse différente (avancé)

Si vous voulez vraiment envoyer depuis une adresse différente (ex: `security@gdri.fr`), vous devez :

### Pour Gmail

1. **Créer un alias** dans Gmail :
   - Allez dans Paramètres Gmail → Comptes et importation
   - Ajoutez une autre adresse email
   - Vérifiez l'adresse

2. **OU utiliser Google Workspace** :
   - Configurez un alias pour votre domaine
   - Autorisez l'envoi depuis cet alias

### Pour Office365

1. Configurez les permissions "Send As" dans l'administration Office365
2. Autorisez votre compte à envoyer depuis l'adresse souhaitée

### Pour autres serveurs SMTP

- Configurez les permissions SMTP dans votre serveur de messagerie
- Autorisez votre compte à utiliser l'adresse `SMTP_FROM`

## 🧪 Tester la correction

Relancez le test :
```powershell
npm run test-security-email
```

L'email devrait maintenant être envoyé avec succès, en utilisant `SMTP_USER` comme adresse d'expéditeur.

## 📧 Vérification

Après l'envoi réussi, vérifiez votre boîte mail :
- L'email devrait arriver
- L'adresse d'expéditeur sera celle de `SMTP_USER`
- Le nom d'affichage sera "GDRI Security Monitor"

## 💡 Note importante

Même si l'adresse d'expéditeur est `SMTP_USER`, le **nom d'affichage** reste "GDRI Security Monitor", ce qui permet d'identifier facilement les alertes de sécurité dans votre boîte mail.
