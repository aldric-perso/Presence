# Présences — Cahier d'appel

Application de suivi de présence pour un établissement scolaire organisé par classes et unités de
soins. Un enseignant prend l'appel d'une classe pour une matière et un créneau donnés ; l'appel,
une fois validé, est verrouillé et signé. Un administrateur gère les classes, matières, comptes
enseignants, et peut seul corriger un appel verrouillé (avec motif obligatoire, tracé au journal).

Conçue à partir d'une maquette réalisée avec Claude Design (`Feuille de présence.dc.html`,
conservée dans `Downloads/Application de feuille de présences/` à titre de référence).

## Stack technique

- **Frontend** : React 18 + Vite, React Router, CSS Modules (aucun framework CSS — design system
  maison proche de la maquette).
- **Backend** : Firebase — Firestore (données), Authentication (email + mot de passe), Hosting
  (déploiement statique). **Aucune Cloud Function** : tout fonctionne sur le plan gratuit **Spark**,
  aucune carte bancaire à renseigner.
- **CI/CD** : GitHub Actions, build + déploiement automatique sur `main`.

## Comment la sécurité fonctionne sans Cloud Functions

Sans Cloud Functions, chaque écriture Firestore vient directement du navigateur — la sécurité est
donc entièrement portée par `firestore.rules` :

- Le rôle (`admin` / `teacher`) vit uniquement dans le document `users/{uid}`, jamais dans un champ
  qu'on pourrait confondre avec une donnée de confort. Les règles vérifient ce rôle en lisant ce
  document (`get()`), pas un custom claim (qui nécessiterait l'Admin SDK, donc une Cloud Function).
- **Création de compte enseignant** (*Paramètres → Enseignants*) : le code crée le compte
  Authentication via une instance Firebase secondaire, pour ne pas déconnecter l'admin en cours de
  session, puis écrit le profil `users/{uid}` (autorisé uniquement si l'appelant est admin), puis
  déclenche un e-mail de réinitialisation de mot de passe — un service natif et gratuit de Firebase
  Auth, sans extension payante.
- **Unicité d'un appel** : l'ID du document (`date_classeId_matiereId_creneauId`) est déterministe.
  Firestore classe automatiquement une écriture en `create` ou `update` selon qu'un document
  existait déjà à ce chemin — et les règles n'autorisent la création qu'à cette seule condition.
  Résultat : deux enseignants ne peuvent jamais enregistrer le même appel deux fois, sans code
  serveur ni transaction à écrire.
- **Correction d'un appel verrouillé** : seul un admin peut modifier `entries`/`corrections` d'un
  appel existant ; toute autre écriture sur ce document est refusée par les règles.

**Limite assumée** : sans Admin SDK server-side, on ne peut pas empêcher un utilisateur qui
inspecterait le code de la page d'appeler lui-même `createUserWithEmailAndPassword` (la config
Firebase d'une appli web est de toute façon toujours publique). Un tel compte "sauvage" resterait
cependant sans profil `users/{uid}` — donc sans aucun accès aux données, tous les écrans et
règles exigeant `hasProfile()`. De même, la protection "on ne peut pas retirer le dernier admin"
n'est qu'un garde-fou côté client (les règles Firestore ne peuvent pas compter des documents) —
un risque très faible pour une petite équipe de confiance, mais à connaître.

## Mise en route (sur ton projet Firebase existant)

### 1. Vérifier les services activés

Sur [console.firebase.google.com](https://console.firebase.google.com), dans ton projet :

1. **Authentication** → Sign-in method → activer *E-mail/Mot de passe* si ce n'est pas déjà fait.
2. **Firestore Database** → vérifier qu'une base existe (mode production).
3. **Hosting** → activer si besoin (pas besoin de suivre l'assistant, on déploiera via CLI/CI).

Le plan **Spark** (gratuit) suffit très largement pour tout ça.

### 2. Configuration locale

```bash
npm install
cp .env.example .env.local
```

Renseigner `.env.local` avec la config SDK web de ton projet (Paramètres du projet → Général →
Vos applications → Config SDK).

`.firebaserc` pointe déjà vers `feuille-de-presence-5c35a`. Si ce n'est pas le bon ID, remplace-le
ou lance `npx firebase-tools use --add`.

### 3. Compte de service (pour les scripts d'administration, en local uniquement)

Console Firebase → Paramètres du projet → Comptes de service → *Générer une nouvelle clé privée*.
Enregistrer le fichier téléchargé à la racine du projet sous le nom `serviceAccountKey.json`
(déjà exclu de git par `.gitignore` — **ne jamais le committer**). Ces scripts tournent sur ta
machine avec l'Admin SDK ; ce n'est pas une Cloud Function et ça ne nécessite pas le plan Blaze.

### 4. Repartir d'une base propre (si l'ancienne version doit être effacée)

Le script liste par défaut ce qu'il trouve sans rien supprimer (dry run) :

```bash
node scripts/reset-firestore.js
```

Une fois la liste vérifiée, relance avec `--yes` pour effacer réellement (irréversible) :

```bash
node scripts/reset-firestore.js --yes
```

### 5. Déployer les règles et les indexes

```bash
npx firebase-tools deploy --only firestore
```

### 6. Seed des données de référence

Matières, créneaux horaires et seuil de présence par défaut :

```bash
npm run seed
```

### 7. Créer le premier compte administrateur

```bash
npm run bootstrap-admin "Prénom Nom" email@etablissement.fr
```

Le script affiche un lien de réinitialisation de mot de passe à usage unique : transmets-le à la
personne concernée pour qu'elle définisse son mot de passe et se connecte.

Les comptes suivants se créent ensuite directement depuis l'application, dans *Paramètres →
Enseignants & admins*.

#### Si l'e-mail Firebase n'arrive pas (ac-*.fr, numericable.fr, ...)

Firebase Auth envoie les e-mails (création de compte, "mot de passe oublié") depuis un domaine
générique (`noreply@<projet>.firebaseapp.com`). Ça passe très bien sur Gmail, mais certains domaines
avec des filtres anti-spam stricts — académies (`ac-*.fr`), FAI comme numericable.fr — le bloquent
ou le mettent en quarantaine, faute de SPF/DKIM propres à ce domaine. L'appli tente quand même
l'envoi automatique à chaque fois (ça marche pour une partie des comptes), mais si un enseignant ne
reçoit rien (après vérification des spams), génère-lui un lien manuellement :

```bash
npm run generate-reset-link -- email@ac-xxx.fr
```

Le script affiche un lien de réinitialisation à usage unique, à transmettre à la personne par le
canal de ton choix (ton propre e-mail, etc.). Ça fonctionne aussi bien juste après la création d'un
compte que pour un "mot de passe oublié" resté sans réponse — dans les deux cas c'est le même souci
de délivrabilité, donc le même contournement.

#### ⚠️ Ne jamais supprimer un enseignant, une matière ou une classe directement dans Firestore

L'appli ne permet pas de vraiment supprimer un compte enseignant (seul le rôle/l'activation se
changent depuis *Paramètres → Enseignants*) ni une classe (archivage uniquement). Une matière, elle,
peut être retirée depuis l'appli — ce qui nettoie automatiquement les affectations des enseignants
qui l'avaient cochée.

Si tu supprimes un document directement dans la console Firestore au lieu de passer par l'appli, ça
casse ce nettoyage :
- **Enseignant supprimé dans `users`** : son compte Authentication (identifiants de connexion)
  survit. Recréer la personne depuis l'appli échoue alors avec « Un compte existe déjà avec cette
  adresse e-mail ». Pour le débloquer :
  ```bash
  npm run delete-orphan-account -- email@etablissement.fr
  ```
  Le script refuse de supprimer le compte s'il a encore un profil Firestore actif (sécurité), donc
  il n'est utile qu'après une suppression manuelle de ce genre.
- **Matière supprimée dans `subjects`** : les enseignants qui l'avaient cochée gardent un ID de
  matière fantôme dans leur profil — visible comme un nombre incohérent dans le récapitulatif
  (« 1 matière » alors que l'éditeur d'affectations n'affiche rien). Rouvrir l'éditeur d'affectations
  de cet enseignant et cliquer sur n'importe quelle case suffit à nettoyer l'ID fantôme au passage.

### 8. Lancer l'application

```bash
npm run dev
```

### 9. Déployer le frontend

```bash
npm run build
npx firebase-tools deploy --only hosting
```

## Émulateurs Firebase (développement sans toucher au projet réel)

```bash
npm run emulators
```

Puis dans `.env.local`, passer `VITE_USE_EMULATORS=true` avant de lancer `npm run dev`.

## CI/CD (GitHub Actions)

> **⚠️ État actuel (2026-08) : le déploiement automatique GitHub → Firebase ne fonctionne pas.**
> Après chaque `git push` sur `main`, il faut donc déployer manuellement en local :
> ```bash
> npm run build
> firebase deploy --only hosting,firestore --project feuille-de-presence-5c35a
> ```
> (nécessite d'être connecté avec `firebase login` sur le compte ayant accès au projet). Ne pas
> considérer un push seul comme suffisant tant que ce point n'est pas rouvert/corrigé.

Le workflow `.github/workflows/deploy.yml` construit et déploie l'application (Hosting + règles
Firestore) à chaque push sur `main`. Secrets à configurer dans *Settings → Secrets and variables →
Actions* du repo GitHub :

| Secret | Contenu |
| --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Config SDK web (identique à `.env.local`) |
| `FIREBASE_PROJECT_ID` | ID du projet Firebase |
| `FIREBASE_SERVICE_ACCOUNT` | Contenu JSON complet de la clé de compte de service (étape 3) |

## Modèle de données (Firestore)

- `classes/{id}` — nom, unité de soins, enseignant référent, `archived`.
- `subjects/{id}` — nom, durée de séance en minutes (50 par défaut).
- `students/{id}` — prénom, nom, classe actuelle, `arrivedAt`/`departedAt` (dates), `classHistory`
  (historique des classes avec date d'effet).
- `timeSlots/{id}` — créneaux horaires fixes (gérés par `scripts/seed.js`).
- `users/{uid}` — profil enseignant/admin ; **le rôle réel est ce champ Firestore**, protégé par les
  règles (seul un admin peut le modifier) — pas de custom claim.
- `settings/general` — réglages (seuil d'alerte de présence).
- `attendanceRecords/{date_classId_subjectId_timeSlotId}` — un appel verrouillé et signé. L'ID
  déterministe garantit l'unicité au niveau base de données (cf. section sécurité ci-dessus).

## Import/export Excel des élèves

*Paramètres → Élèves* permet d'exporter la liste actuelle en `.xlsx` et d'en importer une nouvelle
version. Colonnes attendues à l'import : **Prénom**, **Nom**, **Classe** (doit correspondre à une
classe existante), **Arrivé(e) le** et **Parti(e) le** (optionnelles, formats `JJ/MM/AAAA` ou date
Excel).

Avant toute écriture, un écran de revue présente le diff face à la base actuelle :
- un nom absent de la base → nouvel élève (arrivée = date de l'import si non précisée) ;
- un nom existant dont la classe diffère → décision demandée (changement de classe avec date, ou
  doublon à ignorer) ;
- un élève actif absent du fichier importé → considéré parti à la date de l'import.

Rien n'est écrit tant que l'admin n'a pas confirmé l'écran de revue.

## Choix de périmètre (v1)

- Pas de Cloud Functions ni de plan Blaze : tout est pensé pour rester gratuit (cf. section
  sécurité ci-dessus pour les compromis que ça implique).
- Pas d'emploi du temps récurrent par enseignant : l'accueil affiche les appels du jour déjà
  enregistrés dans l'établissement plutôt qu'une liste "à faire" fictive (la maquette ne fournissait
  pas d'écran pour construire un tel planning).
- Pas de stockage de fichiers (Firebase Storage non utilisé) — aucune pièce jointe dans le
  périmètre actuel.
- Les créneaux horaires sont fixes et gérés par script ; pas d'interface d'édition en v1.

## Structure du projet

```
src/
  components/ui/     composants réutilisables (Button, Pill, Modal, Ring, ...)
  components/        Nav, Layout, garde-fous de routes
  context/           contexte d'authentification
  lib/               accès Firestore, logique métier (attendance, ids, dates...)
  pages/             écrans de l'application
  pages/settings/    onglets de la page Paramètres
scripts/             scripts d'administration (seed, bootstrap-admin, reset-firestore)
firestore.rules      règles de sécurité
firestore.indexes.json
firebase.json
```
