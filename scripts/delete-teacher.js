// Supprime complètement un compte enseignant/admin : le profil Firestore (users/{uid}) ET le
// compte Firebase Authentication associé, dans le bon ordre, sans laisser de trace orpheline —
// contrairement à une suppression manuelle dans la console Firestore (qui ne supprime que le
// profil et laisse le compte Authentication actif, cf. scripts/delete-orphan-account.js).
//
// Refuse de supprimer le dernier compte administrateur (même garde-fou que setUserRole côté appli).
//
// Nécessite une clé de compte de service Firebase (serviceAccountKey.json, jamais commitée)
// à la racine du projet, ou la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS.
//
// Usage : node scripts/delete-teacher.js email@etablissement.fr

import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [email] = process.argv.slice(2);

if (!email) {
  console.error("Usage : node scripts/delete-teacher.js email@etablissement.fr");
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
  const profileRef = db.collection("users").doc(userRecord.uid);
  const profile = await profileRef.get();

  if (profile.exists && profile.data().role === "admin") {
    const admins = await db.collection("users").where("role", "==", "admin").get();
    if (admins.size === 1) {
      console.error("Refus : c'est le dernier compte administrateur — supprime-le après en avoir créé un autre.");
      process.exit(1);
    }
  }

  if (profile.exists) {
    await profileRef.delete();
    console.log(`Profil Firestore supprimé (users/${userRecord.uid}).`);
  } else {
    console.log("Aucun profil Firestore à supprimer (déjà absent).");
  }

  await auth.deleteUser(userRecord.uid);
  console.log(`Compte Authentication supprimé pour ${email}.`);
  console.log("Cette personne n'a plus aucun accès à l'application.");
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
