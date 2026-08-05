import ExcelJS from "exceljs";
import { STATUS } from "./attendance";
import { SESSION_MINUTES } from "./subjects";
import { formatDateShort } from "./dates";

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCADFFF" } };
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCDCD" } };
const HIGHLIGHT_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
const INPUT_FONT = { color: { argb: "FF0000FF" } };
const RED_FONT = { color: { argb: "FFFF0000" } };

function weeksBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.round((end - start) / 86400000) + 1;
  return days / 7;
}

function sanitizeSheetName(name) {
  return name.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Classe";
}

/**
 * Cumule, pour chaque élève et chaque matière existante, les minutes dues/vues sur la période —
 * y compris les matières sans aucun appel enregistré pour cet élève (0/0), pour que chaque matière
 * de Firestore ait toujours sa ligne dans l'export, comme demandé.
 */
function aggregateSubjectHours({ students, subjects, records }) {
  const byStudent = new Map(
    students.map((s) => [s.id, new Map(subjects.map((subj) => [subj.id, { due: 0, seen: 0 }]))]),
  );

  for (const record of records) {
    if (record.deleted) continue;
    const sessionMinutes = record.sessionMinutes || 50;
    for (const entry of record.entries || []) {
      const subjectAgg = byStudent.get(entry.studentId)?.get(record.subjectId);
      if (!subjectAgg) continue;

      const due = entry.status === STATUS.PARTIAL ? entry.minutesPresent || 0 : sessionMinutes;
      const seen =
        entry.status === STATUS.PRESENT
          ? sessionMinutes
          : entry.status === STATUS.LATE
            ? Math.max(0, sessionMinutes - (entry.minutesMissed || 0))
            : entry.status === STATUS.PARTIAL
              ? entry.minutesPresent || 0
              : 0;

      subjectAgg.due += due;
      subjectAgg.seen += seen;
    }
  }

  return byStudent;
}

/**
 * Écrit le tableau d'un élève (matière par matière) et renvoie le numéro de la première ligne
 * libre après ce bloc. Les colonnes B et C ("Élève de Xe en h" / "Élève /Xe UE (en h)") restent
 * vides : elles sont à remplir à la main dans Excel, mais les formules E/G/H qui s'appuient
 * dessus sont déjà écrites, comme dans le modèle fourni.
 */
function writeStudentBlock(sheet, startRow, { student, className, subjects, hours, weeks }) {
  let row = startRow;

  const headerRow = sheet.getRow(row);
  headerRow.getCell(1).value = "Matière";
  headerRow.getCell(2).value = `Élève de ${className} en h`;
  headerRow.getCell(3).value = `Élève /${className} UE (en h)`;
  headerRow.getCell(4).value = `EDT ${student.fullName}`;
  headerRow.getCell(5).value = "Taux de présence attendus/ temps UE";
  headerRow.getCell(6).value = "Taux de présence réels";
  headerRow.getCell(7).value = "Moyenne d'heures par semaine";
  headerRow.getCell(8).value = `Retard par semaine / Élève de ${className}`;
  for (let c = 1; c <= 8; c++) {
    headerRow.getCell(c).font = { bold: true };
    headerRow.getCell(c).fill = HEADER_FILL;
    headerRow.getCell(c).alignment = { wrapText: true, vertical: "middle" };
  }
  row += 1;

  const firstDataRow = row;
  for (const subject of subjects) {
    const { due, seen } = hours.get(subject.id) || { due: 0, seen: 0 };
    // Convention de l'établissement : une séance de 50 min compte pour 1 "heure" de programme,
    // pas 50/60e d'heure réelle — d'où la division par SESSION_MINUTES et non par 60.
    const weeklyDue = weeks > 0 ? due / SESSION_MINUTES / weeks : 0;
    const realRate = due > 0 ? seen / due : 0;

    const r = sheet.getRow(row);
    r.getCell(1).value = subject.name;

    r.getCell(2).font = INPUT_FONT;
    r.getCell(2).numFmt = "0.00";
    r.getCell(3).font = INPUT_FONT;
    r.getCell(3).numFmt = "0.00";

    r.getCell(4).value = Math.round(weeklyDue * 10000) / 10000;
    r.getCell(4).numFmt = "0.00";

    r.getCell(5).value = { formula: `D${row}/C${row}` };
    r.getCell(5).numFmt = "0%";

    r.getCell(6).value = Math.round(realRate * 10000) / 10000;
    r.getCell(6).numFmt = "0%";

    r.getCell(7).value = { formula: `F${row}*C${row}` };
    r.getCell(7).numFmt = "0.00";

    r.getCell(8).value = { formula: `G${row}-B${row}` };
    r.getCell(8).numFmt = "0.00";
    r.getCell(8).font = RED_FONT;

    row += 1;
  }
  const lastDataRow = row - 1;

  const totalRow = sheet.getRow(row);
  totalRow.getCell(1).value = "Total par semaine";
  totalRow.getCell(2).value = { formula: `SUM(B${firstDataRow}:B${lastDataRow})` };
  totalRow.getCell(3).value = { formula: `SUM(C${firstDataRow}:C${lastDataRow})` };
  totalRow.getCell(4).value = { formula: `SUM(D${firstDataRow}:D${lastDataRow})` };
  totalRow.getCell(5).value = { formula: `D${row}/C${row}` };
  totalRow.getCell(6).value = { formula: `G${row}/C${row}` };
  totalRow.getCell(7).value = { formula: `SUM(G${firstDataRow}:G${lastDataRow})` };
  totalRow.getCell(8).value = { formula: `SUM(H${firstDataRow}:H${lastDataRow})` };
  for (let c = 1; c <= 8; c++) {
    totalRow.getCell(c).font = { bold: true, ...(c === 8 ? RED_FONT : {}) };
  }
  totalRow.getCell(2).numFmt = "0.00";
  totalRow.getCell(3).numFmt = "0.00";
  totalRow.getCell(4).numFmt = "0.00";
  totalRow.getCell(5).numFmt = "0%";
  totalRow.getCell(6).numFmt = "0%";
  totalRow.getCell(7).numFmt = "0.00";
  totalRow.getCell(7).fill = TOTAL_FILL;
  totalRow.getCell(8).numFmt = "0.00";
  const totalRowNumber = row;
  row += 1;

  const summaryRow = sheet.getRow(row);
  summaryRow.getCell(1).value = `Temps réel de scolarisation de ${student.fullName} /scolarité ordinaire :`;
  summaryRow.getCell(1).fill = HIGHLIGHT_FILL;
  summaryRow.getCell(6).value = { formula: `G${totalRowNumber}/B${totalRowNumber}` };
  summaryRow.getCell(6).numFmt = "0%";
  summaryRow.getCell(6).font = { bold: true };
  summaryRow.getCell(6).fill = TOTAL_FILL;
  row += 2;

  return row;
}

function buildClassSheet(workbook, usedNames, { className, students, subjects, hoursByStudent, startDate, endDate, weeks }) {
  let sheetName = sanitizeSheetName(className);
  let suffix = 2;
  while (usedNames.has(sheetName)) {
    sheetName = sanitizeSheetName(`${className} (${suffix++})`);
  }
  usedNames.add(sheetName);

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { width: 42 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 20 },
    { width: 18 },
    { width: 22 },
    { width: 20 },
  ];

  const startLabel = formatDateShort(startDate);
  const endLabel = formatDateShort(endDate);

  let row = 1;
  sheet.getCell(row, 1).value = `${className} — Suivi du ${startLabel} au ${endLabel}`;
  sheet.getCell(row, 1).font = { bold: true, ...RED_FONT };
  row += 2;

  const sortedStudents = [...students].sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));
  for (const student of sortedStudents) {
    sheet.getCell(row, 1).value = `Du ${startLabel} au ${endLabel}`;
    row += 1;
    row = writeStudentBlock(sheet, row, {
      student,
      className,
      subjects,
      hours: hoursByStudent.get(student.id),
      weeks,
    });
  }
}

/**
 * Génère et télécharge un export Excel du suivi de présence par classe, sur le modèle du fichier
 * "Temps scolaire élève" fourni par l'établissement : un onglet par classe, un bloc de tableau par
 * élève (une ligne par matière), colonnes B/C laissées vides pour une saisie manuelle ultérieure
 * mais formules déjà en place.
 */
export async function exportStudentTrackingExcel({ students, classes, subjects, records, startDate, endDate }) {
  if (students.length === 0 || subjects.length === 0) return;

  const start = startDate <= endDate ? startDate : endDate;
  const end = startDate <= endDate ? endDate : startDate;
  const weeks = weeksBetween(start, end);
  const periodRecords = records.filter((r) => r.date >= start && r.date <= end);
  const hoursByStudent = aggregateSubjectHours({ students, subjects, records: periodRecords });

  const classById = new Map(classes.map((c) => [c.id, c]));
  const byClass = new Map();
  for (const student of students) {
    const key = classById.has(student.classId) ? student.classId : "orphan";
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key).push(student);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cahier d'appel";
  workbook.created = new Date();

  // Ordonne les onglets comme la liste des classes (déjà triée par nom) plutôt que par ordre
  // d'apparition des élèves, qui dépendrait arbitrairement du tri alphabétique par nom de famille.
  const orderedClassIds = [...classes.map((c) => c.id), "orphan"];
  const usedNames = new Set();
  for (const classId of orderedClassIds) {
    const classStudents = byClass.get(classId);
    if (!classStudents || classStudents.length === 0) continue;
    const className = classId === "orphan" ? "Sans classe" : classById.get(classId).name;
    buildClassSheet(workbook, usedNames, {
      className,
      students: classStudents,
      subjects,
      hoursByStudent,
      startDate: start,
      endDate: end,
      weeks,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `suivi_eleves_${start}_${end}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
