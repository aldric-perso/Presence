import { useEffect, useState } from "react";
import { useTimeSlots } from "../../lib/timeSlots";
import { useSettings, setPresenceThreshold } from "../../lib/settings";
import { Field } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import styles from "./Shared.module.css";

export default function ScheduleTab({ isAdmin }) {
  const { data: timeSlots } = useTimeSlots();
  const { settings } = useSettings();
  const [threshold, setThreshold] = useState(settings.presenceThreshold);
  const [saved, setSaved] = useState(false);

  useEffect(() => setThreshold(settings.presenceThreshold), [settings.presenceThreshold]);

  async function handleSave() {
    await setPresenceThreshold(Number(threshold));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      {isAdmin && (
        <div className={["card", styles.formCard].join(" ")}>
          <div className={styles.formTitle}>Seuil de présence</div>
          <p className={styles.formHint}>
            En dessous de ce taux, un élève apparaît en alerte dans le suivi de présence.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
            <div style={{ width: 140 }}>
              <Field label="Seuil (%)">
                <input
                  type="number"
                  min={50}
                  max={100}
                  step={5}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--color-line-strong)",
                    fontSize: 14,
                  }}
                />
              </Field>
            </div>
            <Button onClick={handleSave}>Enregistrer</Button>
          </div>
          {saved && <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-green)", fontWeight: 600 }}>Seuil mis à jour.</p>}
        </div>
      )}

      <div className={["card", styles.listCard].join(" ")}>
        <div className={styles.tableHead} style={{ gridTemplateColumns: "1fr 2fr auto" }}>
          <span>Créneau</span>
          <span>Intitulé</span>
          <span></span>
        </div>
        {timeSlots.map((slot) => (
          <div key={slot.id} className={["tabular", styles.tableRow].join(" ")} style={{ gridTemplateColumns: "1fr 2fr auto" }}>
            <span style={{ fontWeight: 600 }}>{slot.label}</span>
            <span style={{ color: "var(--color-ink-soft)" }}>{slot.name}</span>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>50 min</span>
          </div>
        ))}
        {timeSlots.length === 0 && <div className={styles.emptyMsg}>Aucun créneau configuré — lance le script de seed.</div>}
      </div>
    </div>
  );
}
