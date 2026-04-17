# Module IA – Frontend

Le backoffice du module IA est **dans ce dossier** ; l’app utilisateur (front) reste optionnelle.

---

## Backoffice (dans le module)

Toutes les pages d’admin IA sont sous **`modules/ia/frontend/backoffice/`** :

| Fichier      | Rôle |
|-------------|------|
| `bootstrap.php` | Charge config, DB, session, JWT (racine projet `GDRI_ROOT`). |
| `config.php`    | Config globale legacy (service, modèle, clés). |
| `llms.php`      | CRUD des LLMs par entité. |
| `rights.php`    | Droits LLM par utilisateur. |

**Accès depuis le front principal** : des **wrappers** dans `frontend/pages/modules/` font un simple `require` vers ces fichiers, sans symlink ni Alias Apache :

- `frontend/pages/modules/ia-config.php` → `require .../modules/ia/frontend/backoffice/config.php`
- `frontend/pages/modules/ia-llms.php` → `require .../modules/ia/frontend/backoffice/llms.php`
- `frontend/pages/modules/ia-llm-rights.php` → `require .../modules/ia/frontend/backoffice/rights.php`

Les URLs restent donc **inchangées** (ex. `/gdri/frontend/pages/modules/ia-llms.php`). Le document root Apache reste le front ; aucun accès direct à `modules/` n’est nécessaire.

---

## Front (app utilisateur)

Pour l’instant **vide** : le module IA est une brique infrastructure ; les autres modules (analyse-intention, chat, doc-template, etc.) consomment l’API IA. Une future page « app » (ex. playground) pourrait être ajoutée dans `frontend/app/` ou référencée ici.
