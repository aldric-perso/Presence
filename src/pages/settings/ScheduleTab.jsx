import { useEffect, useState } from "react";
import { useTimeSlots, createTimeSlot, updateTimeSlotLabel, deleteTimeSlot } from "../../lib/timeSlots";
import { useSettings, updateSettings } from "../../lib/settings";
import { useAllRecords, recordsReferencingReason, renameReasonInRecords } from "../../lib/attendance";
import { Field, TextInput } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import { Pill } from "../../components/ui/Pill";
import Modal from "../../components/ui/Modal";
import styles from "./Shared.module.css";

export default function ScheduleTab({ isAdmin }) {
  const { data: timeSlots } = useTimeSlots();
  const { settings } = useSettings();
  const { data: records } = useAllRecords();

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <ThresholdSection isAdmin={isAdmin} settings={settings} />
      <TimeSlotsSection isAdmin={isAdmin} timeSlots={timeSlots} />
      <ReasonsSection
        isAdmin={isAdmin}
        title="Motifs d'absence"
        field="absenceReasons"
        reasons={settings.absenceReasons}
        records={records}
        placeholder="Ex. Rendez-vous médical"
      />
      <ReasonsSection
        isAdmin={isAdmin}
        title="Motifs de retard"
        field="lateReasons"
        reasons={settings.lateReasons}
        records={records}
        placeholder="Ex. Transport en retard"
      />
      <MinuteChoicesSection isAdmin={isAdmin} choices={settings.lateMinuteChoices} />
    </div>
  );
}

function ThresholdSection({ isAdmin, settings }) {
  const [threshold, setThreshold] = useState(settings.presenceThreshold);
  const [saved, setSaved] = useState(false);

  useEffect(() => setThreshold(settings.presenceThreshold), [settings.presenceThreshold]);

  async function handleSave() {
    await updateSettings({ presenceThreshold: Number(threshold) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!isAdmin) return null;

  return (
    <div className={["card", styles.formCard].join(" ")} style={{ margin: 0 }}>
      <div className={styles.formTitle}>Seuil de présence</div>
      <p className={styles.formHint}>
        En dessous de ce taux, un élève apparaît en alerte dans le suivi de présence.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
        <div style={{ width: 140 }}>
          <Field label="Seuil (%)">
            <TextInput
              type="number"
              min={50}
              max={100}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </Field>
        </div>
        <Button onClick={handleSave}>Enregistrer</Button>
      </div>
      {saved && <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-green)", fontWeight: 600 }}>Seuil mis à jour.</p>}
    </div>
  );
}

function TimeSlotsSection({ isAdmin, timeSlots }) {
  const [newLabel, setNewLabel] = useState("");
  const [drafts, setDrafts] = useState({});

  async function handleAdd() {
    if (!newLabel.trim()) return;
    await createTimeSlot(newLabel, timeSlots);
    setNewLabel("");
  }

  function draftFor(slot) {
    return drafts[slot.id] ?? slot.label;
  }

  async function handleSaveLabel(slot) {
    const value = draftFor(slot).trim();
    if (!value || value === slot.label) return;
    await updateTimeSlotLabel(slot.id, value);
  }

  return (
    <div>
      <div className={styles.formTitle} style={{ marginBottom: 4 }}>Créneaux horaires</div>
      <p className={styles.formHint}>Les horaires disponibles pour la prise d'appel.</p>

      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field label="Nouveau créneau">
                <TextInput
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="17h00 – 17h50"
                />
              </Field>
            </div>
            <Button onClick={handleAdd}>Ajouter</Button>
          </div>
        </div>
      )}

      <div className={["card", styles.listCard].join(" ")}>
        {timeSlots.map((slot) => (
          <div
            key={slot.id}
            className={[styles.tableRow, styles.responsiveFormGrid].join(" ")}
            style={{ gridTemplateColumns: isAdmin ? "1fr 90px 90px" : "1fr", alignItems: "center", gap: 8 }}
          >
            {isAdmin ? (
              <TextInput
                value={draftFor(slot)}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [slot.id]: e.target.value }))}
                style={{ padding: "8px 12px", fontSize: 14 }}
              />
            ) : (
              <span className="tabular" style={{ fontWeight: 600 }}>{slot.label}</span>
            )}
            {isAdmin && (
              <>
                <Button size="xs" variant="ghost" onClick={() => handleSaveLabel(slot)} disabled={draftFor(slot).trim() === slot.label}>
                  Enregistrer
                </Button>
                <button
                  onClick={() => deleteTimeSlot(slot.id)}
                  style={{ background: "transparent", border: "none", color: "var(--color-red)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Supprimer
                </button>
              </>
            )}
          </div>
        ))}
        {timeSlots.length === 0 && <div className={styles.emptyMsg}>Aucun créneau configuré.</div>}
      </div>
    </div>
  );
}

function ReasonsSection({ isAdmin, title, field, reasons, records, placeholder }) {
  const [label, setLabel] = useState("");
  const [justified, setJustified] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [renamingLabel, setRenamingLabel] = useState(null);
  const [renameError, setRenameError] = useState("");
  const [pendingRemove, setPendingRemove] = useState(null);

  async function handleAdd() {
    const value = label.trim();
    if (!value || reasons.some((r) => r.label.toLowerCase() === value.toLowerCase())) return;
    await updateSettings({ [field]: [...reasons, { label: value, justified }] });
    setLabel("");
    setJustified(true);
  }

  function toggleJustifiedAt(index) {
    const next = reasons.map((r, i) => (i === index ? { ...r, justified: !r.justified } : r));
    updateSettings({ [field]: next });
  }

  function draftFor(r) {
    return drafts[r.label] ?? r.label;
  }

  async function handleRename(index) {
    const oldLabel = reasons[index].label;
    const newLabel = draftFor(reasons[index]).trim();
    setRenameError("");
    if (!newLabel || newLabel === oldLabel) return;
    if (reasons.some((r, i) => i !== index && r.label.toLowerCase() === newLabel.toLowerCase())) {
      setRenameError("Un motif porte déjà ce nom.");
      return;
    }
    setRenamingLabel(oldLabel);
    const nextReasons = reasons.map((r, i) => (i === index ? { ...r, label: newLabel } : r));
    await updateSettings({ [field]: nextReasons });
    await renameReasonInRecords({ oldLabel, newLabel, records });
    setRenamingLabel(null);
  }

  function requestRemove(index) {
    const r = reasons[index];
    const count = recordsReferencingReason(records, r.label).length;
    setPendingRemove({ index, label: r.label, count });
  }

  function confirmRemove() {
    updateSettings({ [field]: reasons.filter((_, i) => i !== pendingRemove.index) });
    setPendingRemove(null);
  }

  return (
    <div>
      <div className={styles.formTitle} style={{ marginBottom: 4 }}>{title}</div>
      <p className={styles.formHint}>
        Clique sur « Justifié »/« Non justifié » pour changer si ce motif compte comme une absence
        justifiée dans le suivi de présence. Renommer un motif le renomme partout, y compris dans
        les appels déjà enregistrés.
      </p>

      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field label="Nouveau motif">
                <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={placeholder} />
              </Field>
            </div>
            <Pill tone="green" active={justified} onClick={() => setJustified((v) => !v)}>
              {justified ? "Justifié" : "Non justifié"}
            </Pill>
            <Button onClick={handleAdd}>Ajouter</Button>
          </div>
          {renameError && <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-red)" }}>{renameError}</p>}
        </div>
      )}

      <div className={styles.cardsGrid}>
        {reasons.map((r, i) => (
          <div key={r.label} className="card" style={{ padding: "16px 20px", display: "grid", gap: 10 }}>
            {isAdmin ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <TextInput
                  value={draftFor(r)}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [r.label]: e.target.value }))}
                  style={{ flex: 1, padding: "8px 12px", fontSize: 14 }}
                />
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => handleRename(i)}
                  disabled={renamingLabel === r.label || draftFor(r).trim() === r.label}
                >
                  {renamingLabel === r.label ? "Renommage…" : "Enregistrer"}
                </Button>
              </div>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</span>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {isAdmin ? (
                <>
                  <Pill size="sm" tone="green" active={r.justified} onClick={() => toggleJustifiedAt(i)}>
                    {r.justified ? "Justifié" : "Non justifié"}
                  </Pill>
                  <button
                    onClick={() => requestRemove(i)}
                    style={{ background: "transparent", border: "none", color: "var(--color-red)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Retirer
                  </button>
                </>
              ) : (
                <span style={{ fontSize: 12, color: r.justified ? "var(--color-green)" : "var(--color-muted)" }}>
                  {r.justified ? "Justifié" : "Non justifié"}
                </span>
              )}
            </div>
          </div>
        ))}
        {reasons.length === 0 && <div className={styles.emptyMsg}>Aucun motif configuré.</div>}
      </div>

      {pendingRemove && (
        <Modal
          kicker={pendingRemove.count > 0 ? "Suppression impossible" : "Suppression"}
          title={
            pendingRemove.count > 0
              ? `« ${pendingRemove.label} » est utilisé dans l'historique`
              : `Retirer « ${pendingRemove.label} » ?`
          }
          text={
            pendingRemove.count > 0
              ? `${pendingRemove.count} appel(s) déjà enregistré(s) utilisent ce motif. Le retirer romprait le lien avec son statut justifié/non justifié dans les statistiques de présence pour ces appels passés. Renomme-le plutôt si besoin, ou laisse-le dans la liste.`
              : "Aucun appel enregistré n'utilise ce motif — il peut être retiré sans impact sur l'historique."
          }
          confirmLabel={pendingRemove.count > 0 ? undefined : "Retirer"}
          cancelLabel={pendingRemove.count > 0 ? "Compris" : "Annuler"}
          danger={pendingRemove.count === 0}
          onCancel={() => setPendingRemove(null)}
          onConfirm={pendingRemove.count > 0 ? undefined : confirmRemove}
        />
      )}
    </div>
  );
}

function MinuteChoicesSection({ isAdmin, choices }) {
  const [value, setValue] = useState("");

  async function handleAdd() {
    const n = Number(value);
    if (!n || n <= 0 || n >= 50 || choices.includes(n)) return;
    await updateSettings({ lateMinuteChoices: [...choices, n].sort((a, b) => a - b) });
    setValue("");
  }

  function removeChoice(n) {
    updateSettings({ lateMinuteChoices: choices.filter((c) => c !== n) });
  }

  return (
    <div>
      <div className={styles.formTitle} style={{ marginBottom: 4 }}>Saisies rapides de temps (retard)</div>
      <p className={styles.formHint}>
        Les durées proposées en un clic lors de la saisie d'un retard, en minutes.
      </p>

      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            <div style={{ width: 140 }}>
              <Field label="Minutes">
                <TextInput type="number" min={1} max={49} value={value} onChange={(e) => setValue(e.target.value)} />
              </Field>
            </div>
            <Button onClick={handleAdd}>Ajouter</Button>
          </div>
        </div>
      )}

      <div className={styles.chipRow} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {choices.map((n) => (
          <div key={n} className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px" }}>
            <span className="tabular" style={{ fontSize: 14, fontWeight: 600 }}>{n} min</span>
            {isAdmin && (
              <button
                onClick={() => removeChoice(n)}
                style={{ background: "transparent", border: "none", color: "var(--color-red)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {choices.length === 0 && <span style={{ fontSize: 13, color: "var(--color-muted)" }}>Aucune saisie rapide configurée.</span>}
      </div>
    </div>
  );
}
