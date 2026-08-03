import { Link } from "react-router-dom";
import { useAllRecords } from "../../lib/attendance";
import { formatDateShort, formatTimestamp } from "../../lib/dates";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import styles from "./Shared.module.css";

export default function RegisterTab({ isAdmin }) {
  const { data: records, loading } = useAllRecords();

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: "0 0 16px" }}>
        Un appel validé est verrouillé. Seul un administrateur peut le corriger, avec un motif
        obligatoire conservé au journal.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {records.map((r) => {
          const corrected = (r.corrections || []).length > 0;
          const lastCorrection = corrected ? r.corrections[r.corrections.length - 1] : null;
          const nbPresent = r.entries.filter((e) => e.status === "present").length;
          const nbLate = r.entries.filter((e) => e.status === "retard").length;
          const nbAbsent = r.entries.filter((e) => e.status === "absent").length;
          return (
            <div key={r.id} className={["card", styles.groupCard].join(" ")}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {r.className} — {r.subjectName}
                    </span>
                    <Badge tone={corrected ? "amber" : "neutral"}>{corrected ? "Corrigé" : "Verrouillé"}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-ink-soft)", marginTop: 4 }}>
                    {formatDateShort(r.date)} · {r.timeSlotLabel} · signé {r.authorName}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-ink-soft)", marginTop: 2 }}>
                    {nbPresent} présents · {nbLate} retards · {nbAbsent} absents
                  </div>
                </div>
                {isAdmin && (
                  <Button as={Link} to={`/parametres/registre/${r.id}/corriger`} variant="ghost" size="sm">
                    Corriger
                  </Button>
                )}
              </div>
              {lastCorrection && (
                <div style={{ marginTop: 14, padding: "11px 14px", background: "var(--color-panel)", borderRadius: 10, fontSize: 12, color: "var(--color-ink-soft)" }}>
                  Corrigé par {lastCorrection.byName} le {formatTimestamp(lastCorrection.at)} — {lastCorrection.reason}
                </div>
              )}
            </div>
          );
        })}
        {!loading && records.length === 0 && <div className={styles.emptyMsg}>Aucun appel enregistré pour le moment.</div>}
      </div>
    </div>
  );
}
