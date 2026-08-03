import { HttpsError } from "firebase-functions/v2/https";

export const STATUSES = new Set(["present", "retard", "absent"]);
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new HttpsError("invalid-argument", "La liste des élèves est vide.");
  }
  for (const e of entries) {
    if (!e.studentId || !STATUSES.has(e.status)) {
      throw new HttpsError("invalid-argument", "Statut d'élève invalide.");
    }
    if (e.status !== "present" && !e.reason?.trim()) {
      throw new HttpsError("invalid-argument", "Un motif est requis pour tout élève non présent.");
    }
    if (e.status === "retard" && (!Number.isFinite(e.minutesMissed) || e.minutesMissed <= 0 || e.minutesMissed >= 50)) {
      throw new HttpsError("invalid-argument", "Durée de retard invalide.");
    }
  }
}
