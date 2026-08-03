import { collection, doc, serverTimestamp, writeBatch, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { normalize } from "./ids";
import { findDuplicateStudent } from "./students";
import { todayISO, formatDateShort } from "./dates";

const studentsRef = collection(db, "students");

const COLUMNS = {
  firstName: ["Prénom", "Prenom"],
  lastName: ["Nom"],
  className: ["Classe"],
  arrivedAt: ["Arrivé le", "Arrive le"],
  departedAt: ["Parti le"],
};

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return "";
}

function parseCellDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const tz = value.getTimezoneOffset() * 60000;
    return new Date(value - tz).toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** Lit un fichier .xlsx et retourne les lignes normalisées (une entrée par élève du fichier). */
export async function parseStudentsWorkbook(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((row) => ({
      firstName: String(pick(row, COLUMNS.firstName)).trim(),
      lastName: String(pick(row, COLUMNS.lastName)).trim(),
      className: String(pick(row, COLUMNS.className)).trim(),
      arrivedAt: parseCellDate(pick(row, COLUMNS.arrivedAt)),
      departedAt: parseCellDate(pick(row, COLUMNS.departedAt)),
    }))
    .filter((r) => r.firstName && r.lastName);
}

/**
 * Compare le fichier importé à la base actuelle et classe chaque cas :
 * - toCreate : aucun élève existant ne correspond → nouvelle fiche
 * - toReview : un élève existant correspond mais la classe diffère → décision requise
 *   (changement de classe ou doublon à ignorer)
 * - toDepart : élève actif en base, absent du fichier importé → considéré parti
 * - errors : ligne dont la classe indiquée ne correspond à aucune classe existante
 */
export function buildImportDiff({ rows, existingStudents, classes, importDate }) {
  const classByNormName = new Map(classes.map((c) => [normalize(c.name), c]));
  const activeStudents = existingStudents.filter((s) => !s.departedAt);
  const matchedIds = new Set();

  const toCreate = [];
  const toReview = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowClass = classByNormName.get(normalize(row.className));
    if (!rowClass) {
      errors.push({ key: `row-${index}`, row, reason: `Classe « ${row.className || "—"} » introuvable.` });
      return;
    }

    const existing = findDuplicateStudent(existingStudents, row.firstName, row.lastName);
    if (!existing) {
      toCreate.push({
        key: `row-${index}`,
        row,
        classId: rowClass.id,
        className: rowClass.name,
      });
      return;
    }

    matchedIds.add(existing.id);
    if (existing.classId === rowClass.id && !existing.departedAt) {
      return; // déjà à jour, rien à faire
    }

    toReview.push({
      key: existing.id,
      row,
      existingStudent: existing,
      newClassId: rowClass.id,
      newClassName: rowClass.name,
      wasDeparted: !!existing.departedAt,
    });
  });

  const toDepart = activeStudents
    .filter((s) => !matchedIds.has(s.id))
    .map((s) => ({ key: s.id, student: s }));

  return { toCreate, toReview, toDepart, errors, importDate: importDate || todayISO() };
}

/**
 * Applique le diff après décision de l'admin sur les cas ambigus.
 * `decisions.classChange`: { [studentId]: 'change' | 'ignore' }
 * `decisions.classChangeDate`: { [studentId]: 'YYYY-MM-DD' }
 * `decisions.skipCreate` / `decisions.skipDepart`: Set des clés à exclure
 */
export async function applyImportDiff({ toCreate, toReview, toDepart, importDate }, decisions = {}) {
  const ops = [];

  for (const item of toCreate) {
    if (decisions.skipCreate?.has(item.key)) continue;
    const arrivedAt = item.row.arrivedAt || importDate;
    ops.push({
      ref: doc(studentsRef),
      data: {
        firstName: item.row.firstName,
        lastName: item.row.lastName,
        fullName: `${item.row.firstName} ${item.row.lastName}`,
        classId: item.classId,
        arrivedAt,
        departedAt: item.row.departedAt || null,
        classHistory: [{ classId: item.classId, className: item.className, since: arrivedAt }],
        createdAt: serverTimestamp(),
      },
      type: "set",
    });
  }

  for (const item of toReview) {
    const decision = decisions.classChange?.[item.existingStudent.id] || "change";
    if (decision !== "change") continue;
    const date = decisions.classChangeDate?.[item.existingStudent.id] || importDate;
    ops.push({
      ref: doc(db, "students", item.existingStudent.id),
      data: {
        classId: item.newClassId,
        departedAt: null,
        classHistory: arrayUnion({ classId: item.newClassId, className: item.newClassName, since: date }),
      },
      type: "update",
    });
  }

  for (const item of toDepart) {
    if (decisions.skipDepart?.has(item.key)) continue;
    ops.push({
      ref: doc(db, "students", item.student.id),
      data: { departedAt: importDate },
      type: "update",
    });
  }

  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db);
    ops.slice(i, i + CHUNK).forEach((op) => {
      if (op.type === "set") batch.set(op.ref, op.data);
      else batch.update(op.ref, op.data);
    });
    await batch.commit();
  }

  return { applied: ops.length };
}

export async function exportStudentsWorkbook(students, classes) {
  const XLSX = await import("xlsx");
  const classById = new Map(classes.map((c) => [c.id, c]));
  const rows = students.map((s) => ({
    Prénom: s.firstName,
    Nom: s.lastName,
    Classe: classById.get(s.classId)?.name || "",
    "Arrivé le": s.arrivedAt ? formatDateShort(s.arrivedAt) : "",
    "Parti le": s.departedAt ? formatDateShort(s.departedAt) : "",
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Élèves");
  XLSX.writeFile(workbook, `eleves_${todayISO()}.xlsx`);
}
