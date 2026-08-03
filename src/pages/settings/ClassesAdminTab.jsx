import { useState } from "react";
import { useClasses, createClass, archiveClass, findDuplicateClass } from "../../lib/classes";
import { useTeachers } from "../../lib/users";
import { useStudents } from "../../lib/students";
import { Field, TextInput } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import styles from "./Shared.module.css";

export default function ClassesAdminTab({ isAdmin }) {
  const { data: classes } = useClasses();
  const { data: teachers } = useTeachers();
  const { data: students } = useStudents();

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [pendingArchive, setPendingArchive] = useState(null);

  async function handleCreate() {
    if (!name.trim()) return;
    const dupe = findDuplicateClass(classes, name);
    if (dupe) {
      setMessage(`Une classe très proche existe déjà : « ${dupe.name} ». Aucune création.`);
      return;
    }
    await createClass({ name });
    setName("");
    setMessage(`Classe « ${name.trim()} » créée.`);
  }

  return (
    <div>
      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div className={styles.formTitle}>Créer une classe</div>
          <p className={styles.formHint}>
            Le nom est comparé aux classes existantes en ignorant accents, tirets, espaces et casse.
          </p>
          <div className={styles.formGrid} style={{ gridTemplateColumns: "1fr auto" }}>
            <Field label="Nom de la classe">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="3ᵉ" />
            </Field>
            <Button onClick={handleCreate}>Créer</Button>
          </div>
          {message && <p style={{ marginTop: 14, fontSize: 13, color: "var(--color-ink-soft)" }}>{message}</p>}
        </div>
      )}

      <div className={["card", styles.listCard].join(" ")}>
        <div className={styles.tableHead} style={{ gridTemplateColumns: "1.3fr 0.7fr 1.6fr 100px" }}>
          <span>Classe</span>
          <span>Effectif</span>
          <span>Enseignants affectés</span>
          <span></span>
        </div>
        {classes.map((c) => {
          const effectif = students.filter((s) => s.classId === c.id).length;
          const profs = teachers.filter((t) => (t.classIds || []).includes(c.id)).map((t) => t.displayName);
          return (
            <div key={c.id} className={styles.tableRow} style={{ gridTemplateColumns: "1.3fr 0.7fr 1.6fr 100px" }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span style={{ color: "var(--color-ink-soft)" }}>{effectif} élèves</span>
              <span style={{ color: "var(--color-ink-soft)", fontSize: 13 }}>
                {profs.join(", ") || "Aucun enseignant affecté"}
              </span>
              {isAdmin && (
                <button
                  onClick={() => setPendingArchive(c)}
                  style={{ background: "transparent", border: "none", color: "var(--color-red)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Archiver
                </button>
              )}
            </div>
          );
        })}
        {classes.length === 0 && <div className={styles.emptyMsg}>Aucune classe pour le moment.</div>}
      </div>

      {pendingArchive && (
        <Modal
          kicker="Suppression"
          title={`Archiver « ${pendingArchive.name} » ?`}
          text="La classe sort des listes d'appel. Les appels déjà enregistrés et l'historique des élèves sont conservés."
          detail={`${students.filter((s) => s.classId === pendingArchive.id).length} élèves devront être réaffectés.`}
          confirmLabel="Archiver"
          cancelLabel="Annuler"
          onCancel={() => setPendingArchive(null)}
          onConfirm={async () => {
            await archiveClass(pendingArchive.id);
            setPendingArchive(null);
          }}
        />
      )}
    </div>
  );
}
