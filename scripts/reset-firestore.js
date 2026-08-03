// Supprime TOUTES les collections Firestore du projet (utile pour repartir d'une base propre
// avant de déployer la nouvelle structure sur un projet qui contenait une ancienne version).
//
// Par défaut : DRY RUN, ne supprime rien, liste seulement ce qui serait effacé.
//   node scripts/reset-firestore.js
//
// Pour effacer réellement (irréversible) :
//   node scripts/reset-firestore.js --yes
//
// Nécessite une clé de compte de service Firebase (serviceAccountKey.json, jamais commitée)
// à la racine du projet, ou la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS.

import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const confirmed = process.argv.includes("--yes");

const keyPath = new URL("../serviceAccountKey.json", import.meta.url);
if (existsSync(keyPath)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
} else {
  initializeApp({ credential: applicationDefault() });
}

const db = getFirestore();

async function deleteCollection(collectionRef) {
  const snap = await collectionRef.get();
  if (snap.empty) return 0;

  const batchSize = 400;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = db.batch();
    snap.docs.slice(i, i + batchSize).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += Math.min(batchSize, snap.docs.length - i);
  }
  return deleted;
}

async function main() {
  const collections = await db.listCollections();

  if (collections.length === 0) {
    console.log("Aucune collection trouvée — la base est déjà vide.");
    return;
  }

  console.log(confirmed ? "Suppression en cours :\n" : "Aperçu (dry run — rien ne sera supprimé) :\n");

  for (const col of collections) {
    const snap = await col.get();
    console.log(`  - ${col.id} : ${snap.size} document(s)`);
  }

  if (!confirmed) {
    console.log("\nRelance avec --yes pour supprimer réellement ces collections.");
    return;
  }

  console.log("");
  for (const col of collections) {
    const count = await deleteCollection(col);
    console.log(`Supprimé : ${col.id} (${count} document(s))`);
  }
  console.log("\nBase Firestore réinitialisée.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
