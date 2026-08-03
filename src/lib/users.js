import { useMemo } from "react";
import { collection, doc, orderBy, query, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { useCollection } from "./useCollection";
import { normalize } from "./ids";

const usersRef = collection(db, "users");

export function useTeachers() {
  const q = useMemo(() => query(usersRef, orderBy("displayName")), []);
  return useCollection(q);
}

export function findDuplicateTeacher(teachers, displayName) {
  const key = normalize(displayName);
  return teachers.find((t) => normalize(t.displayName) === key) || null;
}

/** Crée le compte Auth + le profil Firestore côté serveur, renvoie un lien de réinitialisation à transmettre. */
export async function createTeacherAccount({ displayName, email, role, classIds, subjectIds }) {
  const call = httpsCallable(functions, "createTeacherAccount");
  const res = await call({ displayName, email, role, classIds, subjectIds });
  return res.data; // { uid, resetLink }
}

export async function setUserRole(uid, role) {
  const call = httpsCallable(functions, "setUserRole");
  await call({ uid, role });
}

export async function updateTeacherAssignments(uid, { classIds, subjectIds }) {
  await updateDoc(doc(db, "users", uid), { classIds, subjectIds });
}
