import { useMemo, useState } from "react";
import {
  changeStudentClass,
  deleteStudent,
  markStudentDeparted,
  mergeStudents,
  reactivateStudent,
  updateStudentName,
} from "../../lib/students";
import { recordsReferencingStudent } from "../../lib/attendance";
import { todayISO } from "../../lib/dates";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Callout from "../../components/ui/Callout";
import { Field, Select, TextInput } from "../../components/ui/Field";
import styles from "./StudentImportDialog.module.css";
import sharedStyles from "./Shared.module.css";

export default function StudentManageDialog({ student, classes, classById, students, records, isAdmin, onClose }) {
  const [firstName, setFirstName] = useState(student.firstName);
  const [lastName, setLastName] = useState(student.lastName);
  const [savingName, setSavingName] = useState(false);

  const [newClassId, setNewClassId] = useState(student.classId);
  const [changeDate, setChangeDate] = useState(todayISO());
  const [savingClass, setSavingClass] = useState(false);

  const [departDate, setDepartDate] = useState(todayISO());
  const [savingDepart, setSavingDepart] = useState(false);

  // null | 'choose' | 'confirm' | 'merge'
  const [deleteStage, setDeleteStage] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");

  const otherStudents = useMemo(() => students.filter((s) => s.id !== student.id), [students, student.id]);
  const affectedRecords = useMemo(() => recordsReferencingStudent(records, student.id), [records, student.id]);

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

  function startDelete() {
    setDeleteStage(affectedRecords.length > 0 ? "choose" : "confirm");
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteStudent(student.id);
    onClose();
  }

  async function handleMerge() {
    if (!mergeTargetId) return;
    setMerging(true);
    setMergeError("");
    try {
      await mergeStudents({
        duplicateId: student.id,
        duplicateName: student.fullName,
        targetId: mergeTargetId,
        targetName: students.find((s) => s.id === mergeTargetId)?.fullName || "",
        records,
      });
      onClose();
    } catch {
      setMergeError("La fusion a échoué. Réessaie.");
      setMerging(false);
    }
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
          {isAdmin && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Renommer</div>
                <div className={sharedStyles.responsiveFormGrid} style={{ gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
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
                <div className={sharedStyles.responsiveFormGrid} style={{ gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
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
                  <div className={sharedStyles.responsiveFormGrid} style={{ gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                    <Field label="Départ le">
                      <TextInput type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)} />
                    </Field>
                    <Button size="sm" variant="ghost" onClick={handleDepart} disabled={savingDepart}>
                      Marquer comme parti
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Zone dangereuse</div>

            {deleteStage === null && (
              <>
                <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: "0 0 12px" }}>
                  Supprime définitivement cette fiche élève — réservé à la correction d'une erreur
                  de saisie (ex. doublon créé par mégarde). Pour un élève qui a réellement quitté
                  l'établissement, utilise plutôt « Marquer comme parti » ci-dessus.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={startDelete}
                  disabled={!isAdmin}
                  title={isAdmin ? undefined : "Demande à un administrateur de supprimer cet élève."}
                >
                  Supprimer définitivement
                </Button>
              </>
            )}

            {deleteStage === "choose" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Callout tone="warning">
                    {affectedRecords.length} appel(s) enregistré(s) mentionnent cet élève. Le
                    supprimer retirera son nom de ces appels. S'il s'agit d'un doublon créé par
                    erreur pour la même personne, fusionne plutôt ses appels vers la bonne fiche.
                  </Callout>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteStage(null)}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={() => setDeleteStage("merge")}>
                    Fusionner vers un autre élève
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteStage("confirm")}>
                    Supprimer quand même
                  </Button>
                </div>
              </>
            )}

            {deleteStage === "confirm" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Callout tone="danger">Cette action est irréversible. Confirmer la suppression ?</Callout>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteStage(null)} disabled={deleting}>
                    Annuler
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Suppression…" : "Confirmer la suppression définitive"}
                  </Button>
                </div>
              </>
            )}

            {deleteStage === "merge" && (
              <>
                <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: "0 0 12px" }}>
                  Les {affectedRecords.length} appel(s) de « {student.fullName} » seront réattribués
                  à l'élève choisi (une correction tracée est ajoutée à chaque appel modifié), puis
                  cette fiche sera supprimée.
                </p>
                <div className={sharedStyles.responsiveFormGrid} style={{ gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                  <Field label="Fusionner vers">
                    <Select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
                      <option value="">— Choisir un élève —</option>
                      {otherStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} · {classById.get(s.classId)?.name || "—"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button size="sm" onClick={handleMerge} disabled={!mergeTargetId || merging}>
                    {merging ? "Fusion…" : "Fusionner"}
                  </Button>
                </div>
                {mergeError && (
                  <div style={{ marginTop: 12 }}>
                    <Callout tone="danger">{mergeError}</Callout>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteStage("choose")} disabled={merging}>
                    Retour
                  </Button>
                </div>
              </>
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
