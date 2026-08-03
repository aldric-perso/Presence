import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { assertAuthenticated } from "./guards.js";
import { validateEntries, DATE_RE } from "./validation.js";

export const submitAttendanceRecord = onCall({ region: "europe-west1" }, async (request) => {
  const auth = assertAuthenticated(request);
  const { date, classId, subjectId, timeSlotId, entries } = request.data || {};

  if (!DATE_RE.test(date || "")) {
    throw new HttpsError("invalid-argument", "Date invalide.");
  }
  if (!classId || !subjectId || !timeSlotId) {
    throw new HttpsError("invalid-argument", "Classe, matière et créneau sont obligatoires.");
  }
  validateEntries(entries);

  const [classSnap, subjectSnap, timeSlotSnap, authorSnap] = await Promise.all([
    db.collection("classes").doc(classId).get(),
    db.collection("subjects").doc(subjectId).get(),
    db.collection("timeSlots").doc(timeSlotId).get(),
    db.collection("users").doc(auth.uid).get(),
  ]);

  if (!classSnap.exists) throw new HttpsError("not-found", "Classe introuvable.");
  if (!subjectSnap.exists) throw new HttpsError("not-found", "Matière introuvable.");
  if (!timeSlotSnap.exists) throw new HttpsError("not-found", "Créneau introuvable.");

  const authorName = authorSnap.exists ? authorSnap.data().displayName : auth.token.name || auth.token.email;
  const recordId = `${date}_${classId}_${subjectId}_${timeSlotId}`;
  const recordRef = db.collection("attendanceRecords").doc(recordId);

  const cleanEntries = entries.map((e) => ({
    studentId: e.studentId,
    status: e.status,
    minutesMissed: e.status === "present" ? 0 : e.status === "absent" ? 50 : e.minutesMissed,
    reason: e.status === "present" ? null : e.reason.trim(),
  }));

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(recordRef);
    if (existing.exists) {
      throw new HttpsError(
        "already-exists",
        "Un appel a déjà été enregistré pour cette classe, cette matière et ce créneau.",
      );
    }
    tx.set(recordRef, {
      date,
      classId,
      className: classSnap.data().name,
      subjectId,
      subjectName: subjectSnap.data().name,
      sessionMinutes: subjectSnap.data().sessionMinutes || 50,
      timeSlotId,
      timeSlotLabel: timeSlotSnap.data().label,
      authorId: auth.uid,
      authorName,
      entries: cleanEntries,
      locked: true,
      corrections: [],
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { id: recordId };
});
