// Crée le tout premier compte administrateur d'un projet fraîchement déployé.
// Nécessite une clé de compte de service Firebase (serviceAccountKey.json, jamais commitée)
// à la racine du projet, ou la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS.
//
// Usage : node scripts/bootstrap-admin.js "Prénom Nom" email@etablissement.fr

import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import crypto from "node:crypto";

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

const auth = getAuth();
const db = getFirestore();

async function main() {
  const temporaryPassword = crypto.randomBytes(24).toString("base64url");

  const userRecord = await auth.createUser({
    email,
    password: temporaryPassword,
    displayName,
  });

  await db.collection("users").doc(userRecord.uid).set({
    displayName,
    email,
    role: "admin",
    classIds: [],
    subjectIds: [],
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  const resetLink = await auth.generatePasswordResetLink(email);

  console.log("\nCompte administrateur créé :", displayName, `(${email})`);
  console.log("\nLien pour définir le mot de passe (à usage unique, transmets-le en privé) :");
  console.log(resetLink);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
