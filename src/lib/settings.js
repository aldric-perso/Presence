import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, DEFAULT_SEUIL } from "../firebase";

const settingsDoc = doc(db, "settings", "general");

export const DEFAULT_ABSENCE_REASONS = [
  { label: "Soins / examen", justified: true },
  { label: "Consultation externe", justified: true },
  { label: "État de santé", justified: true },
  { label: "Sortie autorisée", justified: true },
  { label: "Non justifié", justified: false },
];

export const DEFAULT_LATE_REASONS = [
  { label: "Soins prolongés", justified: true },
  { label: "Transport interne", justified: true },
  { label: "Kinésithérapie", justified: true },
  { label: "Réveil tardif", justified: false },
  { label: "Non justifié", justified: false },
];

export const DEFAULT_PARTIAL_REASONS = [
  { label: "Aménagement d'horaire prévu au carnet de soins", justified: true },
  { label: "Rythme d'accueil thérapeutique", justified: true },
];

export const DEFAULT_LATE_MINUTE_CHOICES = [5, 10, 15, 30];
export const DEFAULT_PARTIAL_MINUTE_CHOICES = [10, 20, 30, 40];

const DEFAULT_SETTINGS = {
  presenceThreshold: DEFAULT_SEUIL,
  absenceReasons: DEFAULT_ABSENCE_REASONS,
  lateReasons: DEFAULT_LATE_REASONS,
  partialReasons: DEFAULT_PARTIAL_REASONS,
  lateMinuteChoices: DEFAULT_LATE_MINUTE_CHOICES,
  partialMinuteChoices: DEFAULT_PARTIAL_MINUTE_CHOICES,
};

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(settingsDoc, (snap) => {
      setSettings({ ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) });
      setLoading(false);
    });
  }, []);

  return { settings, loading };
}

export async function updateSettings(patch) {
  await setDoc(settingsDoc, patch, { merge: true });
}

/** Map "libellé du motif" -> justifié, combinant motifs de retard et d'absence. */
export function buildReasonsLookup(settings) {
  const map = new Map();
  for (const r of settings.absenceReasons || []) map.set(r.label, r.justified);
  for (const r of settings.lateReasons || []) map.set(r.label, r.justified);
  for (const r of settings.partialReasons || []) map.set(r.label, r.justified);
  return map;
}
