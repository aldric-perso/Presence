import { useMemo } from "react";
import {
  addDoc,
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "./useCollection";
import { normalize } from "./ids";

const classesRef = collection(db, "classes");

export function useClasses({ includeArchived = false } = {}) {
  const q = useMemo(
    () =>
      includeArchived
        ? query(classesRef, orderBy("name"))
        : query(classesRef, where("archived", "==", false), orderBy("name")),
    [includeArchived],
  );
  return useCollection(q);
}

export function findDuplicateClass(classes, name) {
  const key = normalize(name);
  return classes.find((c) => normalize(c.name) === key) || null;
}

export async function createClass({ name, referentId, referentName }) {
  await addDoc(classesRef, {
    name: name.trim(),
    referentId: referentId || null,
    referentName: referentName || "—",
    archived: false,
    createdAt: serverTimestamp(),
  });
}

export async function archiveClass(classId) {
  await updateDoc(doc(db, "classes", classId), { archived: true });
}
