import { useState } from "react";
import { useSubjects, createSubject, removeSubject, findDuplicateSubject } from "../../lib/subjects";
import { useTeachers } from "../../lib/users";
import { Field, TextInput } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import styles from "./Shared.module.css";

export default function SubjectsAdminTab({ isAdmin }) {
  const { data: subjects } = useSubjects();
  const { data: teachers } = useTeachers();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [pendingRemove, setPendingRemove] = useState(null);

  async function handleAdd() {
    if (!name.trim()) return;
    if (findDuplicateSubject(subjects, name)) {
      setMessage("Cette matière existe déjà.");
      return;
    }
    await createSubject(name);
    setMessage(`Matière « ${name.trim()} » ajoutée.`);
    setName("");
  }

  return (
    <div>
      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div className={styles.formTitle}>Ajouter une matière</div>
          <p className={styles.formHint}>Toutes les séances durent 50 minutes — c'est la base du calcul de présence.</p>
          <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
            <div style={{ flex: 1, maxWidth: 320 }}>
              <Field label="Intitulé">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Musique" />
              </Field>
            </div>
            <Button onClick={handleAdd}>Ajouter</Button>
          </div>
          {message && <p style={{ marginTop: 14, fontSize: 13, color: "var(--color-ink-soft)" }}>{message}</p>}
        </div>
      )}

      <div className={styles.cardsGrid}>
        {subjects.map((s) => {
          const nbProfs = teachers.filter((t) => (t.subjectIds || []).includes(s.id)).length;
          return (
            <div key={s.id} className={["card", styles.simpleCard].join(" ")}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                  {s.sessionMinutes} min · {nbProfs} enseignant(s)
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setPendingRemove(s)}
                  style={{ background: "transparent", border: "none", color: "var(--color-red)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Retirer
                </button>
              )}
            </div>
          );
        })}
        {subjects.length === 0 && <div className={styles.emptyMsg}>Aucune matière pour le moment.</div>}
      </div>

      {pendingRemove && (
        <Modal
          kicker="Suppression"
          title={`Retirer « ${pendingRemove.name} » ?`}
          text="Cette matière ne sera plus proposée lors de la création d'un appel. Les appels déjà enregistrés ne sont pas modifiés."
          detail={
            teachers.filter((t) => (t.subjectIds || []).includes(pendingRemove.id)).length > 0
              ? `${teachers.filter((t) => (t.subjectIds || []).includes(pendingRemove.id)).length} enseignant(s) ont actuellement cette matière affectée.`
              : undefined
          }
          confirmLabel="Retirer"
          cancelLabel="Annuler"
          danger
          onCancel={() => setPendingRemove(null)}
          onConfirm={async () => {
            await removeSubject(pendingRemove.id);
            setPendingRemove(null);
          }}
        />
      )}
    </div>
  );
}
