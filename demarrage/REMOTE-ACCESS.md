# Accès distant GDRI — VPN local (chez toi)

Objectif : un collab rejoint **ton réseau** via un VPN hébergé sur ton serveur, puis lance les scripts d’update.  
**Pas de Tailscale** — tout reste chez toi.

```
Collab ──Internet──► Box (port VPN) ──► SoftEther/WireGuard sur ton PC
                                              │
                                              ├─ IP locale (ex. 192.168.30.x)
                                              ├─ SSH / Bureau à distance
                                              └─ demarrage\10-update-*.bat
```

## Recommandation : SoftEther VPN Server (Windows)

Gratuit, GUI, tourne bien sur un PC Windows + XAMPP.

### 1. Sur le serveur (chez toi)

1. Télécharger **SoftEther VPN Server** :  
   https://www.softether.org/5-download  
   → Component: *SoftEther VPN Server* / Platform: *Windows*
2. Installer → ouvrir **SoftEther VPN Server Manager** → Connect `localhost`
3. Assistant **Remote Access VPN Server**
4. Créer un **Virtual Hub** (ex. `GDRI`)
5. Activer **SecureNAT** (DHCP virtuel pour les clients)
6. Créer un **utilisateur** + mot de passe fort (un par collab)
7. Option simple clients Windows : activer **L2TP/IPsec** + *pre-shared key* forte  
   ou utiliser le client SoftEther VPN (SSL-VPN, souvent plus simple derrière NAT)

### 2. Sur la box Internet

Ouvre **un seul** port vers le PC serveur (IP fixe LAN recommandée) :

| Protocole SoftEther | Port typique | Usage |
|---|---|---|
| SSL-VPN (recommandé) | **443** TCP (ou 5555) | Client SoftEther |
| L2TP/IPsec | **500/4500** UDP + **1701** | VPN natif Windows |

Si le 443 est déjà pris par Apache/HTTPS public, utilise **5555/TCP** (défaut SoftEther) en redirection box → PC.

### 3. Activer SSH sur le serveur (une fois)

```text
demarrage\20-enable-remote-access.bat   (Admin)
```

Ça active OpenSSH + firewall **profil Privé** (réseau VPN / LAN).

### 4. PC collab

1. Installer [SoftEther VPN Client](https://www.softether.org/5-download)  
   (ou VPN Windows L2TP si tu as activé IPsec)
2. Se connecter avec user/mdp (+ clé IPsec si L2TP)
3. Une fois connecté, le serveur est joignable en IP VPN (souvent `192.168.30.1` avec SecureNAT — à vérifier dans SoftEther)

Puis soit :

- **Bureau à distance** vers cette IP → double-clic `10-update-test.bat`  
- **SSH** :

```powershell
ssh USER@192.168.30.1 "powershell -File C:\xampp\htdocs\gdri\demarrage\Update-From-Git.ps1 -Target Test -RestartBackend"
```

### 5. Config scripts distants

```powershell
cd C:\xampp\htdocs\gdri\demarrage\remote
copy config.example.ps1 config.ps1
# ServerHost = IP VPN du serveur (ex. 192.168.30.1)
# ServerUser = compte Windows
```

Puis :

- `.\pull-test.ps1`
- `.\pull-prod.ps1`

## Alternative : WireGuard local

Si tu préfères WireGuard pur :

- **Wg Server for Windows** : https://github.com/micahmo/WgServerforWindows  
- Ouvrir **UDP 51820** sur la box → ton PC  
- Distribuer un fichier `.conf` à chaque collab  

Même suite ensuite : SSH / RDP / `remote\pull-*.ps1` avec l’IP du tunnel WireGuard.

## Sécurité

- Mot de passe VPN **fort**, un compte par personne
- Ne pas exposer RDP (3389) ni SSH (22) **directement** sur Internet — seulement derrière le VPN
- Garder Windows à jour
- IP LAN fixe pour le serveur (réservation DHCP box)

## Sans accès distant

Les updates restent possibles **sur place** :

- `demarrage\10-update-test.bat`
- `demarrage\11-update-prod.bat`
