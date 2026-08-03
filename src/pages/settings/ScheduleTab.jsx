import { useEffect, useState } from "react";
import { useTimeSlots, createTimeSlot, updateTimeSlotLabel, deleteTimeSlot } from "../../lib/timeSlots";
import { useSettings, updateSettings } from "../../lib/settings";
import { Field, TextInput } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import { Pill } from "../../components/ui/Pill";
import styles from "./Shared.module.css";

export default function ScheduleTab({ isAdmin }) {
  const { data: timeSlots } = useTimeSlots();
  const { settings } = useSettings();

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <ThresholdSection isAdmin={isAdmin} settings={settings} />
      <TimeSlotsSection isAdmin={isAdmin} timeSlots={timeSlots} />
      <ReasonsSection
        isAdmin={isAdmin}
        title="Motifs d'absence"
        field="absenceReasons"
        reasons={settings.absenceReasons}
        placeholder="Ex. Rendez-vous médical"
      />
      <ReasonsSection
        isAdmin={isAdmin}
        title="Motifs de retard"
        field="lateReasons"
        reasons={settings.lateReasons}
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
      <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
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
          <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
            <div style={{ flex: 1 }}>
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
            className={styles.tableRow}
            style={{ gridTemplateColumns: isAdmin ? "1fr 90px 90px" : "1fr", alignItems: "center" }}
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

function ReasonsSection({ isAdmin, title, field, reasons, placeholder }) {
  const [label, setLabel] = useState("");
  const [justified, setJustified] = useState(true);

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

  function removeAt(index) {
    updateSettings({ [field]: reasons.filter((_, i) => i !== index) });
  }

  return (
    <div>
      <div className={styles.formTitle} style={{ marginBottom: 4 }}>{title}</div>
      <p className={styles.formHint}>
        Clique sur « Justifié »/« Non justifié » pour changer si ce motif compte comme une absence
        justifiée dans le suivi de présence.
      </p>

      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
            <div style={{ flex: 1 }}>
              <Field label="Nouveau motif">
                <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={placeholder} />
              </Field>
            </div>
            <Pill tone="green" active={justified} onClick={() => setJustified((v) => !v)}>
              {justified ? "Justifié" : "Non justifié"}
            </Pill>
            <Button onClick={handleAdd}>Ajouter</Button>
          </div>
        </div>
      )}

      <div className={styles.cardsGrid}>
        {reasons.map((r, i) => (
          <div key={r.label} className={["card", styles.simpleCard].join(" ")}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</span>
            {isAdmin ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Pill size="sm" tone="green" active={r.justified} onClick={() => toggleJustifiedAt(i)}>
                  {r.justified ? "Justifié" : "Non justifié"}
                </Pill>
                <button
                  onClick={() => removeAt(i)}
                  style={{ background: "transparent", border: "none", color: "var(--color-red)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Retirer
                </button>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: r.justified ? "var(--color-green)" : "var(--color-muted)" }}>
                {r.justified ? "Justifié" : "Non justifié"}
              </span>
            )}
          </div>
        ))}
        {reasons.length === 0 && <div className={styles.emptyMsg}>Aucun motif configuré.</div>}
      </div>
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
          <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
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
