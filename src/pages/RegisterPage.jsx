import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAllRecords } from "../lib/attendance";
import { useTeachers } from "../lib/users";
import { formatDateShort, formatTimestamp } from "../lib/dates";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";

export default function RegisterPage() {
  const { user, isAdmin } = useAuth();
  const { data: records, loading } = useAllRecords();
  const { data: teachers } = useTeachers();

  const [selectedIds, setSelectedIds] = useState(() => new Set([user.uid]));
  const [filterOpen, setFilterOpen] = useState(false);

  const otherTeachers = useMemo(() => teachers.filter((t) => t.id !== user.uid), [teachers, user.uid]);

  function toggleTeacher(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleRecords = isAdmin ? records.filter((r) => selectedIds.has(r.authorId)) : records.filter((r) => r.authorId === user.uid);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 8 }}>
        <h1>Registre des appels</h1>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setFilterOpen((v) => !v)}>
            Filtrer par enseignant ({selectedIds.size})
          </Button>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: "0 0 16px" }}>
        Un appel validé est verrouillé. Tu peux corriger tes propres appels ; un administrateur peut
        corriger n'importe quel appel — dans tous les cas, un motif obligatoire est conservé au
        journal.
      </p>

      {isAdmin && filterOpen && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Afficher en plus des tiens :
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {otherTeachers.map((t) => (
              <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleTeacher(t.id)} />
                {t.displayName}
              </label>
            ))}
            {otherTeachers.length === 0 && (
              <span style={{ fontSize: 13, color: "var(--color-muted)" }}>Aucun autre enseignant.</span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {visibleRecords.map((r) => {
          const corrected = (r.corrections || []).length > 0;
          const lastCorrection = corrected ? r.corrections[r.corrections.length - 1] : null;
          const canCorrect = isAdmin || r.authorId === user.uid;
          const nbPresent = r.entries.filter((e) => e.status === "present").length;
          const nbLate = r.entries.filter((e) => e.status === "retard").length;
          const nbAbsent = r.entries.filter((e) => e.status === "absent").length;
          return (
            <div key={r.id} className="card" style={{ padding: "20px 22px" }}>
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
                {canCorrect && (
                  <Button as={Link} to={`/registre/${r.id}/corriger`} variant="ghost" size="sm">
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
        {!loading && visibleRecords.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--color-muted)" }}>
            Aucun appel à afficher pour cette sélection.
          </div>
        )}
      </div>
    </div>
  );
}
