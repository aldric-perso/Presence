import { useState } from "react";
import {
  useTeachers,
  createTeacherAccount,
  setUserRole,
  setTeacherActive,
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
  const [createdInfo, setCreatedInfo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [roleError, setRoleError] = useState("");
  const [pendingRoleChange, setPendingRoleChange] = useState(null);
  const [activeError, setActiveError] = useState("");
  const [pendingActiveChange, setPendingActiveChange] = useState(null);

  async function handleCreate() {
    if (!displayName.trim() || !email.trim()) return;
    setError("");
    const dupe = findDuplicateTeacher(teachers, displayName);
    if (dupe) {
      setError("Un enseignant portant un nom très proche existe déjà.");
      return;
    }
    if (!email.trim().toLowerCase().endsWith("@gmail.com")) {
      setError(
        "L'adresse doit être une adresse Gmail (@gmail.com). Les autres domaines (académies, FAI comme numericable.fr) bloquent souvent l'e-mail automatique de définition du mot de passe.",
      );
      return;
    }
    setCreating(true);
    try {
      await createTeacherAccount({
        displayName: displayName.trim(),
        email: email.trim(),
        role: asAdmin ? "admin" : "teacher",
        classIds: [],
        subjectIds: [],
      });
      setCreatedInfo({ displayName: displayName.trim(), email: email.trim() });
      setDisplayName("");
      setEmail("");
      setAsAdmin(false);
    } catch (err) {
      setError(
        err.code === "auth/email-already-in-use"
          ? "Un compte Authentication existe déjà avec cette adresse e-mail — si tu as supprimé cette personne directement dans Firestore (et non depuis cette page), son compte de connexion existe encore. Utilise `npm run delete-orphan-account -- email` en local pour le supprimer, puis recrée le compte ici."
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
        err.code === "failed-precondition"
          ? "Impossible de retirer le dernier compte administrateur."
          : "Le changement de rôle a échoué.",
      );
    }
  }

  async function handleToggleActive(t) {
    setActiveError("");
    try {
      await setTeacherActive(t.id, t.active === false);
    } catch (err) {
      setActiveError(
        err.code === "failed-precondition"
          ? "Impossible de désactiver le dernier compte administrateur."
          : "Le changement a échoué.",
      );
    }
  }

  return (
    <div>
      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div className={styles.formTitle}>Créer un compte</div>
          <p className={styles.formHint}>
            L'enseignant reçoit un lien pour définir son mot de passe (pense à lui dire de vérifier
            ses spams, l'e-mail y atterrit parfois). Un administrateur peut créer des classes, des
            matières et corriger un appel verrouillé.{" "}
            <strong>L'adresse doit être une adresse Gmail</strong> (@gmail.com) — les autres
            domaines (académies, FAI) bloquent souvent l'e-mail automatique de Firebase.
          </p>
          <div className={[styles.formGrid, styles.responsiveFormGrid].join(" ")} style={{ gridTemplateColumns: "1.2fr 1.2fr auto auto" }}>
            <Field label="Nom complet">
              <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Hélène Vasseur" />
            </Field>
            <Field label="Adresse e-mail (Gmail)">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="h.vasseur@gmail.com"
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
      {activeError && <p style={{ marginBottom: 14, fontSize: 13, color: "var(--color-red)" }}>{activeError}</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {teachers.map((t) => {
          // Ne compte/n'affiche que les classes et matières qui existent encore : une matière ou
          // une classe supprimée peut laisser un ID fantôme dans le profil (ex. suppression
          // manuelle dans Firestore, en dehors de l'appli) — sans ce filtre, le récapitulatif
          // affiche un nombre qui ne correspond à rien de visible dans l'éditeur ci-dessous.
          const validClassIds = (t.classIds || []).filter((id) => classes.some((c) => c.id === id));
          const validSubjectIds = (t.subjectIds || []).filter((id) => subjects.some((s) => s.id === id));

          const isInactive = t.active === false;

          return (
            <div
              key={t.id}
              className={["card", styles.groupCard].join(" ")}
              style={isInactive ? { opacity: 0.6 } : undefined}
            >
              <div className={styles.groupHeader}>
                <Avatar name={t.displayName} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{t.displayName}</span>
                    {t.role === "admin" && <Badge tone="green">Admin</Badge>}
                    {isInactive && <Badge tone="red">Désactivé</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-soft)", marginTop: 3 }}>
                    {t.email} · {validSubjectIds.length} matière(s) · {validClassIds.length} classe(s)
                  </div>
                </div>
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setPendingRoleChange(t)}>
                      Basculer admin
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setEditingId(editingId === t.id ? null : t.id)}
                    >
                      Affectations
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingActiveChange(t)}>
                      {isInactive ? "Réactiver" : "Désactiver"}
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
                          active={validClassIds.includes(c.id)}
                          onClick={() =>
                            updateTeacherAssignments(t.id, {
                              classIds: toggleId(validClassIds, c.id),
                              subjectIds: validSubjectIds,
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
                          active={validSubjectIds.includes(s.id)}
                          onClick={() =>
                            updateTeacherAssignments(t.id, {
                              classIds: validClassIds,
                              subjectIds: toggleId(validSubjectIds, s.id),
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
          );
        })}
      </div>

      {createdInfo && (
        <Modal
          kicker="Compte créé"
          title={`Bienvenue à ${createdInfo.displayName}`}
          text={`Un e-mail vient d'être envoyé à ${createdInfo.email} pour définir son mot de passe et se connecter. Pense à lui dire de vérifier ses spams s'il ne le voit pas arriver.`}
          cancelLabel="Fermer"
          onCancel={() => setCreatedInfo(null)}
        />
      )}

      {pendingRoleChange && (
        <Modal
          kicker="Rôle"
          title={
            pendingRoleChange.role === "admin"
              ? `Retirer les droits admin à ${pendingRoleChange.displayName} ?`
              : `Donner les droits admin à ${pendingRoleChange.displayName} ?`
          }
          text={
            pendingRoleChange.role === "admin"
              ? "Cette personne redeviendra enseignant·e simple et perdra l'accès aux réglages d'administration."
              : "Cette personne pourra gérer les classes, matières, comptes enseignants et corriger un appel verrouillé."
          }
          confirmLabel="Confirmer"
          cancelLabel="Annuler"
          danger={pendingRoleChange.role === "admin"}
          onCancel={() => setPendingRoleChange(null)}
          onConfirm={async () => {
            await handleToggleAdmin(pendingRoleChange);
            setPendingRoleChange(null);
          }}
        />
      )}

      {pendingActiveChange && (
        <Modal
          kicker="Accès à l'application"
          title={
            pendingActiveChange.active === false
              ? `Réactiver ${pendingActiveChange.displayName} ?`
              : `Désactiver ${pendingActiveChange.displayName} ?`
          }
          text={
            pendingActiveChange.active === false
              ? "Cette personne retrouve l'accès à l'application avec son compte existant."
              : "Cette personne ne pourra plus se connecter à l'application. Son nom reste affiché tel quel sur les appels déjà enregistrés — rien n'est supprimé ni modifié dans l'historique."
          }
          confirmLabel="Confirmer"
          cancelLabel="Annuler"
          danger={pendingActiveChange.active !== false}
          onCancel={() => setPendingActiveChange(null)}
          onConfirm={async () => {
            await handleToggleActive(pendingActiveChange);
            setPendingActiveChange(null);
          }}
        />
      )}
    </div>
  );
}

function toggleId(list = [], id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
