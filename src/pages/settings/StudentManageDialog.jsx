import { useState } from "react";
import {
  changeStudentClass,
  markStudentDeparted,
  reactivateStudent,
  updateStudentName,
} from "../../lib/students";
import { todayISO } from "../../lib/dates";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Field, Select, TextInput } from "../../components/ui/Field";
import styles from "./StudentImportDialog.module.css";

export default function StudentManageDialog({ student, classes, classById, onClose }) {
  const [firstName, setFirstName] = useState(student.firstName);
  const [lastName, setLastName] = useState(student.lastName);
  const [savingName, setSavingName] = useState(false);

  const [newClassId, setNewClassId] = useState(student.classId);
  const [changeDate, setChangeDate] = useState(todayISO());
  const [savingClass, setSavingClass] = useState(false);

  const [departDate, setDepartDate] = useState(todayISO());
  const [savingDepart, setSavingDepart] = useState(false);

  async function handleSaveName() {
    if (!firstName.trim() || !lastName.trim()) return;
    setSavingName(true);
    await updateStudentName(student.id, { firstName, lastName });
    setSavingName(false);
  }

  async function handleChangeClass() {
    setSavingClass(true);
    await changeStudentClass(student.id, {
      classId: newClassId,
      className: classById.get(newClassId)?.name,
      date: changeDate,
    });
    setSavingClass(false);
  }

  async function handleDepart() {
    setSavingDepart(true);
    await markStudentDeparted(student.id, departDate);
    setSavingDepart(false);
  }

  async function handleReactivate() {
    setSavingDepart(true);
    await reactivateStudent(student.id);
    setSavingDepart(false);
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} style={{ maxWidth: 560 }}>
        <div className={styles.header}>
          <div className="eyebrow">Gérer l'élève</div>
          <h2 className={styles.title}>{student.fullName}</h2>
          <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: 0 }}>
            Classe actuelle : {classById.get(student.classId)?.name || "—"}
            {student.departedAt && (
              <>
                {" · "}
                <Badge tone="red">Parti le {student.departedAt}</Badge>
              </>
            )}
          </p>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Renommer</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <Field label="Prénom">
                <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </Field>
              <Field label="Nom">
                <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </Field>
              <Button size="sm" onClick={handleSaveName} disabled={savingName}>
                Enregistrer
              </Button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Changer de classe</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <Field label="Nouvelle classe">
                <Select value={newClassId} onChange={(e) => setNewClassId(e.target.value)}>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="À partir du">
                <TextInput type="date" value={changeDate} onChange={(e) => setChangeDate(e.target.value)} />
              </Field>
              <Button size="sm" onClick={handleChangeClass} disabled={savingClass}>
                Confirmer
              </Button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Présence à l'établissement</div>
            {student.departedAt ? (
              <Button size="sm" variant="ghost" onClick={handleReactivate} disabled={savingDepart}>
                Marquer comme de retour
              </Button>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                <Field label="Départ le">
                  <TextInput type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)} />
                </Field>
                <Button size="sm" variant="ghost" onClick={handleDepart} disabled={savingDepart}>
                  Marquer comme parti
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
