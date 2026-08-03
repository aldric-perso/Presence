import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { useCollection } from "./useCollection";
import { attendanceRecordId, initialsOf } from "./ids";
import { todayISO } from "./dates";

const recordsRef = collection(db, "attendanceRecords");

export const STATUS = { PRESENT: "present", LATE: "retard", ABSENT: "absent" };

export const ABSENCE_REASONS = [
  "Soins / examen",
  "Consultation externe",
  "État de santé",
  "Sortie autorisée",
  "Non justifié",
];
export const LATE_REASONS = [
  "Soins prolongés",
  "Transport interne",
  "Kinésithérapie",
  "Réveil tardif",
  "Non justifié",
];
export const JUSTIFIED_REASONS = new Set([
  "Soins / examen",
  "Hospitalisation chambre",
  "Consultation externe",
  "État de santé",
  "Sortie autorisée",
  "Soins prolongés",
  "Transport interne",
  "Kinésithérapie",
]);
export const LATE_MINUTE_CHOICES = [5, 10, 15, 30];

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

/** Vérifie côté client si un appel existe déjà pour cette combinaison (le Cloud Function refait la vérification définitive). */
export async function checkExistingRecord({ date, classId, subjectId, timeSlotId }) {
  const id = attendanceRecordId({ date, classId, subjectId, timeSlotId });
  const snap = await getDoc(doc(db, "attendanceRecords", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function submitAttendanceRecord({ date, classId, subjectId, timeSlotId, entries }) {
  const call = httpsCallable(functions, "submitAttendanceRecord");
  const res = await call({ date, classId, subjectId, timeSlotId, entries });
  return res.data;
}

export async function correctAttendanceRecord({ recordId, entries, reason }) {
  const call = httpsCallable(functions, "correctAttendanceRecord");
  const res = await call({ recordId, entries, reason });
  return res.data;
}

/**
 * Calcule, pour chaque élève, les minutes dues/vues, le taux de présence global et par matière,
 * ainsi que l'historique des absences/retards — à partir des appels verrouillés déjà enregistrés.
 */
export function computeStudentStats({ students, records, seuil }) {
  const byStudent = new Map(
    students.map((s) => [
      s.id,
      { student: s, minutesDue: 0, minutesSeen: 0, nbAbs: 0, nbRet: 0, bySubject: new Map(), absences: [] },
    ]),
  );

  const sortedRecords = [...records].sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const record of sortedRecords) {
    const sessionMinutes = record.sessionMinutes || 50;
    for (const entry of record.entries || []) {
      const agg = byStudent.get(entry.studentId);
      if (!agg) continue;

      const due = sessionMinutes;
      const seen =
        entry.status === STATUS.PRESENT
          ? sessionMinutes
          : entry.status === STATUS.LATE
            ? Math.max(0, sessionMinutes - (entry.minutesMissed || 0))
            : 0;

      agg.minutesDue += due;
      agg.minutesSeen += seen;
      if (entry.status === STATUS.ABSENT) agg.nbAbs += 1;
      if (entry.status === STATUS.LATE) agg.nbRet += 1;

      if (entry.status !== STATUS.PRESENT) {
        agg.absences.push({
          date: record.date,
          subject: record.subjectName || "—",
          reason: entry.reason || "—",
          minutesMissed: entry.status === STATUS.ABSENT ? sessionMinutes : entry.minutesMissed || 0,
          justified: JUSTIFIED_REASONS.has(entry.reason),
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
