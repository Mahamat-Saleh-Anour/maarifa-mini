# Maarifa Mini

Gestion scolaire simple et multi-établissement : élèves, familles et tuteurs, mensualités, reçus et audit des caisses.

- **Hébergement gratuit** : site statique sur Vercel, base de données et comptes sur Supabase.
- **Sécurité par établissement** : seuls le Fondateur et les Administrateurs d'une école voient et modifient ses données. La règle est appliquée par la base elle-même (Row Level Security), pas seulement par l'écran.
- **Argent protégé** : un encaissement ne passe que par une fonction serveur qui vérifie les montants dus. Les reçus ne sont jamais supprimés : on les annule avec un motif.
- **Audit inaltérable** : chaque encaissement et chaque annulation est enregistré (qui, quoi, combien, quand, motif). Personne ne peut modifier ni effacer ces lignes, pas même le Fondateur.

## Rôles

| Rôle | Ce qu'il peut faire |
|---|---|
| **Super-admin** (vous) | Crée les établissements et leur Fondateur. Ne voit **pas** les élèves, familles ni paiements des écoles. |
| **Fondateur** | Tout dans son école, plus la gestion des comptes : ajouter, désactiver, changer le rôle, réinitialiser un mot de passe. |
| **Administrateur** | Les mêmes droits que le Fondateur sur les élèves, familles, paiements, annulations et paramètres. Il ne gère pas les comptes. |

Un même compte peut travailler pour plusieurs écoles et choisit l'école en haut de l'écran.

## Nouveautés de la version 2

- **Années scolaires** : chaque année a ses classes, ses mensualités, ses frais d'inscription et ses mois. On choisit l'année dans la barre latérale ; les anciennes années restent consultables avec leurs impayés.
- **Frais d'inscription** : fixés par classe et par année, payables en une ou plusieurs fois, sur le même reçu que les mensualités. Réduction ou exonération possible par élève.
- **Abandons** : un élève qui part en cours d'année est déclaré avec sa date et son motif. Les mois suivants ne sont plus dus ; ce qu'il devait avant reste à recouvrer.
- **Réinscription** : à la rentrée, les élèves actifs de l'année précédente sont réinscrits en un clic, avec la classe suivante proposée.
- **Rapports annuels** : chiffre d'affaires par année (inscriptions et mensualités), attendu, reste à recouvrer, taux, abandons et manque à gagner, détail par mois et par classe.

### Mettre à jour une installation de la version 1

1. Dans Supabase, ouvrez **SQL Editor > New query**, collez tout le nouveau `supabase/schema.sql` et cliquez sur **Run**. Le script convertit les données existantes : une année scolaire par établissement (reprise de ses classes et de ses mois), une inscription par élève, et tous les reçus rattachés à cette année. Il peut être relancé sans risque.
2. Vercel redéploie l'application automatiquement après le push sur GitHub.
3. Dans l'application, ouvrez **Paramètres > Classes et frais** et saisissez les frais d'inscription de chaque classe (0 par défaut).

La fonction `manage-users` n'a pas changé : inutile de la redéployer.

## Interface

- **Tableau de bord** : encaissements du mois et du jour, reste à recouvrer, taux de recouvrement, graphiques (attendu / encaissé par mois, 30 derniers jours, reste par classe), familles les plus en retard, derniers reçus. Graphiques : [Chart.js](https://www.chartjs.org/) 4.4.4 chargé depuis jsDelivr.
- **Adaptée à tous les écrans** : barre latérale fixe sur ordinateur, menu tiroir sur tablette et téléphone, listes affichées en cartes et fenêtres en volet bas sur téléphone.
- **Thème clair, sombre ou automatique** (menu du compte).
- **Mon compte** : profil, établissements et rôles ; le changement de mot de passe s'ouvre dans une fenêtre séparée et demande le mot de passe actuel.

## Structure

```
index.html, styles.css, app.js   l'application (aucune compilation nécessaire)
config.js                        adresse et clé publique de votre projet Supabase
vercel.json                      en-têtes de sécurité du site
supabase/schema.sql              tables, règles d'accès, fonctions de paiement, audit (v2, relançable)
supabase/seed_cszi.sql           données initiales du CSZI (fiche papier 2025-2026)
supabase/functions/manage-users  gestion des écoles et des comptes (Edge Function)
.github/workflows/keepalive.yml  (optionnel) évite la mise en pause du projet gratuit
```

---

## Installation pas à pas

### 1. Créer le projet Supabase

1. Créez un compte sur <https://supabase.com>, puis **New project**.
2. Notez le mot de passe de la base dans un endroit sûr.
3. Pour la région, choisissez la plus proche de vous (par exemple *Frankfurt* ou *Paris*).

### 2. Créer la base

1. Ouvrez **SQL Editor > New query**.
2. Collez tout le contenu de `supabase/schema.sql`, puis cliquez sur **Run**.
3. *(Facultatif)* Pour charger les familles et élèves du CSZI, faites de même avec `supabase/seed_cszi.sql`.

### 3. Régler l'authentification

Dans **Authentication** :

- **Sign In / Providers > Email** :
  - désactivez **Allow new users to sign up**. Seuls vous et les Fondateurs créez des comptes.
  - laissez **Confirm email** tel quel ; les comptes créés par l'application sont déjà confirmés.
- **Policies / Passwords** : longueur minimale **8**.
- **URL Configuration > Site URL** : mettez l'adresse Vercel une fois connue (étape 6).

### 4. Déployer la fonction de gestion des comptes

**Méthode simple, depuis le navigateur :**

1. Ouvrez **Edge Functions > Deploy a new function > Via Editor**.
2. Nommez-la exactement `manage-users`.
3. Collez le contenu de `supabase/functions/manage-users/index.ts`, puis cliquez sur **Deploy**.

**Méthode en ligne de commande :**

```bash
npx supabase login
npx supabase link --project-ref VOTRE_REF
npx supabase functions deploy manage-users
```

La clé `service_role` est fournie automatiquement à la fonction par Supabase. **Ne la copiez jamais dans `config.js` ni dans GitHub.**

### 5. Créer votre compte super-admin

1. Ouvrez **Authentication > Users > Add user > Create new user**.
2. Saisissez votre e-mail et un mot de passe solide, et cochez **Auto Confirm User**.
3. Dans **SQL Editor**, exécutez :

```sql
update public.profiles
   set is_superadmin = true, must_change_password = false, full_name = 'Votre nom'
 where email = 'votre@email.com';
```

### 6. Mettre le site en ligne avec Vercel

1. Dans `config.js`, remplacez `SUPABASE_URL` et `SUPABASE_ANON_KEY`. Les valeurs sont dans **Project Settings > API** : *Project URL* et clé *anon public*.
2. Poussez le code sur GitHub.
3. Sur <https://vercel.com>, cliquez sur **Add New > Project**, puis importez le dépôt :
   - *Framework* : **Other** ;
   - aucune commande de build ;
   - cliquez sur **Deploy**.
4. Reportez l'adresse obtenue (`https://….vercel.app`) dans Supabase, à la rubrique **Site URL**.

### 7. Premier démarrage

1. Connectez-vous avec le compte super-admin, puis ouvrez l'onglet **Plateforme** :
   - pour une nouvelle école : **+ Nouvel établissement** (nom, période des mois, Fondateur) ;
   - pour le CSZI chargé à l'étape 2 : **+ Fondateur** sur sa ligne.
2. Remettez le mot de passe provisoire au Fondateur en main propre. Il devra le changer à sa première connexion.
3. Le Fondateur ajoute ses Administrateurs dans l'onglet **Utilisateurs**.

---

## Comment fonctionnent les paiements

- **Encaisser** :
  - on choisit la famille et on saisit le montant reçu ;
  - « Répartir » remplit d'abord les mois impayés les plus anciens.
- **Contrôles du serveur** : avant d'enregistrer, le serveur vérifie que :
  - chaque élève appartient bien à la famille ;
  - le mois est actif ;
  - le montant ne dépasse pas le reste dû.
- **Numéro de reçu** : il est attribué par le serveur (R-00001, R-00002…), sans trou ni doublon.
- **Annuler** :
  - le motif est obligatoire (5 caractères minimum) ;
  - le reçu reste visible, barré ;
  - les mois redeviennent impayés ;
  - l'audit garde l'encaissement d'origine **et** l'annulation.
- **Audit des caisses** : filtrez par période, utilisateur ou opération. Un tableau récapitule, pour chaque personne, le nombre d'encaissements, les montants encaissés, les montants annulés et le net.

## Sécurité : ce qui est garanti et ce qui ne l'est pas

**Garanti par la base :**

- Isolation entre écoles.
- Visiteurs non connectés sans aucun accès.
- Écriture directe impossible dans les reçus, les lignes de paiement et l'audit.
- Suppression impossible d'un élève ou d'une famille qui a des paiements.
- Déconnexion automatique après 30 minutes d'inactivité (réglable dans `config.js`).

**À savoir :**

- **Accès du propriétaire Supabase** : la personne qui possède le projet garde un accès technique total à la base, depuis le tableau de bord Supabase. Protégez ce compte avec la double authentification (*Account > Security*).
- **Super-admin** : il ne peut pas se rattacher lui-même à une école. Il pourrait toutefois créer un second compte avec une autre adresse : c'est une question de confiance envers la personne qui gère la plateforme.
- **Désactivation** : un compte désactivé perd l'accès aux données immédiatement, même s'il reste connecté.

## Limites du plan gratuit

- **Mise en pause** : Supabase met en pause un projet gratuit après 7 jours sans activité. Une école qui utilise l'application chaque jour n'est pas concernée. Sinon, activez `.github/workflows/keepalive.yml` : dans GitHub, ajoutez les secrets `SUPABASE_URL` et `SUPABASE_ANON_KEY` (*Settings > Secrets and variables > Actions*).
- **Sauvegardes** : le plan gratuit ne fournit pas de sauvegarde téléchargeable. Exportez régulièrement les CSV (Tableau, Élèves, Reçus, Audit). Vous pouvez aussi faire une copie complète :
  ```bash
  npx supabase db dump --data-only -f sauvegarde.sql
  ```

## Développement local

```bash
npx serve .      # ou : python3 -m http.server 8080
```

Puis ouvrez `http://localhost:3000` (ou `:8080`).
