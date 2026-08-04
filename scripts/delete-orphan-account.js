// Supprime un compte Firebase Authentication "orphelin" : créé via cette appli, puis dont le
// profil users/{uid} a été supprimé directement dans la console Firestore (au lieu de passer par
// l'appli, qui ne permet pas de vraiment supprimer un enseignant — allow delete: if false). Le
// compte Auth, lui, survit à cette suppression et bloque toute recréation avec la même adresse
// e-mail (auth/email-already-in-use). Par sécurité, ce script refuse de supprimer un compte qui a
// encore un profil Firestore actif.
//
// Nécessite une clé de compte de service Firebase (serviceAccountKey.json, jamais commitée)
// à la racine du projet, ou la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS.
//
// Usage : node scripts/delete-orphan-account.js email@etablissement.fr

import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [email] = process.argv.slice(2);

if (!email) {
  console.error("Usage : node scripts/delete-orphan-account.js email@etablissement.fr");
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
  const userRecord = await auth.getUserByEmail(email);
  const profile = await db.collection("users").doc(userRecord.uid).get();

  if (profile.exists) {
    console.error(
      `Refus : ${email} a encore un profil Firestore actif (users/${userRecord.uid}). ` +
        "Ce compte n'est pas orphelin — ce script ne le supprime pas.",
    );
    process.exit(1);
  }

  await auth.deleteUser(userRecord.uid);
  console.log(`Compte Authentication supprimé pour ${email} (uid: ${userRecord.uid}).`);
  console.log("L'adresse e-mail est de nouveau disponible pour créer un compte depuis l'appli.");
}

main().then(
  () => process.exit(0),
  (err) => {
    if (err.code === "auth/user-not-found") {
      console.error(`Aucun compte Authentication trouvé pour ${email} — rien à supprimer.`);
    } else {
      console.error(err);
    }
    process.exit(1);
  },
);
