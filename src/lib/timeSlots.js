import { useMemo } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "./useCollection";

const timeSlotsRef = collection(db, "timeSlots");

/** Les créneaux horaires sont fixes pour l'établissement — gérés via le script de seed, lecture seule ici. */
export function useTimeSlots() {
  const q = useMemo(() => query(timeSlotsRef, orderBy("order")), []);
  return useCollection(q);
}
