import { useEffect, useMemo, useState } from "react";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
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

const recordsRef = collection(db, "attendanceRecords");

export const STATUS = { PRESENT: "present", PARTIAL: "partiel", LATE: "retard", ABSENT: "absent" };

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

/** Vérifie côté client si un appel existe déjà pour cette combinaison (aide à l'UX ; la garantie réelle vient des règles Firestore, cf. plus bas). */
export async function checkExistingRecord({ date, classId, subjectId, timeSlotId }) {
  const id = attendanceRecordId({ date, classId, subjectId, timeSlotId });
  const snap = await getDoc(doc(db, "attendanceRecords", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("La liste des élèves est vide.");
  }
  for (const e of entries) {
    if (!e.studentId || !Object.values(STATUS).includes(e.status)) {
      throw new Error("Statut d'élève invalide.");
    }
    if (e.status !== STATUS.PRESENT && !e.reason?.trim()) {
      throw new Error("Un motif est requis pour tout élève non présent.");
    }
    if (e.status === STATUS.LATE && (!Number.isFinite(e.minutesMissed) || e.minutesMissed <= 0 || e.minutesMissed >= 50)) {
      throw new Error("Durée de retard invalide.");
    }
    if (e.status === STATUS.PARTIAL && (!Number.isFinite(e.minutesPresent) || e.minutesPresent <= 0 || e.minutesPresent >= 50)) {
      throw new Error("Durée de présence partielle invalide.");
    }
  }
}

function cleanEntries(entries) {
  return entries.map((e) => ({
    studentId: e.studentId,
    status: e.status,
    minutesMissed: e.status === STATUS.PRESENT ? 0 : e.status === STATUS.ABSENT ? 50 : e.status === STATUS.PARTIAL ? 0 : e.minutesMissed,
    minutesPresent: e.status === STATUS.PARTIAL ? e.minutesPresent : null,
    reason: e.status === STATUS.PRESENT ? null : e.reason.trim(),
  }));
}

/**
 * Sans Cloud Function (plan Spark gratuit), l'écriture se fait directement depuis le client.
 * L'unicité de l'appel est garantie par Firestore lui-même : l'ID du document est déterministe
 * (date+classe+matière+créneau) et les règles n'autorisent un "create" que si le document
 * n'existait pas encore — toute tentative en doublon est donc rejetée nativement, sans
 * transaction serveur à écrire.
 */
export async function submitAttendanceRecord({ date, classId, subjectId, timeSlotId, entries }) {
  validateEntries(entries);

  const [classSnap, subjectSnap, timeSlotSnap, authorSnap] = await Promise.all([
    getDoc(doc(db, "classes", classId)),
    getDoc(doc(db, "subjects", subjectId)),
    getDoc(doc(db, "timeSlots", timeSlotId)),
    getDoc(doc(db, "users", auth.currentUser.uid)),
  ]);
  if (!classSnap.exists() || !subjectSnap.exists() || !timeSlotSnap.exists()) {
    throw new Error("Classe, matière ou créneau introuvable.");
  }

  const recordId = attendanceRecordId({ date, classId, subjectId, timeSlotId });

  try {
    await setDoc(doc(db, "attendanceRecords", recordId), {
      date,
      classId,
      className: classSnap.data().name,
      subjectId,
      subjectName: subjectSnap.data().name,
      sessionMinutes: subjectSnap.data().sessionMinutes || 50,
      timeSlotId,
      timeSlotLabel: timeSlotSnap.data().label,
      authorId: auth.currentUser.uid,
      authorName: authorSnap.data().displayName,
      entries: cleanEntries(entries),
      locked: true,
      corrections: [],
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    if (err.code === "permission-denied") {
      throw Object.assign(
        new Error("Un appel a déjà été enregistré entre-temps pour cette classe, cette matière et ce créneau."),
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
  validateEntries(entries);

  const authorSnap = await getDoc(doc(db, "users", auth.currentUser.uid));

  await updateDoc(doc(db, "attendanceRecords", recordId), {
    entries: cleanEntries(entries),
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
      { student: s, minutesDue: 0, minutesSeen: 0, nbAbs: 0, nbRet: 0, nbPartiel: 0, bySubject: new Map(), absences: [] },
    ]),
  );

  const sortedRecords = records.filter((r) => !r.deleted).sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const record of sortedRecords) {
    const sessionMinutes = record.sessionMinutes || 50;
    for (const entry of record.entries || []) {
      const agg = byStudent.get(entry.studentId);
      if (!agg) continue;

      // Une présence partielle est un aménagement prévu : elle compte pour 100% de présence sur
      // le temps réellement dû (due=seen=minutesPresent), pas comme un manque sur la séance entière.
      const due = entry.status === STATUS.PARTIAL ? entry.minutesPresent || 0 : sessionMinutes;
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
      if (entry.status === STATUS.ABSENT) agg.nbAbs += 1;
      if (entry.status === STATUS.LATE) agg.nbRet += 1;
      if (entry.status === STATUS.PARTIAL) agg.nbPartiel += 1;

      if (entry.status === STATUS.LATE || entry.status === STATUS.ABSENT) {
        agg.absences.push({
          date: record.date,
          subject: record.subjectName || "—",
          reason: entry.reason || "—",
          minutesMissed: entry.status === STATUS.ABSENT ? sessionMinutes : entry.minutesMissed || 0,
          justified: reasonsLookup.get(entry.reason) ?? false,
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
      nbRet: agg.nbRet,
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

/** Un ligne par élève et par matière : minutes dues, minutes vues, taux de présence. */
export function exportStudentsCsv(studentsStats) {
  const header = ["Élève", "Classe", "Matière", "Séances", "Minutes dues", "Minutes vues", "Présence (%)"];
  const rows = studentsStats.flatMap((s) =>
    s.subjects.map((subj) => [s.fullName, s.className || "", subj.name, subj.sessions, subj.due, subj.seen, subj.pct]),
  );
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `presences_${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
