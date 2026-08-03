import { useState } from "react";
import {
  useTeachers,
  createTeacherAccount,
  setUserRole,
  updateTeacherAssignments,
  findDuplicateTeacher,
} from "../../lib/users";
import { useClasses } from "../../lib/classes";
import { useSubjects } from "../../lib/subjects";
import { Field, TextInput } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import { Pill } from "../../components/ui/Pill";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import Modal from "../../components/ui/Modal";
import styles from "./Shared.module.css";

export default function TeachersAdminTab({ isAdmin }) {
  const { data: teachers } = useTeachers();
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [resetInfo, setResetInfo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [roleError, setRoleError] = useState("");

  async function handleCreate() {
    if (!displayName.trim() || !email.trim()) return;
    setError("");
    const dupe = findDuplicateTeacher(teachers, displayName);
    if (dupe) {
      setError("Un enseignant portant un nom très proche existe déjà.");
      return;
    }
    setCreating(true);
    try {
      const { resetLink } = await createTeacherAccount({
        displayName: displayName.trim(),
        email: email.trim(),
        role: asAdmin ? "admin" : "teacher",
        classIds: [],
        subjectIds: [],
      });
      setResetInfo({ displayName: displayName.trim(), email: email.trim(), resetLink });
      setDisplayName("");
      setEmail("");
      setAsAdmin(false);
    } catch (err) {
      setError(
        err.code === "functions/already-exists"
          ? "Un compte existe déjà avec cette adresse e-mail."
          : "La création du compte a échoué.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleAdmin(t) {
    setRoleError("");
    try {
      await setUserRole(t.id, t.role === "admin" ? "teacher" : "admin");
    } catch (err) {
      setRoleError(
        err.code === "functions/failed-precondition"
          ? "Impossible de retirer le dernier compte administrateur."
          : "Le changement de rôle a échoué.",
      );
    }
  }

  return (
    <div>
      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div className={styles.formTitle}>Créer un compte</div>
          <p className={styles.formHint}>
            L'enseignant reçoit un lien pour définir son mot de passe. Un administrateur peut créer
            des classes, des matières et corriger un appel verrouillé.
          </p>
          <div className={styles.formGrid} style={{ gridTemplateColumns: "1.2fr 1.2fr auto auto" }}>
            <Field label="Nom complet">
              <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Hélène Vasseur" />
            </Field>
            <Field label="Adresse e-mail">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="h.vasseur@etablissement.fr"
              />
            </Field>
            <Pill active={asAdmin} tone="green" onClick={() => setAsAdmin((v) => !v)}>
              Rôle admin{asAdmin ? " ✓" : ""}
            </Pill>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Création…" : "Créer"}
            </Button>
          </div>
          {error && <p style={{ marginTop: 14, fontSize: 13, color: "var(--color-red)" }}>{error}</p>}
        </div>
      )}

      {roleError && <p style={{ marginBottom: 14, fontSize: 13, color: "var(--color-red)" }}>{roleError}</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {teachers.map((t) => (
          <div key={t.id} className={["card", styles.groupCard].join(" ")}>
            <div className={styles.groupHeader}>
              <Avatar name={t.displayName} size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{t.displayName}</span>
                  {t.role === "admin" && <Badge tone="green">Admin</Badge>}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-ink-soft)", marginTop: 3 }}>
                  {t.email} · {(t.subjectIds || []).length} matière(s) · {(t.classIds || []).length} classe(s)
                </div>
              </div>
              {isAdmin && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleAdmin(t)}>
                    Basculer admin
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setEditingId(editingId === t.id ? null : t.id)}
                  >
                    Affectations
                  </Button>
                </>
              )}
            </div>

            {editingId === t.id && (
              <div className={[styles.groupBody, "animate-pop"].join(" ")}>
                <div>
                  <div className={styles.toggleLabel}>Classes affectées</div>
                  <div className={styles.chipRow}>
                    {classes.map((c) => (
                      <Pill
                        key={c.id}
                        active={(t.classIds || []).includes(c.id)}
                        onClick={() =>
                          updateTeacherAssignments(t.id, {
                            classIds: toggleId(t.classIds, c.id),
                            subjectIds: t.subjectIds || [],
                          })
                        }
                      >
                        {c.name}
                      </Pill>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={styles.toggleLabel}>Matières enseignées</div>
                  <div className={styles.chipRow}>
                    {subjects.map((s) => (
                      <Pill
                        key={s.id}
                        tone="green"
                        active={(t.subjectIds || []).includes(s.id)}
                        onClick={() =>
                          updateTeacherAssignments(t.id, {
                            classIds: t.classIds || [],
                            subjectIds: toggleId(t.subjectIds, s.id),
                          })
                        }
                      >
                        {s.name}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {resetInfo && (
        <Modal
          kicker="Compte créé"
          title={`Bienvenue à ${resetInfo.displayName}`}
          text={`Transmets ce lien à ${resetInfo.email} pour qu'il ou elle définisse son mot de passe. Le lien expire après un délai limité.`}
          detail={resetInfo.resetLink}
          cancelLabel="Fermer"
          onCancel={() => setResetInfo(null)}
        />
      )}
    </div>
  );
}

function toggleId(list = [], id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
