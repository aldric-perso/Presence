import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStudents } from "../../lib/students";
import { useClasses } from "../../lib/classes";
import { useAllRecords } from "../../lib/attendance";
import { parseStudentsWorkbook, buildImportDiff, exportStudentsWorkbook } from "../../lib/studentImport";
import { TextInput } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { formatDateShort, todayISO } from "../../lib/dates";
import { normalize } from "../../lib/ids";
import StudentImportDialog from "./StudentImportDialog";
import StudentManageDialog from "./StudentManageDialog";
import AddStudentDialog from "./AddStudentDialog";
import styles from "./Shared.module.css";

const ROW_COLUMNS = "1.3fr 1fr 1fr 1fr 170px";

/** Compare deux valeurs pour le tri du tableau ; les valeurs vides passent toujours en dernier. */
function compareSortValues(a, b) {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  return String(a).localeCompare(String(b), "fr", { sensitivity: "base" });
}

function SortableHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return (
    <button type="button" className={styles.sortableHead} onClick={() => onSort(sortKey)}>
      {label}
      <span className={styles.sortArrow}>{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
    </button>
  );
}

export default function StudentsAdminTab({ isAdmin }) {
  const { data: students } = useStudents();
  const { data: classes } = useClasses();
  const { data: records } = useAllRecords();

  const [search, setSearch] = useState("");
  const [showDeparted, setShowDeparted] = useState(false);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [message, setMessage] = useState("");
  const [managingId, setManagingId] = useState(null);
  const [importDiff, setImportDiff] = useState(null);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const managingStudent = students.find((s) => s.id === managingId) || null;

  const filteredStudents = useMemo(() => {
    const q = normalize(search.trim());
    return students.filter((s) => {
      if (!showDeparted && s.departedAt) return false;
      if (q && !normalize(s.fullName).includes(q)) return false;
      return true;
    });
  }, [students, search, showDeparted]);

  const sortedStudents = useMemo(() => {
    if (!sort.key) return filteredStudents;
    const getValue = {
      name: (s) => s.fullName,
      class: (s) => classById.get(s.classId)?.name || "",
      arrivedAt: (s) => s.arrivedAt,
      departedAt: (s) => s.departedAt,
    }[sort.key];
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...filteredStudents].sort((a, b) => sign * compareSortValues(getValue(a), getValue(b)));
  }, [filteredStudents, sort, classById]);

  function toggleSort(key) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    try {
      const rows = await parseStudentsWorkbook(file);
      if (rows.length === 0) {
        setImportError("Aucune ligne exploitable trouvée dans ce fichier.");
        return;
      }
      const diff = buildImportDiff({ rows, existingStudents: students, classes, importDate: todayISO() });
      setImportDiff(diff);
    } catch {
      setImportError("Impossible de lire ce fichier. Vérifie qu'il s'agit bien d'un .xlsx.");
    }
  }

  return (
    <div>
      {isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <Button onClick={() => setShowAddDialog(true)}>+ Ajouter élève</Button>
          {message && <div style={{ fontSize: 13, color: "var(--color-green)", fontWeight: 600 }}>{message}</div>}
        </div>
      )}

      {isAdmin && (
        <div
          className={["card", styles.formCard, styles.desktopOnly].join(" ")}
          style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}
        >
          <div style={{ flex: 1 }}>
            <div className={styles.formTitle}>Import / export Excel</div>
            <p className={styles.formHint} style={{ margin: 0 }}>
              Le fichier attend les colonnes Prénom, Nom, Classe, Arrivé(e) le, Parti(e) le. Les nouveaux
              noms sont ajoutés, les changements de classe ambigus te sont demandés, et tout élève
              absent du fichier est considéré parti à la date de l'import.
            </p>
            {importError && (
              <p style={{ marginTop: 10, fontSize: 13, color: "var(--color-red)" }}>{importError}</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
            Importer un fichier Excel
          </Button>
          <Button variant="ghost" onClick={() => exportStudentsWorkbook(students, classes)} disabled={!students.length}>
            Exporter en Excel
          </Button>
        </div>
      )}

      <div className={styles.searchRow}>
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un élève…"
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 10 }}>
          <input type="checkbox" checked={showDeparted} onChange={(e) => setShowDeparted(e.target.checked)} />
          Afficher les élèves parti(e)s
        </label>
      </div>

      <div className={["card", styles.listCard].join(" ")}>
        <div className={[styles.tableHead, styles.tableWide].join(" ")} style={{ gridTemplateColumns: ROW_COLUMNS }}>
          <SortableHeader label="Élève" sortKey="name" sort={sort} onSort={toggleSort} />
          <SortableHeader label="Classe" sortKey="class" sort={sort} onSort={toggleSort} />
          <SortableHeader label="Arrivé(e) le" sortKey="arrivedAt" sort={sort} onSort={toggleSort} />
          <SortableHeader label="Parti(e) le" sortKey="departedAt" sort={sort} onSort={toggleSort} />
          <span></span>
        </div>
        {sortedStudents.map((s) => (
          <div key={s.id} className={[styles.tableRow, styles.tableWide].join(" ")} style={{ gridTemplateColumns: ROW_COLUMNS }}>
            <span style={{ fontWeight: 600 }}>{s.fullName}</span>
            <span style={{ color: "var(--color-ink-soft)" }}>{classById.get(s.classId)?.name || "—"}</span>
            <span style={{ color: "var(--color-ink-soft)" }}>{s.arrivedAt ? formatDateShort(s.arrivedAt) : "—"}</span>
            <span>
              {s.departedAt ? (
                <Badge tone="red">{formatDateShort(s.departedAt)}</Badge>
              ) : (
                <span style={{ color: "var(--color-muted)" }}>—</span>
              )}
            </span>
            <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "flex-end" }}>
              <button
                onClick={() => setManagingId(s.id)}
                style={{ background: "transparent", border: "none", color: "var(--color-ink)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Gérer
              </button>
              <Link to={`/eleves?id=${s.id}`} style={{ fontSize: 13, fontWeight: 600 }}>
                Voir le suivi
              </Link>
            </div>
          </div>
        ))}
        {sortedStudents.length === 0 && (
          <div className={styles.emptyMsg}>
            {students.length === 0 ? "Aucun élève pour le moment." : "Aucun élève ne correspond à la recherche."}
          </div>
        )}
      </div>

      {importDiff && <StudentImportDialog diff={importDiff} onClose={() => setImportDiff(null)} />}

      {managingStudent && (
        <StudentManageDialog
          student={managingStudent}
          classes={classes}
          classById={classById}
          students={students}
          records={records}
          isAdmin={isAdmin}
          onClose={() => setManagingId(null)}
        />
      )}

      {showAddDialog && (
        <AddStudentDialog
          students={students}
          classes={classes}
          classById={classById}
          onClose={() => setShowAddDialog(false)}
          onAdded={(name, className) => setMessage(`${name} a été ajouté·e à ${className || ""}.`)}
        />
      )}
    </div>
  );
}
