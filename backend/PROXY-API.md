# Proxy Apache vers le backend Node (éviter 404 sur /api/ia/...)

Le frontend appelle `https://votre-domaine/api/ia/server/health` (et autres routes `/api/*`).  
Cette URL doit être servie par le **backend Node (Express)**, pas par Apache/PHP.

Si vous avez **404** sur `/api/ia/server/health` alors que BackendIA (Python, :8000) tourne bien :

- Le navigateur envoie la requête à Apache.
- Apache ne connaît pas `/api/*` → 404.
- Il faut que Apache **proxifie** `/api` vers le processus Node (souvent port 3000).

## Configuration Apache (vhost)

Dans le VirtualHost qui sert le site (ex. `gdri` ou `gdr-innovation.fr`), ajoutez :

```apache
# Proxy /api vers le backend Node (port 3000)
ProxyPreserveHost On
ProxyPass /api http://127.0.0.1:3000/api
ProxyPassReverse /api http://127.0.0.1:3000/api
```

Puis activer les modules et redémarrer Apache :

```bash
sudo a2enmod proxy proxy_http
sudo systemctl restart apache2
```

## Vérification

1. Démarrer le backend Node : `node server.js` (dans `backend/`, port 3000).
2. Depuis le navigateur ou curl : `https://www.gdr-innovation.fr/api/health`  
   → doit retourner du JSON (status, modules), pas 404.

Une fois le proxy en place, le bouton « Tester » sur la page IA pourra appeler le Node, qui lui-même appellera BackendIA (Python) à l’URL configurée.
