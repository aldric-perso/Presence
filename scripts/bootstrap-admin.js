// Invite le tout premier compte administrateur d'un projet fraîchement déployé : crée
// l'invitation Firestore (aucun compte Authentication, aucun mail envoyé), à réclamer en se
// connectant dans l'appli avec "Se connecter avec Google" via cette adresse.
// Nécessite une clé de compte de service Firebase (serviceAccountKey.json, jamais commitée)
// à la racine du projet, ou la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS.
//
// Usage : node scripts/bootstrap-admin.js "Prénom Nom" email@etablissement.fr

import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [displayName, email] = process.argv.slice(2);

if (!displayName || !email) {
  console.error('Usage : node scripts/bootstrap-admin.js "Prénom Nom" email@etablissement.fr');
  process.exit(1);
}

const keyPath = new URL("../serviceAccountKey.json", import.meta.url);
if (existsSync(keyPath)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
} else {
  initializeApp({ credential: applicationDefault() });
}

const db = getFirestore();

async function main() {
  const id = email.trim().toLowerCase();

  await db.collection("invitations").doc(id).set({
    displayName,
    email,
    role: "admin",
    classIds: [],
    subjectIds: [],
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log("\nInvitation administrateur créée :", displayName, `(${email})`);
  console.log(
    "\nCette personne peut maintenant ouvrir l'appli et cliquer sur « Se connecter avec Google »",
  );
  console.log(`en utilisant l'adresse ${email} — son compte se crée automatiquement.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
