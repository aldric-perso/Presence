import { useState } from "react";
import { Link } from "react-router-dom";
import { useStudents, createStudent, findDuplicateStudent } from "../../lib/students";
import { useClasses } from "../../lib/classes";
import { Field, Select, TextInput } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import { formatDateShort } from "../../lib/dates";
import styles from "./Shared.module.css";

export default function StudentsAdminTab({ isAdmin }) {
  const { data: students } = useStudents();
  const { data: classes } = useClasses();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [dupe, setDupe] = useState(null);
  const [message, setMessage] = useState("");

  const classById = new Map(classes.map((c) => [c.id, c]));
  const effectiveClassId = classId || classes[0]?.id || "";

  async function handleAdd() {
    if (!firstName.trim() || !lastName.trim()) return;
    const found = findDuplicateStudent(students, firstName, lastName);
    if (found) {
      setDupe(found);
      return;
    }
    await createStudent({ firstName, lastName, classId: effectiveClassId });
    setMessage(`${firstName.trim()} ${lastName.trim()} a été ajouté·e à ${classById.get(effectiveClassId)?.name || ""}.`);
    setFirstName("");
    setLastName("");
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

  return (
    <div>
      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div className={styles.formTitle}>Ajouter un élève</div>
          <p className={styles.formHint}>
            La saisie est comparée aux élèves existants en ignorant accents, tirets, espaces et casse.
          </p>
          <div className={styles.formGrid} style={{ gridTemplateColumns: "1fr 1fr 1.2fr auto" }}>
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
                    await createStudent({ firstName, lastName, classId: effectiveClassId });
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

      <div className={["card", styles.listCard].join(" ")}>
        <div className={styles.tableHead} style={{ gridTemplateColumns: "1.4fr 1fr 1fr auto" }}>
          <span>Élève</span>
          <span>Classe</span>
          <span>Ajouté le</span>
          <span></span>
        </div>
        {students.map((s) => (
          <div key={s.id} className={styles.tableRow} style={{ gridTemplateColumns: "1.4fr 1fr 1fr auto" }}>
            <span style={{ fontWeight: 600 }}>{s.fullName}</span>
            <span style={{ color: "var(--color-ink-soft)" }}>{classById.get(s.classId)?.name || "—"}</span>
            <span style={{ color: "var(--color-ink-soft)" }}>
              {s.createdAt ? formatDateShort(s.createdAt.toDate().toISOString().slice(0, 10)) : "—"}
            </span>
            <Link to={`/eleves?id=${s.id}`} style={{ fontSize: 13, fontWeight: 600 }}>
              Voir le suivi
            </Link>
          </div>
        ))}
        {students.length === 0 && <div className={styles.emptyMsg}>Aucun élève pour le moment.</div>}
      </div>
    </div>
  );
}
