# Configuration SSL/HTTPS pour GDRI

## Prérequis
- ✅ Port 80 redirigé (déjà fait)
- ✅ Port 443 redirigé (déjà fait)
- ✅ Domaine pointe vers votre IP (déjà fait)

## Option 1 : Certbot (Let's Encrypt) - Recommandé

### Installation Certbot pour Windows

1. **Télécharger Certbot** :
   - https://github.com/certbot/certbot/releases/latest
   - Cherchez : `certbot-beta-installer-win_amd64_signed.exe`
   - Ou direct : https://dl.eff.org/certbot-beta-installer-win_amd64_signed.exe

2. **Installer Certbot** :
   - Double-cliquez sur l'installateur
   - Suivez l'assistant

3. **Générer le certificat** :
   
   Ouvrez PowerShell en **Administrateur** et tapez :
   ```powershell
   certbot certonly --standalone --preferred-challenges http -d www.gdr-innovation.fr -d gdr-innovation.fr -d www.gdri.fr -d gdri.fr
   ```

   ⚠️ **IMPORTANT** : Arrêtez Apache avant de lancer cette commande !
   (Certbot a besoin du port 80 temporairement)

4. **Suivez les instructions** :
   - Entrez votre email
   - Acceptez les conditions
   - Le certificat sera généré dans : `C:\Certbot\live\www.gdr-innovation.fr\`

### Fichiers générés par Let's Encrypt

Les certificats seront ici :
```
C:\Certbot\live\www.gdr-innovation.fr\
├── fullchain.pem  (certificat complet)
├── privkey.pem    (clé privée)
├── cert.pem       (certificat seul)
└── chain.pem      (chaîne de certificats)
```

## Configuration Apache pour SSL

Après génération du certificat, il faut configurer Apache.

### Étape 1 : Activer SSL dans Apache

Ouvrir : `C:\xampp\apache\conf\httpd.conf`

Décommenter ces lignes (enlever le #) :
```apache
LoadModule ssl_module modules/mod_ssl.so
Include conf/extra/httpd-ssl.conf
LoadModule socache_shmcb_module modules/mod_socache_shmcb.so
```

### Étape 2 : Configurer le Virtual Host SSL

Créer/éditer : `C:\xampp\apache\conf\extra\httpd-ssl.conf`

Ou ajouter dans `httpd-vhosts.conf` :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"
    
    SSLEngine on
    SSLCertificateFile "C:/Certbot/live/www.gdr-innovation.fr/cert.pem"
    SSLCertificateKeyFile "C:/Certbot/live/www.gdr-innovation.fr/privkey.pem"
    SSLCertificateChainFile "C:/Certbot/live/www.gdr-innovation.fr/chain.pem"
    
    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog "logs/gdri-ssl-error.log"
    CustomLog "logs/gdri-ssl-access.log" common
</VirtualHost>
```

### Étape 3 : Redirection HTTP vers HTTPS

Dans le Virtual Host port 80, ajouter une redirection :

```apache
<VirtualHost *:80>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    
    # Redirection vers HTTPS
    Redirect permanent / https://www.gdr-innovation.fr/
</VirtualHost>
```

### Étape 4 : Redémarrer Apache

Dans XAMPP Control Panel : Stop puis Start Apache.

## Renouvellement automatique

Les certificats Let's Encrypt expirent tous les 90 jours.

Pour renouveler automatiquement, créez une tâche planifiée Windows :
```powershell
certbot renew --quiet
```

À exécuter tous les mois.

## Test

Après configuration, testez :
- https://www.gdr-innovation.fr
- Vérifiez le cadenas vert dans le navigateur

## Vérification SSL

Testez la configuration SSL sur :
- https://www.ssllabs.com/ssltest/

## Troubleshooting

**Erreur "Port 80 already in use"** :
- Arrêtez Apache avant de lancer certbot

**Certificat non reconnu** :
- Vérifiez les chemins des fichiers .pem
- Redémarrez Apache

**Erreur de validation** :
- Vérifiez que le port 80 est bien ouvert et redirigé
- Vérifiez que le DNS pointe vers votre IP



