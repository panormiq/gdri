# Ajout de la configuration anti-SYN flood dans httpd.conf

## 📍 Où ajouter la configuration

Dans votre fichier `C:\xampp\apache\conf\httpd.conf`, ajoutez cette ligne **à la fin du fichier**, juste avant la dernière ligne :

```apache
# Protection Anti-SYN Flood (pour tous les VirtualHosts)
Include "C:/xampp/htdocs/gdri/install/apache-syn-flood-config.conf"
```

## 📝 Emplacement exact

Ajoutez cette ligne **après** la section AJP13 Proxy (vers la fin du fichier), par exemple :

```apache
# AJP13 Proxy
<IfModule mod_proxy.c>
<IfModule mod_proxy_ajp.c>
Include "conf/extra/httpd-ajp.conf"
</IfModule>
</IfModule>

# ============================================
# PROTECTION ANTI-SYN FLOOD
# ============================================
# Protection contre les attaques SYN flood
# S'applique à TOUS les VirtualHosts (GDRI, LostInGame, etc.)
Include "C:/xampp/htdocs/gdri/install/apache-syn-flood-config.conf"
```

## ⚠️ Note importante

Vous avez déjà une section de protection dans votre `httpd.conf` :

```apache
# ============================================
# PROTECTION ANTI-DDOS ET SECURITE
# ============================================
```

Notre configuration est **plus stricte** et **spécifique pour les SYN flood** :
- Timeout de handshake : **3 secondes** (au lieu de 20-40)
- Timeout global : **3 secondes** (au lieu de 30)
- Limitation des connexions simultanées
- Configuration MPM optimisée

**Les deux configurations peuvent coexister**, mais notre config anti-SYN flood prendra le dessus pour les paramètres qu'elle définit.

## ✅ Vérification

Après avoir ajouté la ligne, testez la syntaxe Apache :

```powershell
C:\xampp\apache\bin\httpd.exe -t
```

Si vous voyez `Syntax OK` → ✅ Configuration valide

Puis redémarrez Apache depuis le XAMPP Control Panel.

## 🎯 Résultat

Une fois ajouté, **tous vos VirtualHosts** (GDRI, LostInGame, etc.) seront protégés contre les SYN flood au niveau Apache.


