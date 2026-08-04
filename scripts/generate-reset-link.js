// Génère un lien de réinitialisation de mot de passe pour un compte existant, sans passer par
// l'envoi d'e-mail automatique de Firebase — utile quand l'e-mail Firebase n'arrive pas (certains
// domaines comme ac-*.fr ou numericable.fr le filtrent). L'admin transmet ce lien lui-même par le
// canal de son choix, que ce soit juste après une création de compte ou suite à un "mot de passe
// oublié" resté sans réponse.
//
// Nécessite une clé de compte de service Firebase (serviceAccountKey.json, jamais commitée)
// à la racine du projet, ou la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS.
//
// Usage : node scripts/generate-reset-link.js email@etablissement.fr

import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email] = process.argv.slice(2);

if (!email) {
  console.error("Usage : node scripts/generate-reset-link.js email@etablissement.fr");
  process.exit(1);
}

const keyPath = new URL("../serviceAccountKey.json", import.meta.url);
if (existsSync(keyPath)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
} else {
  initializeApp({ credential: applicationDefault() });
}

const auth = getAuth();

async function main() {
  await auth.getUserByEmail(email); // échoue clairement si le compte n'existe pas
  const resetLink = await auth.generatePasswordResetLink(email);

  console.log(`\nLien de réinitialisation pour ${email} (à usage unique, transmets-le en privé) :`);
  console.log(resetLink);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
