import { useMemo } from "react";
import { addDoc, collection, deleteDoc, doc, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "./useCollection";

const timeSlotsRef = collection(db, "timeSlots");

export function useTimeSlots() {
  const q = useMemo(() => query(timeSlotsRef, orderBy("order")), []);
  return useCollection(q);
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
