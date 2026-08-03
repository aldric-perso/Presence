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

/** "30/01/2026 à 17h12" à partir d'un Firestore Timestamp. */
export function formatTimestamp(ts) {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  const date = new Intl.DateTimeFormat("fr-FR").format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d).replace(":", "h");
  return `${date} à ${time}`;
}
