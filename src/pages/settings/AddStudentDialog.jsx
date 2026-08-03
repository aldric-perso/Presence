import { useState } from "react";
import { createStudent, findDuplicateStudent } from "../../lib/students";
import { Field, Select, TextInput } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import { todayISO } from "../../lib/dates";
import styles from "./StudentImportDialog.module.css";

export default function AddStudentDialog({ students, classes, classById, onClose, onAdded }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [arrivedAt, setArrivedAt] = useState(todayISO());
  const [dupe, setDupe] = useState(null);
  const [pendingCloseAfter, setPendingCloseAfter] = useState(false);
  const [saving, setSaving] = useState(false);

  const effectiveClassId = classId || classes[0]?.id || "";

  function resetFields() {
    setFirstName("");
    setLastName("");
    setArrivedAt(todayISO());
    setDupe(null);
  }

  async function doCreate(closeAfter) {
    setSaving(true);
    await createStudent({
      firstName,
      lastName,
      classId: effectiveClassId,
      className: classById.get(effectiveClassId)?.name,
      arrivedAt,
    });
    onAdded(`${firstName.trim()} ${lastName.trim()}`, classById.get(effectiveClassId)?.name);
    setSaving(false);
    if (closeAfter) {
      onClose();
    } else {
      resetFields();
    }
  }

  function handleSubmit(closeAfter) {
    if (!firstName.trim() || !lastName.trim()) return;
    const found = findDuplicateStudent(students, firstName, lastName);
    if (found) {
      setDupe(found);
      setPendingCloseAfter(closeAfter);
      return;
    }
    doCreate(closeAfter);
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} style={{ maxWidth: 560 }}>
        <div className={styles.header}>
          <div className="eyebrow">Élèves</div>
          <h2 className={styles.title}>Ajouter un élève</h2>
          <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: 0 }}>
            La saisie est comparée aux élèves existants en ignorant accents, tirets, espaces et casse.
          </p>
        </div>

        <div className={styles.body}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Prénom">
              <TextInput
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Léa"
                autoFocus
              />
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
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button onClick={() => setDupe(null)}>C'est la même personne</Button>
                <Button variant="ghost" onClick={() => doCreate(pendingCloseAfter)} disabled={saving}>
                  C'est bien un autre élève
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="ghost" onClick={() => handleSubmit(false)} disabled={saving || !!dupe}>
            Ajouter un autre élève
          </Button>
          <Button onClick={() => handleSubmit(true)} disabled={saving || !!dupe}>
            Ajouter et quitter
          </Button>
        </div>
      </div>
    </div>
  );
}
