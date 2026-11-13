/** Nettoie une saisie : retire les espaces en debut/fin et reduit les espaces multiples internes a un seul. */
export function squeezeSpaces(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

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

/**
 * ID d'un appel. `attemptKey` est généré une fois par ouverture de feuille (cf. TakeAttendancePage) :
 * il empêche qu'un même envoi soit enregistré deux fois (double clic, nouvel essai après échec partiel)
 * sans interdire pour autant plusieurs appels distincts sur la même date+classe+matière+créneau
 * (ex. deux groupes d'élèves particuliers, chacun N/A sur l'autre appel).
 */
export function attendanceRecordId({ date, classId, subjectId, timeSlotId, attemptKey }) {
  return `${date}_${classId}_${subjectId}_${timeSlotId}_${attemptKey}`;
}
