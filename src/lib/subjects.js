import { useMemo } from "react";
import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "./useCollection";
import { normalize } from "./ids";

const subjectsRef = collection(db, "subjects");

export const SESSION_MINUTES = 50;

export function useSubjects() {
  const q = useMemo(() => query(subjectsRef, orderBy("name")), []);
  return useCollection(q);
}

export function findDuplicateSubject(subjects, name) {
  const key = normalize(name);
  return subjects.find((s) => normalize(s.name) === key) || null;
}

export async function createSubject(name) {
  await addDoc(subjectsRef, {
    name: name.trim(),
    sessionMinutes: SESSION_MINUTES,
    createdAt: serverTimestamp(),
  });
}

/**
 * Retire aussi la matière des affectations de tout enseignant qui l'avait cochée : sans ça, un
 * enseignant garde un ID de matière fantôme dans son profil (compté dans le récapitulatif mais
 * invisible dans l'éditeur d'affectations, puisque celui-ci ne liste que les matières existantes).
 */
export async function removeSubject(subjectId) {
  const affected = await getDocs(
    query(collection(db, "users"), where("subjectIds", "array-contains", subjectId)),
  );
  await Promise.all(affected.docs.map((d) => updateDoc(d.ref, { subjectIds: arrayRemove(subjectId) })));
  await deleteDoc(doc(db, "subjects", subjectId));
}
