import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useClasses } from "../lib/classes";
import { useSubjects } from "../lib/subjects";
import { useTimeSlots } from "../lib/timeSlots";
import { useStudentsByClass } from "../lib/students";
import {
  submitAttendanceRecord,
  STATUS,
  ABSENCE_REASONS,
  LATE_REASONS,
  LATE_MINUTE_CHOICES,
} from "../lib/attendance";
import { formatDateLabel } from "../lib/dates";
import { SegmentedControl, Pill } from "../components/ui/Pill";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import styles from "./TakeAttendancePage.module.css";

function defaultEntry() {
  return { status: STATUS.PRESENT, minutesMissed: 0, reason: null };
}

export default function TakeAttendancePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const date = params.get("date");
  const classId = params.get("classId");
  const subjectId = params.get("subjectId");
  const timeSlotId = params.get("timeSlotId");

  const { data: classes } = useClasses({ includeArchived: true });
  const { data: subjects } = useSubjects();
  const { data: timeSlots } = useTimeSlots();
  const { data: students, loading: studentsLoading } = useStudentsByClass(classId);

  const classe = classes.find((c) => c.id === classId);
  const subject = subjects.find((s) => s.id === subjectId);
  const timeSlot = timeSlots.find((s) => s.id === timeSlotId);

  const [variant, setVariant] = useState("liste");
  const [roll, setRoll] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!studentsLoading && students.length) {
      setRoll((prev) => {
        const next = { ...prev };
        students.forEach((s) => {
          if (!next[s.id]) next[s.id] = defaultEntry();
        });
        return next;
      });
    }
  }, [students, studentsLoading]);

  function setStatus(studentId, status) {
    setRoll((prev) => {
      const cur = prev[studentId] || defaultEntry();
      if (status === STATUS.PRESENT) {
        return { ...prev, [studentId]: { status: STATUS.PRESENT, minutesMissed: 0, reason: null } };
      }
      if (status === STATUS.LATE) {
        return {
          ...prev,
          [studentId]: {
            status: STATUS.LATE,
            minutesMissed: cur.status === STATUS.LATE ? cur.minutesMissed : 10,
            reason: cur.status === STATUS.LATE ? cur.reason : null,
          },
        };
      }
      return {
        ...prev,
        [studentId]: { status: STATUS.ABSENT, minutesMissed: 50, reason: cur.reason || null },
      };
    });
  }

  function patchEntry(studentId, patch) {
    setRoll((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  function cycleStatus(studentId) {
    const cur = roll[studentId]?.status || STATUS.PRESENT;
    const next =
      cur === STATUS.PRESENT ? STATUS.LATE : cur === STATUS.LATE ? STATUS.ABSENT : STATUS.PRESENT;
    setStatus(studentId, next);
  }

  const entries = students.map((s) => ({ studentId: s.id, ...(roll[s.id] || defaultEntry()) }));
  const nbPresents = entries.filter((e) => e.status === STATUS.PRESENT).length;
  const nbRetards = entries.filter((e) => e.status === STATUS.LATE).length;
  const nbAbsents = entries.filter((e) => e.status === STATUS.ABSENT).length;
  const missingReasons = entries.filter((e) => e.status !== STATUS.PRESENT && !e.reason);
  const canValidate = missingReasons.length === 0 && entries.length > 0;

  const validationMsg = missingReasons.length
    ? `${missingReasons.length} motif(s) manquant(s) — la validation est bloquée.`
    : `${nbPresents} présents, ${nbRetards} retards, ${nbAbsents} absents. Prêt à enregistrer.`;

  async function handleConfirmValidate() {
    setSubmitting(true);
    setErrorMsg("");
    try {
      await submitAttendanceRecord({
        date,
        classId,
        subjectId,
        timeSlotId,
        entries: entries.map((e) => ({
          studentId: e.studentId,
          status: e.status,
          minutesMissed: e.status === STATUS.PRESENT ? 0 : e.minutesMissed,
          reason: e.status === STATUS.PRESENT ? null : e.reason,
        })),
      });
      navigate("/");
    } catch (err) {
      setConfirmOpen(false);
      setErrorMsg(
        err.code === "already-exists"
          ? "Cet appel a déjà été enregistré entre-temps par un autre enseignant."
          : "L'enregistrement a échoué. Réessaie.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const missingParams = !classId || !subjectId || !timeSlotId || !date;
  useEffect(() => {
    if (missingParams) navigate("/appel/nouveau", { replace: true });
  }, [missingParams, navigate]);
  if (missingParams) return null;

  return (
    <div>
      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div style={{ flex: 1 }}>
            <div className="eyebrow">
              {formatDateLabel(date)} · {timeSlot?.label}
            </div>
            <div className={styles.title}>
              {classe?.name} — {subject?.name}
            </div>
          </div>
          <div className={["tabular", styles.counts].join(" ")}>
            <div className={styles.countItem}>
              <div className={styles.countValue} style={{ color: "var(--color-green)" }}>
                {nbPresents}
              </div>
              <div className={styles.countLabel}>présents</div>
            </div>
            <div className={styles.countItem}>
              <div className={styles.countValue} style={{ color: "var(--color-amber)" }}>
                {nbRetards}
              </div>
              <div className={styles.countLabel}>retards</div>
            </div>
            <div className={styles.countItem}>
              <div className={styles.countValue} style={{ color: "var(--color-red)" }}>
                {nbAbsents}
              </div>
              <div className={styles.countLabel}>absents</div>
            </div>
          </div>
          <SegmentedControl
            value={variant}
            onChange={setVariant}
            options={[
              { value: "liste", label: "Liste" },
              { value: "cartes", label: "Cartes" },
            ]}
          />
        </div>
      </div>

      <div className={styles.body}>
        <p className={styles.hint}>
          Tout le monde est <strong style={{ color: "var(--color-green)" }}>présent par défaut</strong>.
          Ne marque que les écarts.
        </p>

        {errorMsg && (
          <div style={{ marginBottom: 16 }}>
            <div className="card" style={{ padding: "12px 16px", color: "var(--color-red)", fontSize: 13 }}>
              {errorMsg}
            </div>
          </div>
        )}

        {variant === "liste" ? (
          <div className="card">
            {students.map((s) => (
              <RollRow
                key={s.id}
                student={s}
                entry={roll[s.id] || defaultEntry()}
                onSetStatus={(status) => setStatus(s.id, status)}
                onPatch={(patch) => patchEntry(s.id, patch)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.cardsGrid}>
            {students.map((s) => (
              <RollCard
                key={s.id}
                student={s}
                entry={roll[s.id] || defaultEntry()}
                onCycle={() => cycleStatus(s.id)}
                onPatch={(patch) => patchEntry(s.id, patch)}
              />
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerMsg}>{validationMsg}</div>
          <Button variant="ghost" onClick={() => navigate("/")}>
            Quitter
          </Button>
          <Button disabled={!canValidate} onClick={() => setConfirmOpen(true)}>
            Valider l'appel
          </Button>
        </div>
      </div>

      {confirmOpen && (
        <Modal
          kicker="Confirmation"
          title="Enregistrer cet appel ?"
          text="Une fois validé, l'appel est verrouillé et signé à ton nom. Tu pourras le corriger toi-même par la suite si besoin, tout comme un administrateur."
          detail={`${classe?.name} · ${subject?.name} · ${timeSlot?.label}`}
          confirmLabel={submitting ? "Enregistrement…" : "Enregistrer"}
          cancelLabel="Relire"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submitting ? undefined : handleConfirmValidate}
        />
      )}
    </div>
  );
}

function ReasonPicker({ entry, onPatch }) {
  const reasons = entry.status === STATUS.LATE ? LATE_REASONS : ABSENCE_REASONS;
  return (
    <div>
      {entry.status === STATUS.LATE && (
        <div style={{ marginBottom: 14 }}>
          <div className={styles.detailLabel}>Temps d'absence</div>
          <div className={styles.chipRow}>
            {LATE_MINUTE_CHOICES.map((m) => (
              <Pill
                key={m}
                size="sm"
                tone="amber"
                active={entry.minutesMissed === m}
                onClick={() => onPatch({ minutesMissed: m })}
              >
                {m} min
              </Pill>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className={styles.detailLabel}>
          Motif <span style={{ color: "var(--color-red)" }}>obligatoire</span>
        </div>
        <div className={styles.chipRow}>
          {reasons.map((r) => (
            <Pill key={r} size="sm" active={entry.reason === r} onClick={() => onPatch({ reason: r })}>
              {r}
            </Pill>
          ))}
        </div>
      </div>
    </div>
  );
}

function RollRow({ student, entry, onSetStatus, onPatch }) {
  return (
    <div className={styles.rollRow}>
      <div className={styles.rollRowMain}>
        <div className={styles.studentInfo}>
          <Avatar name={student.fullName} size={36} />
          <div className={styles.studentName}>{student.fullName}</div>
        </div>
        <div className={styles.actions}>
          <Pill tone="green" active={entry.status === STATUS.PRESENT} onClick={() => onSetStatus(STATUS.PRESENT)}>
            Présent
          </Pill>
          <Pill tone="amber" active={entry.status === STATUS.LATE} onClick={() => onSetStatus(STATUS.LATE)}>
            Retard
          </Pill>
          <Pill tone="red" active={entry.status === STATUS.ABSENT} onClick={() => onSetStatus(STATUS.ABSENT)}>
            Absent
          </Pill>
        </div>
      </div>
      {entry.status !== STATUS.PRESENT && (
        <div className={[styles.detail, "animate-pop"].join(" ")}>
          <div className={styles.detailBox}>
            <ReasonPicker entry={entry} onPatch={onPatch} />
          </div>
        </div>
      )}
    </div>
  );
}

function RollCard({ student, entry, onCycle, onPatch }) {
  const toneClass =
    entry.status === STATUS.PRESENT ? styles.present : entry.status === STATUS.LATE ? styles.late : styles.absent;
  const summary =
    entry.status === STATUS.PRESENT
      ? "Présent · 50 min"
      : entry.status === STATUS.LATE
        ? `${entry.minutesMissed} min manquées · ${entry.reason || "motif requis"}`
        : `50 min · ${entry.reason || "motif requis"}`;

  return (
    <div>
      <button type="button" className={[styles.studentCard, toneClass].join(" ")} onClick={onCycle}>
        <div className={styles.cardName}>{student.fullName}</div>
        <div
          className={styles.cardSummary}
          style={{
            color:
              entry.status === STATUS.PRESENT
                ? "var(--color-green)"
                : entry.status === STATUS.LATE
                  ? "var(--color-amber-dark)"
                  : "var(--color-red-dark)",
          }}
        >
          {summary}
        </div>
      </button>
      {entry.status !== STATUS.PRESENT && (
        <div className={[styles.cardDetail, "animate-pop"].join(" ")}>
          <ReasonPicker entry={entry} onPatch={onPatch} />
        </div>
      )}
    </div>
  );
}
