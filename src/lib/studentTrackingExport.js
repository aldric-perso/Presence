import ExcelJS from "exceljs";
import { STATUS } from "./attendance";
import { SESSION_MINUTES } from "./subjects";
import { defaultReferenceHours } from "./scolariteDefaults";

const PARAMS_SHEET = "Paramètres";
const DATA_SHEET = "Données";

const COLOR = {
  navy: "FF1F2A44",
  navySoft: "FF4A5878",
  header: "FFD9E5F8",
  zebra: "FFF4F7FC",
  band: "FFEEF2F9",
  line: "FFDDE3EE",
  total: "FFE4ECF8",
  highlight: "FFFFF1A8",
  rose: "FFFFD9DC",
  red: "FFC62828",
  green: "FF1B6B3A",
  greenFill: "FFD7F0DF",
  amber: "FF8A5A00",
  amberFill: "FFFFE9BF",
  redFill: "FFFBD5D5",
  inputFill: "FFFFF9E0",
  inputFont: "FF1F4FD8",
  muted: "FF6B7690",
  white: "FFFFFFFF",
};

const FONT_NAME = "Calibri";
const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = (argb = COLOR.line) => ({ style: "thin", color: { argb } });

// Zéro affiché "–" pour que les matières sans heures ni appels ne noient pas les vraies valeurs.
const FMT_HOURS = '0.00;-0.00;"–"';
const FMT_RATE = '0%;-0%;"–"';
const FMT_DELTA = '+0.00;-0.00;"–"';
const FMT_DATE = "dd/mm/yyyy";

/** Numéro de série Excel d'une date ISO (YYYY-MM-DD) — évite tout décalage de fuseau d'un objet Date. */
function excelSerial(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

function weeksBetween(startDate, endDate) {
  const days = excelSerial(endDate) - excelSerial(startDate) + 1;
  return days / 7;
}

function sanitizeSheetName(name) {
  return name.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Classe";
}

function uniqueSheetName(usedNames, name) {
  let sheetName = sanitizeSheetName(name);
  let suffix = 2;
  while (usedNames.has(sheetName.toLowerCase())) {
    sheetName = sanitizeSheetName(`${name} (${suffix++})`);
  }
  usedNames.add(sheetName.toLowerCase());
  return sheetName;
}

const fx = (formula, result) => ({ formula, result });

function styleRange(sheet, row, fromCol, toCol, style) {
  for (let c = fromCol; c <= toCol; c++) {
    const cell = sheet.getCell(row, c);
    if (style.fill) cell.fill = style.fill;
    if (style.font) cell.font = style.font;
    if (style.border) cell.border = style.border;
    if (style.alignment) cell.alignment = style.alignment;
  }
}

/* ------------------------------------------------------------------ */
/* Préparation des données                                              */
/* ------------------------------------------------------------------ */

/**
 * Libellé unique par élève, utilisé comme clé de recherche dans l'onglet Données : deux élèves
 * homonymes se retrouveraient sinon fusionnés par les formules SUMIFS/COUNTIFS.
 */
function buildStudentLabels(students, classById) {
  const counts = new Map();
  for (const s of students) counts.set(s.fullName, (counts.get(s.fullName) || 0) + 1);

  const labels = new Map();
  const used = new Set();
  for (const s of students) {
    let label = s.fullName;
    if (counts.get(s.fullName) > 1) {
      label = `${s.fullName} (${classById.get(s.classId)?.name || "Sans classe"})`;
    }
    let candidate = label;
    let n = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${label} #${n++}`;
    used.add(candidate.toLowerCase());
    labels.set(s.id, candidate);
  }
  return labels;
}

const STATUS_LABEL = {
  [STATUS.PRESENT]: "Présent",
  [STATUS.LATE]: "Retard",
  [STATUS.PARTIAL]: "Partiel",
  [STATUS.ABSENT]: "Absent",
};

/**
 * Une ligne par élève et par séance (hors appels supprimés et séances N/A), sur TOUTES les dates :
 * c'est ce qui permet de changer la période dans l'onglet Paramètres sans régénérer le fichier.
 */
function buildDataRows({ students, subjects, records, labels, reasonsLookup }) {
  const studentIds = new Set(students.map((s) => s.id));
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  const rows = [];

  for (const record of records) {
    if (record.deleted) continue;
    const subjectName = subjectNameById.get(record.subjectId);
    if (!subjectName) continue;
    const sessionMinutes = record.sessionMinutes || 50;

    for (const entry of record.entries || []) {
      if (!studentIds.has(entry.studentId) || entry.status === STATUS.NA) continue;

      const seen =
        entry.status === STATUS.PRESENT
          ? sessionMinutes
          : entry.status === STATUS.LATE
            ? Math.max(0, sessionMinutes - (entry.minutesMissed || 0))
            : entry.status === STATUS.PARTIAL
              ? entry.minutesPresent || 0
              : 0;

      const isPresent = entry.status === STATUS.PRESENT;
      rows.push({
        date: record.date,
        serial: excelSerial(record.date),
        student: labels.get(entry.studentId),
        subject: subjectName,
        status: STATUS_LABEL[entry.status] || entry.status,
        reason: isPresent ? "" : entry.reason || "",
        justified: isPresent ? "" : reasonsLookup.get(entry.reason) ? "Oui" : "Non",
        due: sessionMinutes,
        seen,
      });
    }
  }

  rows.sort((a, b) => a.serial - b.serial || a.student.localeCompare(b.student, "fr"));
  return rows;
}

/** Totaux de la période initiale : ce sont les valeurs en cache des formules, pour les lecteurs qui ne recalculent pas. */
function summarisePeriod(rows, startSerial, endSerial) {
  const hours = new Map(); // `${élève}\u0000${matière}` → { due, seen }
  const counts = new Map(); // élève → { abs, ret }
  for (const r of rows) {
    if (r.serial < startSerial || r.serial > endSerial) continue;
    const key = `${r.student}\u0000${r.subject}`;
    const h = hours.get(key) || { due: 0, seen: 0 };
    h.due += r.due;
    h.seen += r.seen;
    hours.set(key, h);

    if (r.justified === "Non") {
      const c = counts.get(r.student) || { abs: 0, ret: 0 };
      if (r.status === "Absent") c.abs += 1;
      if (r.status === "Retard") c.ret += 1;
      counts.set(r.student, c);
    }
  }
  return { hours, counts };
}

/* ------------------------------------------------------------------ */
/* Onglet Données                                                       */
/* ------------------------------------------------------------------ */

function buildDataSheet(workbook, rows) {
  const sheet = workbook.addWorksheet(DATA_SHEET, {
    properties: { tabColor: { argb: COLOR.muted } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "Date", key: "serial", width: 13, style: { numFmt: FMT_DATE } },
    { header: "Élève", key: "student", width: 30 },
    { header: "Matière", key: "subject", width: 30 },
    { header: "Statut", key: "status", width: 12 },
    { header: "Motif", key: "reason", width: 34 },
    { header: "Justifié", key: "justified", width: 11 },
    { header: "Min. dues", key: "due", width: 11 },
    { header: "Min. suivies", key: "seen", width: 13 },
  ];
  const header = sheet.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { name: FONT_NAME, bold: true, color: { argb: COLOR.white } };
    cell.fill = solid(COLOR.navy);
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  });
  for (const r of rows) sheet.addRow(r);
  sheet.autoFilter = { from: "A1", to: { row: Math.max(rows.length + 1, 2), column: 8 } };
}

/* ------------------------------------------------------------------ */
/* Onglet Paramètres                                                    */
/* ------------------------------------------------------------------ */

function inputCell(cell, { numFmt, value }) {
  cell.value = value;
  cell.numFmt = numFmt;
  cell.fill = solid(COLOR.inputFill);
  cell.font = { name: FONT_NAME, bold: true, color: { argb: COLOR.inputFont } };
  cell.border = { top: thin(COLOR.inputFont), bottom: thin(COLOR.inputFont), left: thin(COLOR.inputFont), right: thin(COLOR.inputFont) };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

function sectionBand(sheet, row, text, lastCol) {
  sheet.mergeCells(row, 1, row, lastCol);
  const cell = sheet.getCell(row, 1);
  cell.value = text;
  styleRange(sheet, row, 1, lastCol, {
    fill: solid(COLOR.navy),
    font: { name: FONT_NAME, bold: true, size: 11, color: { argb: COLOR.white } },
    alignment: { vertical: "middle", horizontal: "left", indent: 1 },
  });
  sheet.getRow(row).height = 24;
}

function labelCell(cell, text) {
  cell.value = text;
  cell.font = { name: FONT_NAME, size: 11, color: { argb: COLOR.navy } };
  cell.alignment = { vertical: "middle", indent: 1 };
}

function noteCell(cell, text) {
  cell.value = text;
  cell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: COLOR.muted } };
  cell.alignment = { vertical: "middle", indent: 1 };
}

/**
 * Crée l'onglet Paramètres (période, réglages, heures de référence par classe) et renvoie, pour
 * chaque classe, la cellule de chaque matière à laquelle les onglets de classe se relient.
 */
function buildParamsSheet(workbook, { classGroups, subjects, startSerial, endSerial, weeks, threshold, dataRange }) {
  const sheet = workbook.addWorksheet(PARAMS_SHEET, {
    properties: { tabColor: { argb: "FFE0A100" } },
    views: [{ showGridLines: false }],
  });

  const lastCol = Math.max(8, 1 + classGroups.length * 2);
  sheet.getColumn(1).width = 46;
  for (let c = 2; c <= lastCol; c++) sheet.getColumn(c).width = 15;

  sheet.getCell("A1").value = "Paramètres du suivi";
  sheet.getCell("A1").font = { name: FONT_NAME, bold: true, size: 20, color: { argb: COLOR.navy } };
  sheet.getRow(1).height = 34;
  noteCell(sheet.getCell("A2"), "Modifiez les cellules à fond jaune : tous les onglets se recalculent automatiquement.");

  // --- Période ---
  sectionBand(sheet, 4, "PÉRIODE AFFICHÉE", lastCol);
  labelCell(sheet.getCell("A5"), "Date de début");
  inputCell(sheet.getCell("B5"), { value: startSerial, numFmt: FMT_DATE });
  noteCell(sheet.getCell("C5"), "Premier jour pris en compte dans les onglets de classe.");
  labelCell(sheet.getCell("A6"), "Date de fin");
  inputCell(sheet.getCell("B6"), { value: endSerial, numFmt: FMT_DATE });
  noteCell(sheet.getCell("C6"), "Dernier jour pris en compte (inclus).");

  const calendarWeeks = weeks;
  labelCell(sheet.getCell("A7"), "Semaines calendaires sur la période");
  sheet.getCell("B7").value = fx("MAX(0,(B6-B5+1)/7)", calendarWeeks);
  sheet.getCell("B7").numFmt = "0.0";
  noteCell(sheet.getCell("C7"), "Calculé : (fin − début + 1) ÷ 7.");

  labelCell(sheet.getCell("A8"), "Forcer le nombre de semaines (facultatif)");
  inputCell(sheet.getCell("B8"), { value: null, numFmt: "0.0" });
  noteCell(sheet.getCell("C8"), "Ex. nombre de semaines de cours réelles, vacances déduites. Vide = calcul automatique.");

  labelCell(sheet.getCell("A9"), "Semaines retenues pour les moyennes");
  sheet.getCell("B9").value = fx("IF(ISNUMBER(B8),B8,B7)", calendarWeeks);
  sheet.getCell("B9").numFmt = "0.0";
  noteCell(sheet.getCell("C9"), "Diviseur des « moyennes d'heures par semaine ».");

  labelCell(sheet.getCell("A10"), "Appels enregistrés dans l'app");
  sheet.getCell("B10").value = fx(`IF(COUNT('${DATA_SHEET}'!$A:$A)=0,"",MIN('${DATA_SHEET}'!$A:$A))`, dataRange?.min ?? "");
  sheet.getCell("B10").numFmt = FMT_DATE;
  sheet.getCell("C10").value = "au";
  sheet.getCell("C10").alignment = { horizontal: "center" };
  sheet.getCell("D10").value = fx(`IF(COUNT('${DATA_SHEET}'!$A:$A)=0,"",MAX('${DATA_SHEET}'!$A:$A))`, dataRange?.max ?? "");
  sheet.getCell("D10").numFmt = FMT_DATE;
  for (const addr of ["B10", "C10", "D10"]) {
    sheet.getCell(addr).font = { name: FONT_NAME, color: { argb: COLOR.muted } };
    sheet.getCell(addr).alignment = { horizontal: "center" };
  }
  noteCell(sheet.getCell("E10"), "Pour repérer les dates utiles.");

  // --- Réglages ---
  sectionBand(sheet, 12, "RÉGLAGES DE CALCUL", lastCol);
  labelCell(sheet.getCell("A13"), "Durée d'une heure de cours (min)");
  inputCell(sheet.getCell("B13"), { value: SESSION_MINUTES, numFmt: "0" });
  noteCell(sheet.getCell("C13"), "Convention : une séance de 50 min compte pour 1 heure de programme.");
  labelCell(sheet.getCell("A14"), "Seuil d'alerte du taux de présence");
  inputCell(sheet.getCell("B14"), { value: threshold, numFmt: "0%" });
  noteCell(sheet.getCell("C14"), "Taux réel ≥ seuil : vert · jusqu'à 15 points en dessous : orange · plus bas : rouge.");

  // --- Heures de référence ---
  sectionBand(sheet, 16, "HEURES DE RÉFÉRENCE PAR CLASSE — identiques pour tous les élèves d'une même classe", lastCol);
  noteCell(sheet.getCell("A17"), "Ordinaire = heures hebdo en scolarité ordinaire (colonne B des onglets de classe).");
  noteCell(sheet.getCell("A18"), "UE = heures hebdo prévues pour un élève en UE (colonne C). Valeurs de départ : modèle 2026-2027.");

  const headRow = 19;
  const subHeadRow = 20;
  sheet.mergeCells(headRow, 1, subHeadRow, 1);
  sheet.getCell(headRow, 1).value = "Matière";
  const firstSubjectRow = subHeadRow + 1;
  const lastSubjectRow = firstSubjectRow + subjects.length - 1;
  const totalRow = lastSubjectRow + 1;

  const refs = new Map();
  classGroups.forEach((group, k) => {
    const bCol = 2 + k * 2;
    const cCol = bCol + 1;
    sheet.mergeCells(headRow, bCol, headRow, cCol);
    sheet.getCell(headRow, bCol).value = group.className;
    sheet.getCell(subHeadRow, bCol).value = "Ordinaire (h)";
    sheet.getCell(subHeadRow, cCol).value = "UE (h)";

    const cells = new Map();
    subjects.forEach((subject, i) => {
      const row = firstSubjectRow + i;
      const { ordinary, ue } = defaultReferenceHours(group.className, subject.name);
      inputCell(sheet.getCell(row, bCol), { value: ordinary, numFmt: FMT_HOURS });
      inputCell(sheet.getCell(row, cCol), { value: ue, numFmt: FMT_HOURS });
      cells.set(subject.id, {
        b: sheet.getCell(row, bCol).$col$row,
        c: sheet.getCell(row, cCol).$col$row,
        bValue: ordinary,
        cValue: ue,
      });
    });

    const colB = sheet.getCell(totalRow, bCol).address.replace(/\d+/, "");
    const colC = sheet.getCell(totalRow, cCol).address.replace(/\d+/, "");
    sheet.getCell(totalRow, bCol).value = fx(
      `SUM(${colB}${firstSubjectRow}:${colB}${lastSubjectRow})`,
      [...cells.values()].reduce((s, v) => s + v.bValue, 0),
    );
    sheet.getCell(totalRow, cCol).value = fx(
      `SUM(${colC}${firstSubjectRow}:${colC}${lastSubjectRow})`,
      [...cells.values()].reduce((s, v) => s + v.cValue, 0),
    );
    refs.set(group.key, cells);
  });

  // Habillage des en-têtes et de la colonne des matières
  for (let c = 1; c <= 1 + classGroups.length * 2; c++) {
    for (const r of [headRow, subHeadRow]) {
      const cell = sheet.getCell(r, c);
      cell.fill = solid(r === headRow ? COLOR.navySoft : COLOR.header);
      cell.font = {
        name: FONT_NAME,
        bold: true,
        color: { argb: r === headRow ? COLOR.white : COLOR.navy },
        size: r === headRow ? 12 : 10,
      };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { left: thin(COLOR.white), right: thin(COLOR.white) };
    }
  }
  sheet.getRow(headRow).height = 24;
  sheet.getRow(subHeadRow).height = 22;
  sheet.getCell(headRow, 1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  subjects.forEach((subject, i) => {
    const row = firstSubjectRow + i;
    labelCell(sheet.getCell(row, 1), subject.name);
    sheet.getRow(row).height = 20;
  });
  labelCell(sheet.getCell(totalRow, 1), "Total par semaine");
  styleRange(sheet, totalRow, 1, 1 + classGroups.length * 2, {
    fill: solid(COLOR.total),
    font: { name: FONT_NAME, bold: true, color: { argb: COLOR.navy } },
    border: { top: { style: "medium", color: { argb: COLOR.navy } } },
  });
  for (let c = 2; c <= 1 + classGroups.length * 2; c++) {
    sheet.getCell(totalRow, c).numFmt = FMT_HOURS;
    sheet.getCell(totalRow, c).alignment = { horizontal: "center" };
  }
  sheet.getRow(totalRow).height = 24;

  // Garde-fous de saisie
  sheet.getCell("B5").dataValidation = {
    type: "date", operator: "greaterThan", formulae: [36526], allowBlank: false,
    showErrorMessage: true, errorTitle: "Date invalide", error: "Saisissez une date (jj/mm/aaaa).",
  };
  sheet.getCell("B6").dataValidation = {
    type: "date", operator: "greaterThanOrEqual", formulae: ["$B$5"], allowBlank: false,
    showErrorMessage: true, errorTitle: "Date invalide", error: "La date de fin doit être postérieure ou égale à la date de début.",
  };
  sheet.getCell("B8").dataValidation = {
    type: "decimal", operator: "greaterThan", formulae: [0], allowBlank: true,
    showErrorMessage: true, errorTitle: "Valeur invalide", error: "Saisissez un nombre de semaines supérieur à 0, ou laissez vide.",
  };
  sheet.getCell("B13").dataValidation = {
    type: "decimal", operator: "greaterThan", formulae: [0], allowBlank: false,
    showErrorMessage: true, errorTitle: "Valeur invalide", error: "La durée doit être supérieure à 0.",
  };
  sheet.getCell("B14").dataValidation = {
    type: "decimal", operator: "between", formulae: [0, 1], allowBlank: false,
    showErrorMessage: true, errorTitle: "Valeur invalide", error: "Saisissez un pourcentage entre 0 % et 100 %.",
  };
  for (const group of classGroups) {
    for (const { b, c } of refs.get(group.key).values()) {
      for (const ref of [b, c]) {
        sheet.getCell(ref.replace(/\$/g, "")).dataValidation = {
          type: "decimal", operator: "greaterThanOrEqual", formulae: [0], allowBlank: true,
          showErrorMessage: true, errorTitle: "Valeur invalide", error: "Saisissez un nombre d'heures positif.",
        };
      }
    }
  }

  // Noms utilisés par les formules des autres onglets
  workbook.definedNames.add(`'${PARAMS_SHEET}'!$B$5`, "DateDebut");
  workbook.definedNames.add(`'${PARAMS_SHEET}'!$B$6`, "DateFin");
  workbook.definedNames.add(`'${PARAMS_SHEET}'!$B$9`, "NbSemaines");
  workbook.definedNames.add(`'${PARAMS_SHEET}'!$B$13`, "HeureMin");
  workbook.definedNames.add(`'${PARAMS_SHEET}'!$B$14`, "Seuil");

  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  return refs;
}

/* ------------------------------------------------------------------ */
/* Onglets de classe                                                    */
/* ------------------------------------------------------------------ */

const CLASS_COLS = 8; // A..H imprimés ; J..K = détail en minutes
const DET_DUE = 10; // J
const DET_SEEN = 11; // K

/** Colore le taux réel selon le seuil — uniquement quand il existe des séances sur la période. */
function fillConditionalRate(sheet, ref, topLeft, state) {
  const addr = topLeft;
  const row = Number(topLeft.match(/\d+/)[0]);
  sheet.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "expression",
        priority: state.priority++,
        formulae: [`AND($J${row}>0,${addr}>=Seuil)`],
        style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COLOR.greenFill } }, font: { color: { argb: COLOR.green }, bold: true } },
      },
      {
        type: "expression",
        priority: state.priority++,
        formulae: [`AND($J${row}>0,${addr}>=Seuil-0.15)`],
        style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COLOR.amberFill } }, font: { color: { argb: COLOR.amber }, bold: true } },
      },
      {
        type: "expression",
        priority: state.priority++,
        formulae: [`$J${row}>0`],
        style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COLOR.redFill } }, font: { color: { argb: COLOR.red }, bold: true } },
      },
    ],
  });
}

function writeStudentBlock(sheet, startRow, ctx) {
  const { student, label, className, subjects, params, weeks, hourMinutes, startSerial, endSerial, summary, cf } = ctx;
  let row = startRow;

  // --- Bandeau nominatif (la cellule A porte la clé de recherche des formules) ---
  const bannerRow = row;
  sheet.mergeCells(row, 1, row, CLASS_COLS);
  sheet.getCell(row, 1).value = label;
  styleRange(sheet, row, 1, CLASS_COLS, {
    fill: solid(COLOR.navy),
    font: { name: FONT_NAME, bold: true, size: 14, color: { argb: COLOR.white } },
    alignment: { vertical: "middle", horizontal: "left", indent: 1 },
  });
  sheet.getRow(row).height = 28;
  const nameRef = `$A$${bannerRow}`;
  row += 1;

  // --- Période ---
  const bandStyle = { fill: solid(COLOR.band), font: { name: FONT_NAME, size: 10, color: { argb: COLOR.navySoft } } };
  styleRange(sheet, row, 1, CLASS_COLS, bandStyle);
  sheet.getCell(row, 1).value = "Période du";
  sheet.getCell(row, 2).value = fx("DateDebut", startSerial);
  sheet.getCell(row, 3).value = "au";
  sheet.getCell(row, 4).value = fx("DateFin", endSerial);
  for (const c of [2, 4]) {
    sheet.getCell(row, c).numFmt = FMT_DATE;
    sheet.getCell(row, c).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.navy } };
    sheet.getCell(row, c).alignment = { horizontal: "center" };
  }
  sheet.getCell(row, 1).alignment = { indent: 1 };
  sheet.getCell(row, 3).alignment = { horizontal: "center" };
  row += 1;

  // --- Absences / retards injustifiés ---
  styleRange(sheet, row, 1, CLASS_COLS, bandStyle);
  const period = `'${DATA_SHEET}'!$A:$A,">="&DateDebut,'${DATA_SHEET}'!$A:$A,"<="&DateFin`;
  const countFormula = (status) =>
    `COUNTIFS('${DATA_SHEET}'!$B:$B,${nameRef},'${DATA_SHEET}'!$D:$D,"${status}",'${DATA_SHEET}'!$F:$F,"Non",${period})`;
  sheet.getCell(row, 1).value = "Absences injustifiées :";
  sheet.getCell(row, 2).value = fx(countFormula("Absent"), summary.counts.get(label)?.abs || 0);
  sheet.mergeCells(row, 3, row, 4);
  sheet.getCell(row, 3).value = "Retards injustifiés :";
  sheet.getCell(row, 5).value = fx(countFormula("Retard"), summary.counts.get(label)?.ret || 0);
  sheet.getCell(row, 1).alignment = { indent: 1 };
  sheet.getCell(row, 3).alignment = { horizontal: "right" };
  for (const c of [2, 5]) {
    sheet.getCell(row, c).numFmt = "0";
    sheet.getCell(row, c).font = { name: FONT_NAME, size: 11, bold: true, color: { argb: COLOR.navy } };
    sheet.getCell(row, c).alignment = { horizontal: "center" };
  }
  sheet.addConditionalFormatting({
    ref: `B${row} E${row}`,
    rules: [
      {
        type: "expression",
        priority: cf.priority++,
        formulae: [`B${row}>0`],
        style: { font: { color: { argb: COLOR.red }, bold: true } },
      },
    ],
  });
  sheet.getRow(row).height = 20;
  row += 1;

  // --- En-têtes de colonnes ---
  const headerRow = sheet.getRow(row);
  headerRow.height = 54;
  const headFont = { name: FONT_NAME, bold: true, size: 10, color: { argb: COLOR.navy } };
  headerRow.getCell(1).value = "Matière";
  headerRow.getCell(2).value = `Élève de ${className} en h`;
  headerRow.getCell(3).value = `Élève /${className} UE (en h)`;
  headerRow.getCell(4).value = {
    richText: [
      { text: "EDT ", font: headFont },
      { text: student.fullName, font: { ...headFont, color: { argb: COLOR.red } } },
    ],
  };
  headerRow.getCell(5).value = "Taux de présence attendu / temps UE";
  headerRow.getCell(6).value = "Taux de présence réel";
  headerRow.getCell(7).value = "Moyenne d'heures par semaine";
  headerRow.getCell(8).value = {
    richText: [
      { text: "Retard", font: { ...headFont, color: { argb: COLOR.red } } },
      { text: ` par semaine / Élève de ${className}`, font: headFont },
    ],
  };
  headerRow.getCell(DET_DUE).value = "Min. dues (période)";
  headerRow.getCell(DET_SEEN).value = "Min. suivies (période)";
  for (let c = 1; c <= CLASS_COLS; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = solid(COLOR.header);
    if (!cell.value?.richText) cell.font = headFont;
    cell.alignment = { wrapText: true, vertical: "middle", horizontal: c === 1 ? "left" : "center", indent: c === 1 ? 1 : 0 };
    cell.border = { bottom: { style: "medium", color: { argb: COLOR.navy } } };
  }
  for (const c of [DET_DUE, DET_SEEN]) {
    const cell = headerRow.getCell(c);
    cell.font = { name: FONT_NAME, italic: true, size: 9, color: { argb: COLOR.muted } };
    cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  }
  row += 1;

  // --- Une ligne par matière ---
  const firstRow = row;
  const sums = { b: 0, c: 0, d: 0, g: 0, h: 0, due: 0, seen: 0 };
  subjects.forEach((subject, i) => {
    const r = sheet.getRow(row);
    r.height = 20;
    const ref = params.get(subject.id);
    const { due, seen } = summary.hours.get(`${label}\u0000${subject.name}`) || { due: 0, seen: 0 };

    const crit = `'${DATA_SHEET}'!$B:$B,${nameRef},'${DATA_SHEET}'!$C:$C,$A${row},${period}`;
    const d = weeks > 0 ? due / hourMinutes / weeks : 0;
    const e = ref.cValue > 0 ? d / ref.cValue : 0;
    const f = due > 0 ? seen / due : 0;
    const g = f * ref.cValue;
    const h = g - ref.bValue;

    r.getCell(1).value = subject.name;
    r.getCell(2).value = fx(`'${PARAMS_SHEET}'!${ref.b}`, ref.bValue);
    r.getCell(3).value = fx(`'${PARAMS_SHEET}'!${ref.c}`, ref.cValue);
    r.getCell(4).value = fx(`IF(NbSemaines>0,J${row}/HeureMin/NbSemaines,0)`, d);
    r.getCell(5).value = fx(`IF(C${row}>0,D${row}/C${row},0)`, e);
    r.getCell(6).value = fx(`IF(J${row}>0,K${row}/J${row},0)`, f);
    r.getCell(7).value = fx(`F${row}*C${row}`, g);
    r.getCell(8).value = fx(`G${row}-B${row}`, h);
    r.getCell(DET_DUE).value = fx(`SUMIFS('${DATA_SHEET}'!$G:$G,${crit})`, due);
    r.getCell(DET_SEEN).value = fx(`SUMIFS('${DATA_SHEET}'!$H:$H,${crit})`, seen);

    const zebra = i % 2 === 1 ? solid(COLOR.zebra) : null;
    for (let c = 1; c <= CLASS_COLS; c++) {
      const cell = r.getCell(c);
      if (zebra) cell.fill = zebra;
      cell.font = { name: FONT_NAME, size: 11, color: { argb: COLOR.navy } };
      cell.border = { bottom: thin() };
      cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "center", indent: c === 1 ? 1 : 0, wrapText: c === 1 };
    }
    for (const c of [2, 3, 4, 7]) r.getCell(c).numFmt = FMT_HOURS;
    for (const c of [5, 6]) r.getCell(c).numFmt = FMT_RATE;
    r.getCell(8).numFmt = FMT_DELTA;
    for (const c of [DET_DUE, DET_SEEN]) {
      r.getCell(c).numFmt = "0";
      r.getCell(c).font = { name: FONT_NAME, size: 9, color: { argb: COLOR.muted } };
      r.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    }

    sums.b += ref.bValue;
    sums.c += ref.cValue;
    sums.d += d;
    sums.g += g;
    sums.h += h;
    sums.due += due;
    sums.seen += seen;
    row += 1;
  });
  const lastRow = row - 1;

  fillConditionalRate(sheet, `F${firstRow}:F${lastRow}`, `F${firstRow}`, cf);
  sheet.addConditionalFormatting({
    ref: `H${firstRow}:H${lastRow}`,
    rules: [
      { type: "expression", priority: cf.priority++, formulae: [`H${firstRow}<-0.005`], style: { font: { color: { argb: COLOR.red } } } },
      { type: "expression", priority: cf.priority++, formulae: [`H${firstRow}>0.005`], style: { font: { color: { argb: COLOR.green } } } },
    ],
  });

  // --- Total par semaine ---
  const total = sheet.getRow(row);
  total.height = 26;
  const totalRate = sums.c > 0 ? sums.g / sums.c : 0;
  total.getCell(1).value = "Total par semaine";
  total.getCell(2).value = fx(`SUM(B${firstRow}:B${lastRow})`, sums.b);
  total.getCell(3).value = fx(`SUM(C${firstRow}:C${lastRow})`, sums.c);
  total.getCell(4).value = fx(`SUM(D${firstRow}:D${lastRow})`, sums.d);
  total.getCell(5).value = fx(`IF(C${row}>0,D${row}/C${row},0)`, sums.c > 0 ? sums.d / sums.c : 0);
  total.getCell(6).value = fx(`IF(C${row}>0,G${row}/C${row},0)`, totalRate);
  total.getCell(7).value = fx(`SUM(G${firstRow}:G${lastRow})`, sums.g);
  total.getCell(8).value = fx(`SUM(H${firstRow}:H${lastRow})`, sums.h);
  total.getCell(DET_DUE).value = fx(`SUM(J${firstRow}:J${lastRow})`, sums.due);
  total.getCell(DET_SEEN).value = fx(`SUM(K${firstRow}:K${lastRow})`, sums.seen);
  for (let c = 1; c <= CLASS_COLS; c++) {
    const cell = total.getCell(c);
    cell.fill = solid(c === 7 ? COLOR.rose : COLOR.total);
    cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: COLOR.navy } };
    cell.border = { top: { style: "medium", color: { argb: COLOR.navy } } };
    cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "center", indent: c === 1 ? 1 : 0 };
  }
  for (const c of [2, 3, 4, 7]) total.getCell(c).numFmt = FMT_HOURS;
  for (const c of [5, 6]) total.getCell(c).numFmt = FMT_RATE;
  total.getCell(8).numFmt = FMT_DELTA;
  for (const c of [DET_DUE, DET_SEEN]) {
    total.getCell(c).numFmt = "0";
    total.getCell(c).font = { name: FONT_NAME, size: 9, bold: true, color: { argb: COLOR.muted } };
    total.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
  }
  sheet.addConditionalFormatting({
    ref: `H${row}`,
    rules: [{ type: "expression", priority: cf.priority++, formulae: [`H${row}<-0.005`], style: { font: { color: { argb: COLOR.red } } } }],
  });
  fillConditionalRate(sheet, `F${row}`, `F${row}`, cf);
  const totalRowNumber = row;
  row += 1;

  // --- Temps réel de scolarisation (rapporté à la scolarité ordinaire) ---
  sheet.mergeCells(row, 1, row, 5);
  sheet.getCell(row, 1).value = {
    richText: [
      { text: "Temps réel de scolarisation de ", font: { name: FONT_NAME, bold: true, size: 12, color: { argb: COLOR.navy } } },
      { text: student.fullName, font: { name: FONT_NAME, bold: true, size: 12, color: { argb: COLOR.red } } },
      { text: " / scolarité ordinaire :", font: { name: FONT_NAME, bold: true, size: 12, color: { argb: COLOR.navy } } },
    ],
  };
  styleRange(sheet, row, 1, 5, { fill: solid(COLOR.highlight), alignment: { vertical: "middle", horizontal: "left", indent: 1 } });
  const ordinaryRate = sums.b > 0 ? sums.g / sums.b : 0;
  const summaryCell = sheet.getCell(row, 6);
  summaryCell.value = fx(`IF(B${totalRowNumber}>0,G${totalRowNumber}/B${totalRowNumber},0)`, ordinaryRate);
  summaryCell.numFmt = "0%";
  summaryCell.fill = solid(COLOR.rose);
  summaryCell.font = { name: FONT_NAME, bold: true, size: 14, color: { argb: COLOR.navy } };
  summaryCell.alignment = { horizontal: "center", vertical: "middle" };
  summaryCell.border = { top: thin(COLOR.navy), bottom: thin(COLOR.navy), left: thin(COLOR.navy), right: thin(COLOR.navy) };
  sheet.getRow(row).height = 28;
  sheet.getRow(row).addPageBreak();
  row += 2;

  return row;
}

function buildClassSheet(workbook, usedNames, ctx) {
  const { group, subjects, labels, summary, params, weeks, hourMinutes, startSerial, endSerial, cf } = ctx;
  const sheet = workbook.addWorksheet(uniqueSheetName(usedNames, group.className), {
    properties: { tabColor: { argb: COLOR.navy } },
    views: [{ showGridLines: false }],
  });
  const widths = [36, 15, 17, 14, 17, 14, 17, 20, 3, 12, 12];
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  sheet.getCell("A1").value = group.className;
  sheet.getCell("A1").font = { name: FONT_NAME, bold: true, size: 22, color: { argb: COLOR.navy } };
  sheet.getRow(1).height = 36;
  sheet.getCell("A2").value = {
    text: `Suivi du temps de scolarisation · ${group.students.length} élève${group.students.length > 1 ? "s" : ""} · période et heures de référence : onglet Paramètres`,
    hyperlink: `#'${PARAMS_SHEET}'!A1`,
  };
  sheet.getCell("A2").font = { name: FONT_NAME, size: 10, italic: true, underline: true, color: { argb: COLOR.muted } };

  let row = 4;
  const sorted = [...group.students].sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));
  for (const student of sorted) {
    row = writeStudentBlock(sheet, row, {
      student,
      label: labels.get(student.id),
      className: group.className,
      subjects,
      params,
      weeks,
      hourMinutes,
      startSerial,
      endSerial,
      summary,
      cf,
    });
  }

  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:H${row}`,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                       */
/* ------------------------------------------------------------------ */

/**
 * Construit le classeur sans le télécharger (séparé de l'export pour pouvoir être testé hors navigateur).
 *
 * Le classeur est « vivant » : l'onglet Données contient tous les appels, l'onglet Paramètres porte la
 * période, les réglages et les heures de référence par classe, et chaque onglet de classe se calcule par
 * formules à partir de ces deux sources. Les valeurs en cache correspondent à la période choisie dans l'app,
 * pour que le fichier s'affiche correctement même dans un lecteur qui ne recalcule pas (aperçu, mode protégé).
 */
export function buildTrackingWorkbook({ students, classes, subjects, records, startDate, endDate, reasonsLookup = new Map(), threshold = 80 }) {
  const start = startDate <= endDate ? startDate : endDate;
  const end = startDate <= endDate ? endDate : startDate;
  const startSerial = excelSerial(start);
  const endSerial = excelSerial(end);
  const weeks = weeksBetween(start, end);

  const classById = new Map(classes.map((c) => [c.id, c]));
  const labels = buildStudentLabels(students, classById);

  const byClass = new Map();
  for (const student of students) {
    const key = classById.has(student.classId) ? student.classId : "orphan";
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key).push(student);
  }
  // Ordonne les onglets comme la liste des classes (déjà triée par nom) plutôt que par ordre
  // d'apparition des élèves, qui dépendrait arbitrairement du tri alphabétique par nom de famille.
  const classGroups = [...classes.map((c) => c.id), "orphan"]
    .filter((id) => byClass.get(id)?.length)
    .map((id) => ({
      key: id,
      className: id === "orphan" ? "Sans classe" : classById.get(id).name,
      students: byClass.get(id),
    }));

  const rows = buildDataRows({ students, subjects, records, labels, reasonsLookup });
  const summary = summarisePeriod(rows, startSerial, endSerial);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cahier d'appel";
  workbook.created = new Date();
  workbook.calcProperties = { fullCalcOnLoad: true };

  const usedNames = new Set([PARAMS_SHEET.toLowerCase(), DATA_SHEET.toLowerCase()]);
  // `rows` est trié par date : première et dernière lignes = bornes des appels disponibles.
  const dataRange = rows.length ? { min: rows[0].serial, max: rows[rows.length - 1].serial } : null;
  const refs = buildParamsSheet(workbook, {
    classGroups,
    subjects,
    startSerial,
    endSerial,
    weeks,
    threshold: threshold / 100,
    dataRange,
  });
  const cf = { priority: 1 };
  for (const group of classGroups) {
    buildClassSheet(workbook, usedNames, {
      group,
      subjects,
      labels,
      summary,
      params: refs.get(group.key),
      weeks,
      hourMinutes: SESSION_MINUTES,
      startSerial,
      endSerial,
      cf,
    });
  }
  buildDataSheet(workbook, rows);

  return { workbook, start, end };
}

/**
 * Génère et télécharge l'export Excel du suivi de présence : un onglet Paramètres (période, réglages,
 * heures de référence par classe), un onglet par classe (un bloc par élève, une ligne par matière) et un
 * onglet Données qui alimente toutes les formules.
 */
export async function exportStudentTrackingExcel(args) {
  if (args.students.length === 0 || args.subjects.length === 0) return;

  const { workbook, start, end } = buildTrackingWorkbook(args);
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
