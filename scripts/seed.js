// Seed des données de référence (matières, créneaux, seuil par défaut) sur un projet Firebase
// fraîchement créé. Idempotent : peut être relancé sans dupliquer ni écraser des réglages modifiés.
//
// Usage : node scripts/seed.js

import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = new URL("../serviceAccountKey.json", import.meta.url);
if (existsSync(keyPath)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
} else {
  initializeApp({ credential: applicationDefault() });
}

const db = getFirestore();

const SUBJECTS = ["Français", "Mathématiques", "Histoire-Géo", "Anglais", "Sciences", "Arts plastiques"];

const TIME_SLOTS = [
  { id: "c1", label: "09h00 – 09h50", name: "Première séance du matin", order: 1 },
  { id: "c2", label: "10h00 – 10h50", name: "Deuxième séance du matin", order: 2 },
  { id: "c3", label: "11h00 – 11h50", name: "Troisième séance du matin", order: 3 },
  { id: "c4", label: "14h00 – 14h50", name: "Première séance de l'après-midi", order: 4 },
  { id: "c5", label: "15h00 – 15h50", name: "Deuxième séance de l'après-midi", order: 5 },
  { id: "c6", label: "16h00 – 16h50", name: "Séance de soutien", order: 6 },
];

function slug(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    // Supprime les marques diacritiques combinantes (U+0300–U+036F) laissées par normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const subjectsCol = db.collection("subjects");
  for (const name of SUBJECTS) {
    const ref = subjectsCol.doc(slug(name));
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ name, sessionMinutes: 50 });
      console.log("Matière créée :", name);
    }
  }

  const slotsCol = db.collection("timeSlots");
  for (const slot of TIME_SLOTS) {
    const ref = slotsCol.doc(slot.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ label: slot.label, name: slot.name, order: slot.order });
      console.log("Créneau créé :", slot.label);
    }
  }

  const settingsRef = db.collection("settings").doc("general");
  const settingsSnap = await settingsRef.get();
  if (!settingsSnap.exists) {
    await settingsRef.set({ presenceThreshold: 80 });
    console.log("Seuil de présence par défaut initialisé à 80%.");
  }

  console.log("\nSeed terminé.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
