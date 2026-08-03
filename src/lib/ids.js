/** Normalise une chaine pour la comparaison anti-doublon (accents, tirets, espaces, casse ignores). */
export function normalize(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    // Supprime les marques diacritiques combinantes (U+0300–U+036F) laissées par normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s'-]/g, "");
}

export function initialsOf(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** ID deterministe d'un appel : garantit l'unicite classe+matiere+creneau+date au niveau Firestore. */
export function attendanceRecordId({ date, classId, subjectId, timeSlotId }) {
  return `${date}_${classId}_${subjectId}_${timeSlotId}`;
}
