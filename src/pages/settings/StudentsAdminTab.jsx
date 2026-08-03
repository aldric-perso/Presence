import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStudents, createStudent, findDuplicateStudent } from "../../lib/students";
import { useClasses } from "../../lib/classes";
import { parseStudentsWorkbook, buildImportDiff, exportStudentsWorkbook } from "../../lib/studentImport";
import { Field, Select, TextInput } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { formatDateShort, todayISO } from "../../lib/dates";
import StudentImportDialog from "./StudentImportDialog";
import StudentManageDialog from "./StudentManageDialog";
import styles from "./Shared.module.css";

const ROW_COLUMNS = "1.3fr 1fr 1fr 1fr 170px";

export default function StudentsAdminTab({ isAdmin }) {
  const { data: students } = useStudents();
  const { data: classes } = useClasses();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [arrivedAt, setArrivedAt] = useState(todayISO());
  const [dupe, setDupe] = useState(null);
  const [message, setMessage] = useState("");
  const [managingId, setManagingId] = useState(null);
  const [importDiff, setImportDiff] = useState(null);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

  const classById = new Map(classes.map((c) => [c.id, c]));
  const effectiveClassId = classId || classes[0]?.id || "";
  const managingStudent = students.find((s) => s.id === managingId) || null;

  async function handleAdd() {
    if (!firstName.trim() || !lastName.trim()) return;
    const found = findDuplicateStudent(students, firstName, lastName);
    if (found) {
      setDupe(found);
      return;
    }
    await createStudent({
      firstName,
      lastName,
      classId: effectiveClassId,
      className: classById.get(effectiveClassId)?.name,
      arrivedAt,
    });
    setMessage(`${firstName.trim()} ${lastName.trim()} a été ajouté·e à ${classById.get(effectiveClassId)?.name || ""}.`);
    setFirstName("");
    setLastName("");
    setArrivedAt(todayISO());
    setDupe(null);
  }

  function dismissDupe(keepExisting) {
    setDupe(null);
    setFirstName("");
    setLastName("");
    setMessage(
      keepExisting
        ? "Aucun élève créé — la fiche existante a été conservée."
        : "L'élève sera créé comme distinct si tu confirmes l'ajout à nouveau.",
    );
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
        <div className={["card", styles.formCard].join(" ")}>
          <div className={styles.formTitle}>Ajouter un élève</div>
          <p className={styles.formHint}>
            La saisie est comparée aux élèves existants en ignorant accents, tirets, espaces et casse.
          </p>
          <div className={styles.formGrid} style={{ gridTemplateColumns: "1fr 1fr 1.2fr 0.9fr auto" }}>
            <Field label="Prénom">
              <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Léa" />
            </Field>
            <Field label="Nom">
              <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Bel-Hadj" />
            </Field>
            <Field label="Classe">
              <Select value={effectiveClassId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Arrivée le">
              <TextInput type="date" value={arrivedAt} onChange={(e) => setArrivedAt(e.target.value)} />
            </Field>
            <Button onClick={handleAdd}>Ajouter</Button>
          </div>

          {dupe && (
            <div
              className="animate-pop"
              style={{
                marginTop: 18,
                border: "1px solid rgba(176,123,35,0.35)",
                background: "var(--color-amber-bg)",
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-amber-dark)" }}>
                Un élève très proche existe déjà
              </div>
              <div style={{ display: "flex", gap: 18, margin: "14px 0 16px" }}>
                <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 600 }}>
                    Existant
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{dupe.fullName}</div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-soft)" }}>
                    {classById.get(dupe.classId)?.name}
                  </div>
                </div>
                <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 600 }}>
                    Saisie
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>
                    {firstName} {lastName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-soft)" }}>
                    Différence d'accent, tiret ou espace probable
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button onClick={() => dismissDupe(true)}>C'est la même personne</Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await createStudent({
                      firstName,
                      lastName,
                      classId: effectiveClassId,
                      className: classById.get(effectiveClassId)?.name,
                      arrivedAt,
                    });
                    dismissDupe(false);
                  }}
                >
                  C'est bien un autre élève
                </Button>
              </div>
            </div>
          )}
          {message && !dupe && (
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--color-green)", fontWeight: 600 }}>
              {message}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div className={styles.formTitle}>Import / export Excel</div>
            <p className={styles.formHint} style={{ margin: 0 }}>
              Le fichier attend les colonnes Prénom, Nom, Classe, Arrivé le, Parti le. Les nouveaux
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

      <div className={["card", styles.listCard].join(" ")}>
        <div className={styles.tableHead} style={{ gridTemplateColumns: ROW_COLUMNS }}>
          <span>Élève</span>
          <span>Classe</span>
          <span>Arrivé le</span>
          <span>Parti le</span>
          <span></span>
        </div>
        {students.map((s) => (
          <div key={s.id} className={styles.tableRow} style={{ gridTemplateColumns: ROW_COLUMNS }}>
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
        {students.length === 0 && <div className={styles.emptyMsg}>Aucun élève pour le moment.</div>}
      </div>

      {importDiff && <StudentImportDialog diff={importDiff} onClose={() => setImportDiff(null)} />}

      {managingStudent && (
        <StudentManageDialog
          student={managingStudent}
          classes={classes}
          classById={classById}
          isAdmin={isAdmin}
          onClose={() => setManagingId(null)}
        />
      )}
    </div>
  );
}
