# Copier vers config.ps1 et adapter (config.ps1 est gitignore).
# Utilise par remote\pull-test.ps1 et remote\pull-prod.ps1
#
# Avec VPN local SoftEther (SecureNAT), l'IP serveur est souvent 192.168.30.1
# Avec WireGuard, utilise l'IP du tunnel (ex. 10.6.0.1)
# En LAN uniquement (meme Wi‑Fi) : IP locale du serveur (ex. 192.168.1.20)

@{
    ServerHost = '192.168.30.1'
    ServerUser = 'guyvarchc'
    UpdateScript = 'C:\xampp\htdocs\gdri\demarrage\Update-From-Git.ps1'
    RestartBackend = $true
}
