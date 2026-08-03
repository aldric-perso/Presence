import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "./useCollection";
import { normalize } from "./ids";
import { todayISO } from "./dates";

const studentsRef = collection(db, "students");

export function useStudents() {
  const q = useMemo(() => query(studentsRef, orderBy("lastName")), []);
  return useCollection(q);
}

/** Élèves actuellement inscrits dans une classe (exclut ceux marqués partis) — pour la prise d'appel. */
export function useStudentsByClass(classId) {
  const q = useMemo(
    () => (classId ? query(studentsRef, where("classId", "==", classId), orderBy("lastName")) : null),
    [classId],
  );
  const result = useCollection(q);
  return { ...result, data: result.data.filter((s) => !s.departedAt) };
}

/**
 * Récupère des élèves par ID, quel que soit leur classe ou statut actuel — utilisé pour
 * reconstruire le roster exact d'un appel passé (record.entries), y compris si l'élève a depuis
 * changé de classe ou est parti.
 */
export function useStudentsByIds(ids) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = (ids || []).join(",");

  useEffect(() => {
    if (!ids || ids.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(ids.map((id) => getDoc(doc(db, "students", id)))).then((snaps) => {
      if (cancelled) return;
      setData(snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() })));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading };
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

export async function createStudent({ firstName, lastName, classId, className, arrivedAt }) {
  const fullName = `${firstName.trim()} ${lastName.trim()}`;
  const since = arrivedAt || todayISO();
  await addDoc(studentsRef, {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    fullName,
    classId,
    arrivedAt: since,
    departedAt: null,
    classHistory: [{ classId, className: className || "", since }],
    createdAt: serverTimestamp(),
  });
}

/** Change la classe d'un élève à une date donnée (par défaut aujourd'hui) et l'ajoute à son historique. */
export async function changeStudentClass(studentId, { classId, className, date }) {
  await updateDoc(doc(db, "students", studentId), {
    classId,
    departedAt: null,
    classHistory: arrayUnion({ classId, className: className || "", since: date || todayISO() }),
  });
}

export async function markStudentDeparted(studentId, date) {
  await updateDoc(doc(db, "students", studentId), { departedAt: date || todayISO() });
}

export async function reactivateStudent(studentId) {
  await updateDoc(doc(db, "students", studentId), { departedAt: null });
}

export async function updateStudentName(studentId, { firstName, lastName }) {
  await updateDoc(doc(db, "students", studentId), {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    fullName: `${firstName.trim()} ${lastName.trim()}`,
  });
}
