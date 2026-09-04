import { useMemo } from "react";
import { addDoc, collection, deleteDoc, doc, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "./useCollection";

const timeSlotsRef = collection(db, "timeSlots");

/** Minutes depuis minuit de l'heure de début d'un créneau, ex. "17h00 – 17h50" -> 1020. Infinity si non reconnu. */
export function startMinutes(label) {
  const m = /(\d{1,2})h(\d{2})?/.exec(label || "");
  if (!m) return Infinity;
  return Number(m[1]) * 60 + Number(m[2] || 0);
}

/** Trie une liste de créneaux par heure de début croissante (les libellés non reconnus vont en fin de liste). */
export function sortTimeSlots(slots) {
  return [...slots].sort((a, b) => startMinutes(a.label) - startMinutes(b.label));
}

/**
 * Durée en minutes d'un créneau "17h - 17h50" / "09h00 – 09h50", à partir des deux premières
 * heures repérées dans le libellé. Retourne null si le format n'est pas reconnu (moins de deux
 * heures trouvées, ou heure de fin non postérieure à l'heure de début) — c'est cette durée qui
 * sert de base au calcul du taux de présence (cf. submitAttendanceRecord dans attendance.js).
 */
export function durationMinutes(label) {
  const matches = [...(label || "").matchAll(/(\d{1,2})h(\d{2})?/g)];
  if (matches.length < 2) return null;
  const toMinutes = (m) => Number(m[1]) * 60 + Number(m[2] || 0);
  const start = toMinutes(matches[0]);
  const end = toMinutes(matches[1]);
  if (end <= start) return null;
  return end - start;
}

export function formatDuration(minutes) {
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

export function useTimeSlots() {
  const q = useMemo(() => query(timeSlotsRef, orderBy("order")), []);
  const result = useCollection(q);
  return useMemo(() => ({ ...result, data: sortTimeSlots(result.data) }), [result]);
}

export async function createTimeSlot(label, existingSlots) {
  const order = existingSlots.reduce((max, s) => Math.max(max, s.order || 0), 0) + 1;
  await addDoc(timeSlotsRef, { label: label.trim(), order });
}

export async function updateTimeSlotLabel(slotId, label) {
  await updateDoc(doc(db, "timeSlots", slotId), { label: label.trim() });
}

export async function deleteTimeSlot(slotId) {
  await deleteDoc(doc(db, "timeSlots", slotId));
}
