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
- **Backend** : Firebase — Firestore (données), Authentication (email + mot de passe), Cloud
  Functions (opérations sensibles : création de comptes, changement de rôle, validation et
  correction d'un appel), Hosting (déploiement statique).
- **CI/CD** : GitHub Actions, build + déploiement automatique sur `main`.

## Pourquoi des Cloud Functions plutôt que tout en client ?

Firebase Auth ne permet pas de restreindre côté client la création de comptes (n'importe quel
utilisateur authentifié pourrait sinon appeler `createUserWithEmailAndPassword` depuis la console
du navigateur). Comme l'application manipule des données concernant des élèves hospitalisés, les
opérations sensibles passent par des Cloud Functions qui vérifient le rôle admin côté serveur
(claim personnalisé, infalsifiable) avant d'agir :

- `createTeacherAccount` — crée un compte enseignant/admin et renvoie un lien de réinitialisation
  de mot de passe (aucun service d'e-mail tiers requis : c'est le lien natif Firebase Auth, à
  transmettre manuellement).
- `setUserRole` — bascule un compte enseignant ↔ administrateur (protège contre la suppression du
  dernier admin).
- `submitAttendanceRecord` — valide et verrouille un appel (vérifie l'absence de doublon de façon
  atomique, signe avec l'identité de l'appelant).
- `correctAttendanceRecord` — corrige un appel verrouillé (admin uniquement, motif obligatoire,
  historique conservé).

Ces fonctions nécessitent le plan **Blaze** (paiement à l'usage) sur le projet Firebase — le tarif
gratuit inclus (2 millions d'appels/mois) couvre très largement l'usage d'un établissement.

## Mise en route

### 1. Créer le projet Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → *Ajouter un projet*.
2. Passer au plan **Blaze** (Paramètres du projet → Utilisation et facturation).
3. **Authentication** → Sign-in method → activer *E-mail/Mot de passe*.
4. **Firestore Database** → créer une base (mode production), choisir une région proche de
   l'établissement.
5. **Hosting** → activer (pas besoin de suivre l'assistant, on déploiera via CLI/CI).
6. **Paramètres du projet** → Général → *Vos applications* → ajouter une application Web → copier
   la config SDK.

### 2. Configuration locale

```bash
npm install
cp .env.example .env.local
```

Renseigner `.env.local` avec la config SDK copiée à l'étape précédente.

Mettre à jour `.firebaserc` avec l'ID du projet (remplace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`),
ou lancer :

```bash
npx firebase-tools use --add
```

### 3. Compte de service (pour les scripts d'administration)

Console Firebase → Paramètres du projet → Comptes de service → *Générer une nouvelle clé privée*.
Enregistrer le fichier téléchargé à la racine du projet sous le nom `serviceAccountKey.json`
(déjà exclu de git par `.gitignore` — **ne jamais le committer**).

### 4. Déployer les règles, indexes et fonctions

```bash
npx firebase-tools deploy --only firestore,functions
```

### 5. Seed des données de référence

Matières, créneaux horaires et seuil de présence par défaut :

```bash
npm run seed
```

### 6. Créer le premier compte administrateur

```bash
npm run bootstrap-admin "Prénom Nom" email@etablissement.fr
```

Le script affiche un lien de réinitialisation de mot de passe à usage unique : transmets-le à la
personne concernée pour qu'elle définisse son mot de passe et se connecte.

Les comptes suivants se créent ensuite directement depuis l'application, dans *Paramètres →
Enseignants & admins*.

### 7. Lancer l'application

```bash
npm run dev
```

### 8. Déployer le frontend

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

Le workflow `.github/workflows/deploy.yml` construit et déploie l'application à chaque push sur
`main`. Secrets à configurer dans *Settings → Secrets and variables → Actions* du repo GitHub :

| Secret | Contenu |
| --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Config SDK web (identique à `.env.local`) |
| `FIREBASE_PROJECT_ID` | ID du projet Firebase |
| `FIREBASE_SERVICE_ACCOUNT` | Contenu JSON complet de la clé de compte de service (étape 3) |

## Modèle de données (Firestore)

- `classes/{id}` — nom, unité de soins, enseignant référent, `archived`.
- `subjects/{id}` — nom, durée de séance en minutes (50 par défaut).
- `students/{id}` — prénom, nom, classe.
- `timeSlots/{id}` — créneaux horaires fixes (gérés par `scripts/seed.js`).
- `users/{uid}` — profil enseignant/admin (le rôle réel est porté par un *custom claim* Firebase
  Auth, mirroré ici pour l'affichage).
- `settings/general` — réglages (seuil d'alerte de présence).
- `attendanceRecords/{date_classId_subjectId_timeSlotId}` — un appel verrouillé et signé. L'ID
  déterministe garantit l'unicité au niveau base de données. Écriture exclusivement via Cloud
  Functions ; lecture ouverte à tout utilisateur connecté.

Les règles de sécurité (`firestore.rules`) s'appuient sur le custom claim `role` pour distinguer
administrateurs et enseignants — jamais sur un champ Firestore modifiable côté client.

## Choix de périmètre (v1)

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
functions/           Cloud Functions (Admin SDK)
scripts/             scripts d'administration (seed, bootstrap-admin)
firestore.rules      règles de sécurité
firestore.indexes.json
firebase.json
```
