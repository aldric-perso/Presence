import { useState } from "react";
import { applyImportDiff } from "../../lib/studentImport";
import { formatDateShort } from "../../lib/dates";
import Button from "../../components/ui/Button";
import Callout from "../../components/ui/Callout";
import { TextInput } from "../../components/ui/Field";
import styles from "./StudentImportDialog.module.css";

export default function StudentImportDialog({ diff, onClose }) {
  const { toCreate, toReview, toDepart, errors, importDate } = diff;

  const [skipCreate, setSkipCreate] = useState(new Set());
  const [skipDepart, setSkipDepart] = useState(new Set());
  const [classChange, setClassChange] = useState(() =>
    Object.fromEntries(toReview.map((r) => [r.existingStudent.id, "change"])),
  );
  const [classChangeDate, setClassChangeDate] = useState(() =>
    Object.fromEntries(toReview.map((r) => [r.existingStudent.id, importDate])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggle(set, setSet, key) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSet(next);
  }

  const nothingToDo = toCreate.length === 0 && toReview.length === 0 && toDepart.length === 0;

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      await applyImportDiff(
        { toCreate, toReview, toDepart, importDate },
        { skipCreate, skipDepart, classChange, classChangeDate },
      );
      onClose();
    } catch {
      setError("L'import a échoué. Réessaie.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <div className="eyebrow">Import Excel</div>
          <h2 className={styles.title}>Aperçu avant confirmation</h2>
          <p style={{ fontSize: 14, color: "var(--color-ink-soft)", margin: 0 }}>
            {toCreate.length} nouveau(x), {toReview.length} à trancher, {toDepart.length} considéré(s) parti(s).
          </p>
        </div>

        <div className={styles.body}>
          {errors.length > 0 && (
            <div className={styles.section}>
              <Callout tone="warning">
                {errors.length} ligne(s) ignorée(s) — classe introuvable : {errors.map((e) => `${e.row.firstName} ${e.row.lastName}`).join(", ")}
              </Callout>
            </div>
          )}

          {nothingToDo && errors.length === 0 && (
            <div className={styles.section}>
              <Callout tone="success">Rien à faire — la base est déjà à jour par rapport à ce fichier.</Callout>
            </div>
          )}

          {toCreate.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Nouveaux élèves ({toCreate.length})</div>
              {toCreate.map((item) => (
                <label key={item.key} className={styles.row}>
                  <input
                    type="checkbox"
                    checked={!skipCreate.has(item.key)}
                    onChange={() => toggle(skipCreate, setSkipCreate, item.key)}
                  />
                  <div className={styles.rowMain}>
                    <div style={{ fontWeight: 600 }}>
                      {item.row.firstName} {item.row.lastName}
                    </div>
                    <div className={styles.rowMeta}>
                      {item.className} · arrivée {formatDateShort(item.row.arrivedAt || importDate)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {toReview.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Changements de classe à confirmer ({toReview.length})</div>
              {toReview.map((item) => {
                const id = item.existingStudent.id;
                const decision = classChange[id];
                return (
                  <div key={id} className={styles.row} style={{ alignItems: "flex-start", flexDirection: "column" }}>
                    <div className={styles.rowMain}>
                      <div style={{ fontWeight: 600 }}>{item.existingStudent.fullName}</div>
                      <div className={styles.rowMeta}>
                        {item.wasDeparted ? "Marqué parti" : "Actuellement"} → {item.newClassName} (fichier importé)
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                        <input
                          type="radio"
                          name={`decision-${id}`}
                          checked={decision === "change"}
                          onChange={() => setClassChange((prev) => ({ ...prev, [id]: "change" }))}
                        />
                        Changement de classe
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                        <input
                          type="radio"
                          name={`decision-${id}`}
                          checked={decision === "ignore"}
                          onChange={() => setClassChange((prev) => ({ ...prev, [id]: "ignore" }))}
                        />
                        Ignorer (doublon)
                      </label>
                      {decision === "change" && (
                        <TextInput
                          type="date"
                          value={classChangeDate[id]}
                          onChange={(e) => setClassChangeDate((prev) => ({ ...prev, [id]: e.target.value }))}
                          style={{ padding: "6px 10px", fontSize: 13 }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {toDepart.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Élèves partis ({toDepart.length})</div>
              <p style={{ fontSize: 13, color: "var(--color-ink-soft)", marginTop: 0 }}>
                Absents du fichier importé — seront marqués partis le {formatDateShort(importDate)}.
              </p>
              {toDepart.map((item) => (
                <label key={item.key} className={styles.row}>
                  <input
                    type="checkbox"
                    checked={!skipDepart.has(item.key)}
                    onChange={() => toggle(skipDepart, setSkipDepart, item.key)}
                  />
                  <div className={styles.rowMain}>{item.student.fullName}</div>
                </label>
              ))}
            </div>
          )}

          {error && (
            <div className={styles.section}>
              <Callout tone="danger">{error}</Callout>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || (nothingToDo && errors.length === 0)}>
            {submitting ? "Application…" : "Confirmer l'import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
