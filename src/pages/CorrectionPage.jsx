import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStudentsByIds } from "../lib/students";
import { useAttendanceRecord, correctAttendanceRecord, isEditableByAuthor, STATUS } from "../lib/attendance";
import { useSettings } from "../lib/settings";
import { formatDateShort, formatTimestamp } from "../lib/dates";
import { Pill } from "../components/ui/Pill";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Callout from "../components/ui/Callout";
import { TextInput, Field } from "../components/ui/Field";

export default function CorrectionPage() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { record, loading } = useAttendanceRecord(recordId);
  const studentIds = useMemo(() => (record?.entries || []).map((e) => e.studentId), [record]);
  const { data: students, loading: studentsLoading } = useStudentsByIds(studentIds);

  const [roll, setRoll] = useState({});
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (record) {
      const seeded = {};
      for (const e of record.entries || []) {
        seeded[e.studentId] = { status: e.status, minutesMissed: e.minutesMissed, reason: e.reason };
      }
      setRoll(seeded);
    }
  }, [record]);

  function setStatus(studentId, status) {
    setRoll((prev) => {
      const cur = prev[studentId] || { status: STATUS.PRESENT, minutesMissed: 0, reason: null };
      if (status === STATUS.PRESENT) return { ...prev, [studentId]: { status: STATUS.PRESENT, minutesMissed: 0, reason: null } };
      if (status === STATUS.LATE)
        return {
          ...prev,
          [studentId]: {
            status: STATUS.LATE,
            minutesMissed: cur.status === STATUS.LATE ? cur.minutesMissed : 10,
            reason: cur.reason || null,
          },
        };
      return { ...prev, [studentId]: { status: STATUS.ABSENT, minutesMissed: 50, reason: cur.reason || null } };
    });
  }

  function patchEntry(studentId, patch) {
    setRoll((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  if (loading || studentsLoading) return <div className="page">Chargement…</div>;
  if (!record) return <div className="page">Appel introuvable.</div>;
  if (record.deleted) {
    return <div className="page">Cet appel a été supprimé ; il ne peut plus être corrigé.</div>;
  }
  if (!isAdmin && record.authorId !== user.uid) {
    return <div className="page">Tu ne peux corriger que tes propres appels.</div>;
  }
  if (!isAdmin && !isEditableByAuthor(record.date)) {
    return (
      <div className="page">
        Cet appel date de plus de 7 jours : contacte un administrateur pour le corriger.
      </div>
    );
  }

  const entries = students.map((s) => ({ studentId: s.id, ...(roll[s.id] || { status: STATUS.PRESENT }) }));
  const canSave = reason.trim().length > 0;

  async function handleSave() {
    setSubmitting(true);
    setError("");
    try {
      await correctAttendanceRecord({
        recordId,
        reason: reason.trim(),
        entries: entries.map((e) => ({
          studentId: e.studentId,
          status: e.status,
          minutesMissed: e.status === STATUS.PRESENT ? 0 : e.minutesMissed,
          reason: e.status === STATUS.PRESENT ? null : e.reason,
        })),
      });
      navigate("/registre");
    } catch {
      setConfirmOpen(false);
      setError("L'enregistrement de la correction a échoué. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--narrow">
      <div className="eyebrow" style={{ color: "var(--color-red)" }}>
        Correction d'un appel verrouillé
      </div>
      <h1 style={{ margin: "10px 0 6px", fontSize: 38 }}>
        {record.className} — {record.subjectName}
      </h1>
      <p style={{ fontSize: 14, color: "var(--color-ink-soft)", margin: "0 0 28px" }}>
        {formatDateShort(record.date)} · {record.timeSlotLabel} · saisi par {record.authorName}
      </p>

      {(record.corrections || []).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Callout tone="warning">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Corrections antérieures</div>
            {record.corrections.map((c, i) => (
              <div key={i} style={{ lineHeight: 1.6 }}>
                {formatTimestamp(c.at)} · {c.byName} — {c.reason}
              </div>
            ))}
          </Callout>
        </div>
      )}

      <div className="card">
        {students.map((s) => {
          const entry = roll[s.id] || { status: STATUS.PRESENT, minutesMissed: 0, reason: null };
          const reasons = entry.status === STATUS.LATE ? settings.lateReasons : settings.absenceReasons;
          return (
            <div key={s.id} style={{ borderBottom: "1px solid var(--color-line)", padding: "14px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <Avatar name={s.fullName} size={34} />
                <div style={{ flex: 1, minWidth: 120, fontSize: 15, fontWeight: 600 }}>{s.fullName}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill size="sm" tone="green" active={entry.status === STATUS.PRESENT} onClick={() => setStatus(s.id, STATUS.PRESENT)}>
                    Présent
                  </Pill>
                  <Pill size="sm" tone="amber" active={entry.status === STATUS.LATE} onClick={() => setStatus(s.id, STATUS.LATE)}>
                    Retard
                  </Pill>
                  <Pill size="sm" tone="red" active={entry.status === STATUS.ABSENT} onClick={() => setStatus(s.id, STATUS.ABSENT)}>
                    Absent
                  </Pill>
                </div>
              </div>
              {entry.status !== STATUS.PRESENT && (
                <div className="animate-pop" style={{ marginTop: 12, marginLeft: 48, display: "grid", gap: 10 }}>
                  {entry.status === STATUS.LATE && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {settings.lateMinuteChoices.map((m) => (
                        <Pill key={m} size="xs" tone="amber" active={entry.minutesMissed === m} onClick={() => patchEntry(s.id, { minutesMissed: m })}>
                          {m} min
                        </Pill>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {reasons.map((r) => (
                      <Pill key={r.label} size="xs" active={entry.reason === r.label} onClick={() => patchEntry(s.id, { reason: r.label })}>
                        {r.label}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 24, marginTop: 16 }}>
        <Field label="Motif de la correction" required>
          <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: "0 0 12px" }}>
            Explique pourquoi l'appel d'origine est modifié. Ce texte est conservé au journal, à côté
            de la version initiale.
          </p>
          <TextInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : absence finalement justifiée par le service concerné"
          />
        </Field>
      </div>

      {error && (
        <div style={{ marginTop: 16 }}>
          <Callout tone="danger">{error}</Callout>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Button variant="ghost" onClick={() => navigate("/registre")}>
          Annuler
        </Button>
        <Button disabled={!canSave} onClick={() => setConfirmOpen(true)}>
          Enregistrer la correction
        </Button>
      </div>

      {confirmOpen && (
        <Modal
          kicker="Correction d'un appel verrouillé"
          title="Écraser l'appel validé ?"
          text="L'appel d'origine reste consultable dans le journal. La correction sera enregistrée sous ton nom avec le motif saisi."
          detail={reason}
          confirmLabel={submitting ? "Enregistrement…" : "Enregistrer la correction"}
          cancelLabel="Annuler"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submitting ? undefined : handleSave}
        />
      )}
    </div>
  );
}
