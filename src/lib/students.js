import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";
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

/**
 * Suppression définitive — réservée à la correction d'une erreur de saisie (ex. doublon créé par
 * mégarde). Si l'élève a déjà été noté dans un appel, son nom disparaîtra de ces appels passés et
 * de ses statistiques de présence : pour un élève qui a réellement quitté l'établissement, préférer
 * markStudentDeparted.
 */
export async function deleteStudent(studentId) {
  await deleteDoc(doc(db, "students", studentId));
}

/**
 * Fusionne deux fiches élève créées par erreur pour la même personne (ex. faute de frappe sur le
 * nom). Toutes les entrées d'appel du doublon sont réattribuées à l'élève cible ; si un appel
 * contenait déjà une entrée pour les deux (les deux fiches existaient au moment de la prise
 * d'appel), l'entrée du doublon est retirée et celle de la cible conservée. Chaque appel modifié
 * reçoit une correction tracée. Le doublon est ensuite supprimé définitivement.
 */
export async function mergeStudents({ duplicateId, duplicateName, targetId, targetName, records }) {
  const affected = records.filter((r) => (r.entries || []).some((e) => e.studentId === duplicateId));

  const actorSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
  const actorName = actorSnap.exists() ? actorSnap.data().displayName : auth.currentUser.email;
  const reason = `Fusion : « ${duplicateName} » → « ${targetName} »`;

  const CHUNK = 400;
  for (let i = 0; i < affected.length; i += CHUNK) {
    const batch = writeBatch(db);
    affected.slice(i, i + CHUNK).forEach((record) => {
      const hasTarget = record.entries.some((e) => e.studentId === targetId);
      const nextEntries = hasTarget
        ? record.entries.filter((e) => e.studentId !== duplicateId)
        : record.entries.map((e) => (e.studentId === duplicateId ? { ...e, studentId: targetId } : e));
      batch.update(doc(db, "attendanceRecords", record.id), {
        entries: nextEntries,
        corrections: arrayUnion({
          by: auth.currentUser.uid,
          byName: actorName,
          at: new Date().toISOString(),
          reason,
        }),
      });
    });
    await batch.commit();
  }

  await deleteDoc(doc(db, "students", duplicateId));
  return { recordsUpdated: affected.length };
}
