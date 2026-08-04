import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAllRecords, isEditableByAuthor, deleteAttendanceRecord } from "../lib/attendance";
import { useTeachers } from "../lib/users";
import { formatDateShort, formatTimestamp } from "../lib/dates";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { TextInput } from "../components/ui/Field";

const LOCKED_TOOLTIP = "Appel datant de plus de 7j, contacter un admin pour toute modification à apporter.";

export default function RegisterPage() {
  const { user, isAdmin } = useAuth();
  const { data: records, loading } = useAllRecords();
  const { data: teachers } = useTeachers();

  const [selectedIds, setSelectedIds] = useState(() => new Set([user.uid]));
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  function openDelete(record) {
    setPendingDelete(record);
    setDeleteReason("");
    setDeleteError("");
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAttendanceRecord({ recordId: pendingDelete.id, reason: deleteReason.trim() });
      setPendingDelete(null);
    } catch {
      setDeleteError("La suppression a échoué. Réessaie.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
        <h1>Registre des appels</h1>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setFilterOpen((v) => !v)}>
            Filtrer par enseignant ({selectedIds.size})
          </Button>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: "0 0 16px" }}>
        Un appel validé est verrouillé. Tu peux corriger ou supprimer tes propres appels dans les 7
        jours suivant la séance ; passé ce délai, seul un administrateur le peut encore. Dans tous
        les cas, un motif est conservé au journal.
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
          const editable = isEditableByAuthor(r.date);
          const canModify = !r.deleted && (isAdmin || (r.authorId === user.uid && editable));
          const nbPresent = r.entries.filter((e) => e.status === "present").length;
          const nbPartial = r.entries.filter((e) => e.status === "partiel").length;
          const nbLate = r.entries.filter((e) => e.status === "retard").length;
          const nbAbsent = r.entries.filter((e) => e.status === "absent").length;

          let badgeTone = null;
          let badgeLabel = null;
          let badgeTitle;
          if (r.deleted) {
            badgeTone = "red";
            badgeLabel = "Supprimé";
          } else if (corrected) {
            badgeTone = "amber";
            badgeLabel = "Corrigé";
          } else if (!editable) {
            badgeTone = "neutral";
            badgeLabel = "Verrouillé";
            badgeTitle = LOCKED_TOOLTIP;
          }

          return (
            <div key={r.id} className="card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {r.className} — {r.subjectName}
                    </span>
                    {badgeLabel && (
                      <Badge tone={badgeTone} title={badgeTitle}>
                        {badgeLabel}
                      </Badge>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-ink-soft)", marginTop: 4 }}>
                    {formatDateShort(r.date)} · {r.timeSlotLabel} · signé {r.authorName}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-ink-soft)", marginTop: 2 }}>
                    {nbPresent} présents · {nbPartial} partielles · {nbLate} retards · {nbAbsent} absents
                  </div>
                </div>
                {canModify && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button as={Link} to={`/registre/${r.id}/corriger`} variant="ghost" size="sm">
                      Corriger
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openDelete(r)}>
                      Supprimer
                    </Button>
                  </div>
                )}
              </div>
              {lastCorrection && (
                <div style={{ marginTop: 14, padding: "11px 14px", background: "var(--color-panel)", borderRadius: 10, fontSize: 12, color: "var(--color-ink-soft)" }}>
                  Corrigé par {lastCorrection.byName} le {formatTimestamp(lastCorrection.at)} — {lastCorrection.reason}
                </div>
              )}
              {r.deleted && (
                <div style={{ marginTop: 14, padding: "11px 14px", background: "var(--color-red-bg)", borderRadius: 10, fontSize: 12, color: "var(--color-ink-soft)" }}>
                  Supprimé par {r.deletedByName} le {formatTimestamp(r.deletedAt)} — {r.deletedReason}
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

      {pendingDelete && (
        <Modal
          kicker="Suppression"
          title="Supprimer cet appel ?"
          text="L'appel restera visible dans le registre avec la mention « Supprimé » et le motif indiqué, mais ses entrées ne compteront plus dans le suivi de présence."
          detail={
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, color: "var(--color-ink-soft)" }}>
                {pendingDelete.className} — {pendingDelete.subjectName} · {formatDateShort(pendingDelete.date)}
              </div>
              <TextInput
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Motif de la suppression (obligatoire)"
              />
              {deleteError && <p style={{ margin: 0, fontSize: 13, color: "var(--color-red)" }}>{deleteError}</p>}
            </div>
          }
          confirmLabel={deleting ? "Suppression…" : "Supprimer"}
          cancelLabel="Annuler"
          danger
          confirmDisabled={deleteReason.trim().length <= 4 || deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
