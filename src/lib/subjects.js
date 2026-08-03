import { useMemo } from "react";
import { addDoc, collection, deleteDoc, doc, orderBy, query, serverTimestamp } from "firebase/firestore";
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

export async function removeSubject(subjectId) {
  await deleteDoc(doc(db, "subjects", subjectId));
}
