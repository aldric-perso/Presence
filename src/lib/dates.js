/** Date du jour au format ISO local (YYYY-MM-DD), sans dérive de fuseau horaire. */
export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

/** 1er septembre de l'année scolaire en cours (année précédente tant qu'on n'a pas atteint septembre). */
export function schoolYearStartISO() {
  const d = new Date();
  const year = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-09-01`;
}

/** "Lundi 2 février 2026" à partir d'une date ISO YYYY-MM-DD. */
export function formatDateLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "30/01/2026" */
export function formatDateShort(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR").format(d);
}

/**
 * "30/01/2026 à 17h12" à partir d'un Firestore Timestamp ou d'une chaîne ISO — les corrections
 * d'appel stockent une chaîne ISO générée côté client (les sentinelles serverTimestamp() ne sont
 * pas résolues à l'intérieur des éléments d'un arrayUnion), tandis que createdAt reste un vrai
 * Firestore Timestamp.
 */
export function formatTimestamp(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("fr-FR").format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d).replace(":", "h");
  return `${date} à ${time}`;
}
