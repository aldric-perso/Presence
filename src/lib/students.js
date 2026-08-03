import { useMemo } from "react";
import { addDoc, collection, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "./useCollection";
import { normalize } from "./ids";

const studentsRef = collection(db, "students");

export function useStudents() {
  const q = useMemo(() => query(studentsRef, orderBy("lastName")), []);
  return useCollection(q);
}

export function useStudentsByClass(classId) {
  const q = useMemo(
    () => (classId ? query(studentsRef, where("classId", "==", classId), orderBy("lastName")) : null),
    [classId],
  );
  return useCollection(q);
}

/** Détecte un homonyme probable : même clé normalisée sur "prénom nom" ou "nom prénom". */
export function findDuplicateStudent(students, firstName, lastName) {
  const key = normalize(firstName + lastName);
  if (key.length < 4) return null;
  return (
    students.find((s) => normalize(s.firstName + s.lastName) === key) ||
    students.find((s) => normalize(s.lastName + s.firstName) === key) ||
    null
  );
}

export async function createStudent({ firstName, lastName, classId }) {
  const fullName = `${firstName.trim()} ${lastName.trim()}`;
  await addDoc(studentsRef, {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    fullName,
    classId,
    createdAt: serverTimestamp(),
  });
}
