import { useEffect, useMemo, useState } from "react";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { useCollection } from "./useCollection";
import { attendanceRecordId, initialsOf } from "./ids";
import { todayISO, isoDaysAgo } from "./dates";
import { durationMinutes } from "./timeSlots";

const recordsRef = collection(db, "attendanceRecords");

export const STATUS = { PRESENT: "present", PARTIAL: "partiel", LATE: "retard", ABSENT: "absent", NA: "na" };

/** Fenêtre pendant laquelle l'auteur d'un appel peut le corriger/supprimer sans passer par un admin. */
export const EDIT_WINDOW_DAYS = 7;

/** Un appel dont la date de séance remonte à 7 jours ou moins reste modifiable par son auteur. */
export function isEditableByAuthor(recordDate) {
  return recordDate >= isoDaysAgo(EDIT_WINDOW_DAYS);
}

export function useTodayRecords() {
  const q = useMemo(
    () => query(recordsRef, where("date", "==", todayISO()), orderBy("createdAt", "desc")),
    [],
  );
  return useCollection(q);
}

export function useAllRecords() {
  const q = useMemo(() => query(recordsRef, orderBy("createdAt", "desc")), []);
  return useCollection(q);
}

export function useAttendanceRecord(recordId) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    return onSnapshot(doc(db, "attendanceRecords", recordId), (snap) => {
      setRecord(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
  }, [recordId]);

  return { record, loading };
}

export function useClassRecords(classId) {
  const q = useMemo(
    () => (classId ? query(recordsRef, where("classId", "==", classId)) : null),
    [classId],
  );
  return useCollection(q);
}

/** Clé unique à générer une fois par ouverture de feuille d'appel (cf. attendanceRecordId). */
export function newAttemptKey() {
  return doc(recordsRef).id;
}

/**
 * Appels non supprimés déjà enregistrés à une date et un créneau donnés (toutes classes/matières).
 * Simple aide à l'UX : ils ne bloquent rien, on s'en sert pour afficher un avertissement.
 */
export async function findRecordsAtSlot({ date, timeSlotId }) {
  const snap = await getDocs(query(recordsRef, where("date", "==", date), where("timeSlotId", "==", timeSlotId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => !r.deleted);
}

function validateEntries(entries, sessionMinutes) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("La liste des élèves est vide.");
  }
  for (const e of entries) {
    if (!e.studentId || !Object.values(STATUS).includes(e.status)) {
      throw new Error("Statut d'élève invalide.");
    }
    if (e.status !== STATUS.PRESENT && e.status !== STATUS.NA && !e.reason?.trim()) {
      throw new Error("Un motif est requis pour tout élève non présent.");
    }
    if (e.status === STATUS.LATE && (!Number.isFinite(e.minutesMissed) || e.minutesMissed <= 0 || e.minutesMissed >= sessionMinutes)) {
      throw new Error("Durée de retard invalide.");
    }
    if (e.status === STATUS.PARTIAL && (!Number.isFinite(e.minutesPresent) || e.minutesPresent <= 0 || e.minutesPresent >= sessionMinutes)) {
      throw new Error("Durée de présence partielle invalide.");
    }
  }
}

function cleanEntries(entries, sessionMinutes) {
  return entries.map((e) => ({
    studentId: e.studentId,
    status: e.status,
    minutesMissed:
      e.status === STATUS.PRESENT || e.status === STATUS.PARTIAL || e.status === STATUS.NA
        ? 0
        : e.status === STATUS.ABSENT
          ? sessionMinutes
          : e.minutesMissed,
    minutesPresent: e.status === STATUS.PARTIAL ? e.minutesPresent : null,
    reason: e.status === STATUS.PRESENT || e.status === STATUS.NA ? null : e.reason.trim(),
  }));
}

/**
 * Sans Cloud Function (plan Spark gratuit), l'écriture se fait directement depuis le client.
 * Plusieurs appels peuvent exister sur la même date+classe+matière+créneau (élèves particuliers
 * répartis entre deux appels). Seul le renvoi d'un MÊME envoi est rejeté : l'ID du document
 * contient `attemptKey` et les règles n'autorisent un "create" que si le document n'existait
 * pas encore.
 */
export async function submitAttendanceRecord({ date, classId, subjectId, timeSlotId, attemptKey, entries }) {
  const [classSnap, subjectSnap, timeSlotSnap, authorSnap] = await Promise.all([
    getDoc(doc(db, "classes", classId)),
    getDoc(doc(db, "subjects", subjectId)),
    getDoc(doc(db, "timeSlots", timeSlotId)),
    getDoc(doc(db, "users", auth.currentUser.uid)),
  ]);
  if (!classSnap.exists() || !subjectSnap.exists() || !timeSlotSnap.exists()) {
    throw new Error("Classe, matière ou créneau introuvable.");
  }

  const timeSlotLabel = timeSlotSnap.data().label;
  const sessionMinutes = durationMinutes(timeSlotLabel) || 50;
  validateEntries(entries, sessionMinutes);

  const recordId = attendanceRecordId({ date, classId, subjectId, timeSlotId, attemptKey });

  try {
    await setDoc(doc(db, "attendanceRecords", recordId), {
      date,
      classId,
      className: classSnap.data().name,
      subjectId,
      subjectName: subjectSnap.data().name,
      sessionMinutes,
      timeSlotId,
      timeSlotLabel,
      authorId: auth.currentUser.uid,
      authorName: authorSnap.data().displayName,
      entries: cleanEntries(entries, sessionMinutes),
      locked: true,
      corrections: [],
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    if (err.code === "permission-denied") {
      throw Object.assign(
        new Error("Cet appel a déjà été enregistré."),
        { code: "already-exists" },
      );
    }
    throw err;
  }

  return { id: recordId };
}

/**
 * Corrige un appel verrouillé (admin uniquement, appliqué par les règles Firestore). `at` est une
 * chaîne ISO générée côté client : les sentinelles serverTimestamp() ne sont pas résolues à
 * l'intérieur des éléments d'un arrayUnion.
 */
export async function correctAttendanceRecord({ recordId, entries, reason }) {
  if (!reason?.trim()) {
    throw new Error("Un motif de correction est requis.");
  }

  const [recordSnap, authorSnap] = await Promise.all([
    getDoc(doc(db, "attendanceRecords", recordId)),
    getDoc(doc(db, "users", auth.currentUser.uid)),
  ]);
  const sessionMinutes = recordSnap.data()?.sessionMinutes || 50;
  validateEntries(entries, sessionMinutes);

  await updateDoc(doc(db, "attendanceRecords", recordId), {
    entries: cleanEntries(entries, sessionMinutes),
    corrections: arrayUnion({
      by: auth.currentUser.uid,
      byName: authorSnap.data().displayName,
      at: new Date().toISOString(),
      reason: reason.trim(),
    }),
  });

  return { id: recordId };
}

/**
 * Supprime "en douceur" un appel : le document n'est jamais réellement effacé (les règles
 * Firestore interdisent tout `delete`), il est marqué `deleted` et garde un motif tracé, comme une
 * correction. Il reste donc visible dans le registre — avec la pastille « Supprimé » — mais ses
 * entrées sont exclues des statistiques de présence (cf. computeStudentStats).
 */
export async function deleteAttendanceRecord({ recordId, reason }) {
  if (!reason?.trim() || reason.trim().length <= 4) {
    throw new Error("Le motif de suppression doit être détaillé.");
  }

  const authorSnap = await getDoc(doc(db, "users", auth.currentUser.uid));

  await updateDoc(doc(db, "attendanceRecords", recordId), {
    deleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: auth.currentUser.uid,
    deletedByName: authorSnap.data().displayName,
    deletedReason: reason.trim(),
  });

  return { id: recordId };
}

/**
 * Calcule, pour chaque élève, les minutes dues/vues, le taux de présence global et par matière,
 * ainsi que l'historique des absences/retards — à partir des appels verrouillés déjà enregistrés.
 */
export function computeStudentStats({ students, records, seuil, reasonsLookup = new Map() }) {
  const byStudent = new Map(
    students.map((s) => [
      s.id,
      {
        student: s,
        minutesDue: 0,
        minutesSeen: 0,
        nbAbs: 0,
        nbAbsJustifiee: 0,
        nbAbsNonJustifiee: 0,
        nbRet: 0,
        nbRetJustifie: 0,
        nbRetNonJustifie: 0,
        nbPartiel: 0,
        bySubject: new Map(),
        absences: [],
      },
    ]),
  );

  const sortedRecords = records.filter((r) => !r.deleted).sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const record of sortedRecords) {
    const sessionMinutes = record.sessionMinutes || 50;
    for (const entry of record.entries || []) {
      const agg = byStudent.get(entry.studentId);
      if (!agg) continue;
      if (entry.status === STATUS.NA) continue;

      const due = sessionMinutes;
      const seen =
        entry.status === STATUS.PRESENT
          ? sessionMinutes
          : entry.status === STATUS.LATE
            ? Math.max(0, sessionMinutes - (entry.minutesMissed || 0))
            : entry.status === STATUS.PARTIAL
              ? entry.minutesPresent || 0
              : 0;

      agg.minutesDue += due;
      agg.minutesSeen += seen;
      const justified = reasonsLookup.get(entry.reason) ?? false;
      if (entry.status === STATUS.ABSENT) {
        agg.nbAbs += 1;
        if (justified) agg.nbAbsJustifiee += 1;
        else agg.nbAbsNonJustifiee += 1;
      }
      if (entry.status === STATUS.LATE) {
        agg.nbRet += 1;
        if (justified) agg.nbRetJustifie += 1;
        else agg.nbRetNonJustifie += 1;
      }
      if (entry.status === STATUS.PARTIAL) agg.nbPartiel += 1;

      if (entry.status === STATUS.LATE || entry.status === STATUS.ABSENT) {
        agg.absences.push({
          date: record.date,
          subject: record.subjectName || "—",
          reason: entry.reason || "—",
          minutesMissed: entry.status === STATUS.ABSENT ? sessionMinutes : entry.minutesMissed || 0,
          justified,
        });
      }

      const subjKey = record.subjectId;
      if (!agg.bySubject.has(subjKey)) {
        agg.bySubject.set(subjKey, { name: record.subjectName || "—", sessions: 0, due: 0, seen: 0 });
      }
      const subjAgg = agg.bySubject.get(subjKey);
      subjAgg.sessions += 1;
      subjAgg.due += due;
      subjAgg.seen += seen;
    }
  }

  return [...byStudent.values()].map((agg) => {
    const pct = agg.minutesDue ? Math.round((agg.minutesSeen / agg.minutesDue) * 100) : 100;
    return {
      ...agg.student,
      initials: initialsOf(agg.student.fullName),
      minutesDue: agg.minutesDue,
      minutesSeen: agg.minutesSeen,
      pct,
      color: colorForPct(pct, seuil),
      nbAbs: agg.nbAbs,
      nbAbsJustifiee: agg.nbAbsJustifiee,
      nbAbsNonJustifiee: agg.nbAbsNonJustifiee,
      nbRet: agg.nbRet,
      nbRetJustifie: agg.nbRetJustifie,
      nbRetNonJustifie: agg.nbRetNonJustifie,
      nbPartiel: agg.nbPartiel,
      absences: agg.absences.slice(0, 8),
      subjects: [...agg.bySubject.values()].map((s) => ({
        ...s,
        pct: s.due ? Math.round((s.seen / s.due) * 100) : 100,
        color: colorForPct(s.due ? Math.round((s.seen / s.due) * 100) : 100, seuil),
      })),
    };
  });
}

export function colorForPct(pct, seuil) {
  if (pct >= seuil) return "var(--color-green)";
  if (pct >= seuil - 15) return "var(--color-amber)";
  return "var(--color-red)";
}

/** Appels contenant au moins une entrée pour cet élève — utilisé avant suppression/fusion. */
export function recordsReferencingStudent(records, studentId) {
  return records.filter((r) => (r.entries || []).some((e) => e.studentId === studentId));
}

/** Appels contenant au moins une entrée avec ce motif — utilisé avant renommage/suppression d'un motif. */
export function recordsReferencingReason(records, label) {
  return records.filter((r) => (r.entries || []).some((e) => e.reason === label));
}

/**
 * Renomme un motif dans tous les appels déjà enregistrés : les entrées stockent le libellé du
 * motif tel quel (pas un identifiant), donc renommer le motif dans les réglages seul ne mettrait
 * pas à jour l'historique. Chaque appel modifié reçoit une correction tracée (les règles Firestore
 * exigent qu'une modification d'`entries` s'accompagne toujours d'une nouvelle entrée dans
 * `corrections`). Appelé juste après la mise à jour du libellé dans settings/general.
 */
export async function renameReasonInRecords({ oldLabel, newLabel, records }) {
  const affected = recordsReferencingReason(records, oldLabel);
  if (affected.length === 0) return { recordsUpdated: 0 };

  const actorSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
  const actorName = actorSnap.exists() ? actorSnap.data().displayName : auth.currentUser.email;
  const reason = `Renommage du motif : « ${oldLabel} » → « ${newLabel} »`;

  const CHUNK = 400;
  for (let i = 0; i < affected.length; i += CHUNK) {
    const batch = writeBatch(db);
    affected.slice(i, i + CHUNK).forEach((record) => {
      const nextEntries = record.entries.map((e) => (e.reason === oldLabel ? { ...e, reason: newLabel } : e));
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

  return { recordsUpdated: affected.length };
}
