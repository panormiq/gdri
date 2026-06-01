<?php
<?php
/**
 * FICHIER : modules/ugap/frontend/import/gdri-embed.php
 * RÔLE : Redirection — Import v2 = onglets sous Paramétrage (détection → valider).
 * Le dossier import/ et tab-import.php restent legacy technique, non branchés ici.
 */
header('Location: /frontend/pages/modules/ugap.php?tab=parametrage&param_section=importation', true, 302);
exit;
