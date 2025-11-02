# Guide d'installation - GDRI

## Prérequis

- **XAMPP** installé avec PHP 8.0+
- **Windows 10/11**

## Étape 1 : Installation de Composer

1. **Télécharger Composer**
   - Rendez-vous sur : https://getcomposer.org/Composer-Setup.exe
   - Téléchargez l'installateur Windows

2. **Installer Composer**
   - Lancez `Composer-Setup.exe`
   - L'installateur détectera automatiquement PHP dans XAMPP
   - Suivez les instructions à l'écran
   - Laissez les options par défaut

3. **Vérifier l'installation**
   - Ouvrez PowerShell
   - Tapez : `composer --version`
   - Vous devriez voir la version de Composer installée

## Étape 2 : Installation de MongoDB

1. **Télécharger MongoDB Community Server**
   - Rendez-vous sur : https://www.mongodb.com/try/download/community
   - Téléchargez la version Windows
   - Choisissez "MSI" comme package

2. **Installer MongoDB**
   - Lancez l'installateur MSI
   - Choisissez "Complete" installation
   - Cochez "Install MongoDB as a Service"
   - Gardez les paramètres par défaut

3. **Vérifier que MongoDB fonctionne**
   - Ouvrez PowerShell en tant qu'administrateur
   - Tapez : `mongod --version`
   - MongoDB devrait être installé et en cours d'exécution

## Étape 3 : Installation de l'extension MongoDB pour PHP

1. **Télécharger l'extension**
   - Rendez-vous sur : https://pecl.php.net/package/mongodb
   - Téléchargez le fichier DLL correspondant à votre version de PHP
   - Exemple : `php_mongodb-1.17.0-8.2-ts-vs16-x64.zip`

2. **Installer l'extension**
   - Extrayez le fichier `php_mongodb.dll`
   - Copiez-le dans : `C:\xampp\php\ext\`

3. **Activer l'extension**
   - Ouvrez : `C:\xampp\php\php.ini`
   - Ajoutez la ligne : `extension=mongodb`
   - Sauvegardez le fichier

4. **Redémarrer Apache**
   - Ouvrez le Control Panel XAMPP
   - Arrêtez Apache
   - Redémarrez Apache

5. **Vérifier l'installation**
   - Créez un fichier `test.php` avec :
     ```php
     <?php phpinfo(); ?>
     ```
   - Ouvrez-le dans le navigateur
   - Recherchez "mongodb" dans la page
   - Vous devriez voir la section MongoDB

## Étape 4 : Installation des dépendances du projet

1. **Ouvrir PowerShell**
   - Naviguez vers le dossier du projet :
     ```powershell
     cd C:\xampp\htdocs\gdri
     ```

2. **Installer les dépendances**
   ```powershell
   composer install
   ```

3. **Attendre la fin de l'installation**
   - Composer va télécharger et installer le driver MongoDB PHP

## Étape 5 : Configuration du logo

1. **Copier le logo**
   - Copiez votre logo depuis :
     `C:\Users\guyvarchc\Documents\programation\front_end\public\logo-gdri.png`
   - Vers :
     `C:\xampp\htdocs\gdri\assets\images\logo-gdri.png`

## Étape 6 : Initialisation de la base de données

1. **Lancer le script d'initialisation**
   - Ouvrez un navigateur
   - Allez sur : `http://localhost/gdri/install/init-db.php`
   - Suivez les instructions à l'écran
   - Notez bien les identifiants de l'admin GDRI créé

## Étape 7 : Test du site

1. **Démarrer Apache dans XAMPP**

2. **Accéder au site**
   - Ouvrez un navigateur
   - Allez sur : `http://localhost/gdri/`

3. **Tester la connexion**
   - Cliquez sur "Connexion"
   - Utilisez les identifiants de l'admin GDRI créés lors de l'initialisation

## Dépannage

### Composer ne se lance pas
- Redémarrez votre PowerShell
- Vérifiez que PHP est dans le PATH système

### MongoDB ne démarre pas
- Vérifiez les services Windows (Win + R → `services.msc`)
- Cherchez "MongoDB" et vérifiez qu'il est démarré

### L'extension MongoDB n'est pas chargée
- Vérifiez que le fichier DLL correspond à votre version de PHP
- Vérifiez la ligne dans php.ini (pas de `;` devant)
- Redémarrez Apache

### Erreur de connexion à MongoDB
- Vérifiez que MongoDB est bien démarré
- Vérifiez le port (27017 par défaut)
- Consultez les logs : `C:\Program Files\MongoDB\Server\6.0\log\`

## Support

En cas de problème, contactez :
- **Email** : contact@gdr-innovation.fr
- **Téléphone** : 06 84 28 63 47





