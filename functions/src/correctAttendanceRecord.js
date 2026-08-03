import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { assertAdmin } from "./guards.js";
import { validateEntries } from "./validation.js";

export const correctAttendanceRecord = onCall({ region: "europe-west1" }, async (request) => {
  const auth = assertAdmin(request);
  const { recordId, entries, reason } = request.data || {};

  if (!recordId) {
    throw new HttpsError("invalid-argument", "Identifiant d'appel manquant.");
  }
  if (!reason?.trim() || reason.trim().length <= 4) {
    throw new HttpsError("invalid-argument", "Le motif de correction doit être détaillé.");
  }
  validateEntries(entries);

  const recordRef = db.collection("attendanceRecords").doc(recordId);
  const adminSnap = await db.collection("users").doc(auth.uid).get();
  const byName = adminSnap.exists ? adminSnap.data().displayName : auth.token.name || auth.token.email;

  const cleanEntries = entries.map((e) => ({
    studentId: e.studentId,
    status: e.status,
    minutesMissed: e.status === "present" ? 0 : e.status === "absent" ? 50 : e.minutesMissed,
    reason: e.status === "present" ? null : e.reason.trim(),
  }));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(recordRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Cet appel n'existe pas.");
    }
    tx.update(recordRef, {
      entries: cleanEntries,
      corrections: FieldValue.arrayUnion({
        by: auth.uid,
        byName,
        at: Timestamp.now(),
        reason: reason.trim(),
      }),
    });
  });

  return { id: recordId };
});
