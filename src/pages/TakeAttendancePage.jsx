import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useClasses } from "../lib/classes";
import { useSubjects } from "../lib/subjects";
import { useTimeSlots, durationMinutes, formatDuration } from "../lib/timeSlots";
import { useStudentsByClasses } from "../lib/students";
import { useSettings } from "../lib/settings";
import { submitAttendanceRecord, STATUS } from "../lib/attendance";
import { formatDateLabel } from "../lib/dates";
import { Pill } from "../components/ui/Pill";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import styles from "./TakeAttendancePage.module.css";

function defaultEntry(classe) {
  return {
    status: classe?.defaultStatusNA ? STATUS.NA : STATUS.PRESENT,
    minutesMissed: 0,
    minutesPresent: null,
    reason: null,
  };
}

export default function TakeAttendancePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const date = params.get("date");
  const classIds = useMemo(() => (params.get("classIds") || "").split(",").filter(Boolean), [params]);
  const subjectId = params.get("subjectId");
  const timeSlotId = params.get("timeSlotId");

  const { data: classes } = useClasses({ includeArchived: true });
  const { data: subjects } = useSubjects();
  const { data: timeSlots } = useTimeSlots();
  const { data: students, loading: studentsLoading } = useStudentsByClasses(classIds);
  const { settings } = useSettings();

  const subject = subjects.find((s) => s.id === subjectId);
  const timeSlot = timeSlots.find((s) => s.id === timeSlotId);
  const sessionMinutes = durationMinutes(timeSlot?.label) || 50;

  const classGroups = useMemo(
    () =>
      classIds.map((id) => ({
        classe: classes.find((c) => c.id === id),
        students: students
          .filter((s) => s.classId === id)
          .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr")),
      })),
    [classIds, classes, students],
  );
  const allStudents = useMemo(() => classGroups.flatMap((g) => g.students), [classGroups]);
  const classeByStudentId = useMemo(() => {
    const map = new Map();
    classGroups.forEach((g) => g.students.forEach((s) => map.set(s.id, g.classe)));
    return map;
  }, [classGroups]);

  const [roll, setRoll] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!studentsLoading && allStudents.length) {
      setRoll((prev) => {
        const next = { ...prev };
        allStudents.forEach((s) => {
          if (!next[s.id]) next[s.id] = defaultEntry(classeByStudentId.get(s.id));
        });
        return next;
      });
    }
  }, [allStudents, studentsLoading, classeByStudentId]);

  function setStatus(studentId, status) {
    setRoll((prev) => {
      const cur = prev[studentId] || defaultEntry(classeByStudentId.get(studentId));
      if (status === STATUS.PRESENT) {
        return { ...prev, [studentId]: { status: STATUS.PRESENT, minutesMissed: 0, minutesPresent: null, reason: null } };
      }
      if (status === STATUS.NA) {
        return { ...prev, [studentId]: { status: STATUS.NA, minutesMissed: 0, minutesPresent: null, reason: null } };
      }
      if (status === STATUS.LATE) {
        return {
          ...prev,
          [studentId]: {
            status: STATUS.LATE,
            minutesMissed: cur.status === STATUS.LATE ? cur.minutesMissed : Math.min(10, sessionMinutes - 1),
            minutesPresent: null,
            reason: cur.status === STATUS.LATE ? cur.reason : null,
          },
        };
      }
      if (status === STATUS.PARTIAL) {
        return {
          ...prev,
          [studentId]: {
            status: STATUS.PARTIAL,
            minutesMissed: 0,
            minutesPresent:
              cur.status === STATUS.PARTIAL ? cur.minutesPresent : Math.min(settings.partialMinuteChoices?.[0] ?? 30, sessionMinutes - 1),
            reason: cur.status === STATUS.PARTIAL ? cur.reason : null,
          },
        };
      }
      return {
        ...prev,
        [studentId]: { status: STATUS.ABSENT, minutesMissed: sessionMinutes, minutesPresent: null, reason: cur.reason || null },
      };
    });
  }

  function patchEntry(studentId, patch) {
    setRoll((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  const entries = allStudents.map((s) => ({
    studentId: s.id,
    ...(roll[s.id] || defaultEntry(classeByStudentId.get(s.id))),
  }));
  const nbPresents = entries.filter((e) => e.status === STATUS.PRESENT).length;
  const nbPartiels = entries.filter((e) => e.status === STATUS.PARTIAL).length;
  const nbRetards = entries.filter((e) => e.status === STATUS.LATE).length;
  const nbAbsents = entries.filter((e) => e.status === STATUS.ABSENT).length;
  const nbNA = entries.filter((e) => e.status === STATUS.NA).length;
  const missingReasons = entries.filter((e) => e.status !== STATUS.PRESENT && e.status !== STATUS.NA && !e.reason);
  const canValidate = missingReasons.length === 0 && entries.length > 0;

  const validationMsg = missingReasons.length
    ? `${missingReasons.length} motif(s) manquant(s) — la validation est bloquée.`
    : `${nbPresents} présents, ${nbPartiels} présences partielles, ${nbRetards} retards, ${nbAbsents} absents, ${nbNA} N/A. Prêt à enregistrer.`;

  function buildEntry(e) {
    return {
      studentId: e.studentId,
      status: e.status,
      minutesMissed: e.status === STATUS.PRESENT || e.status === STATUS.PARTIAL || e.status === STATUS.NA ? 0 : e.minutesMissed,
      minutesPresent: e.status === STATUS.PARTIAL ? e.minutesPresent : null,
      reason: e.status === STATUS.PRESENT || e.status === STATUS.NA ? null : e.reason,
    };
  }

  async function handleConfirmValidate() {
    setSubmitting(true);
    setErrorMsg("");
    const results = await Promise.allSettled(
      classGroups.map((g, i) => {
        const studentIds = new Set(g.students.map((s) => s.id));
        return submitAttendanceRecord({
          date,
          classId: classIds[i],
          subjectId,
          timeSlotId,
          entries: entries.filter((e) => studentIds.has(e.studentId)).map(buildEntry),
        });
      }),
    );
    const failures = results
      .map((r, i) => ({ r, name: classGroups[i].classe?.name || classIds[i] }))
      .filter(({ r }) => r.status === "rejected" && r.reason?.code !== "already-exists");

    if (failures.length === 0) {
      navigate("/");
    } else {
      setConfirmOpen(false);
      const succeededCount = classGroups.length - failures.length;
      setErrorMsg(
        `L'enregistrement a échoué pour : ${failures.map((f) => f.name).join(", ")}.` +
          (succeededCount > 0 ? ` Les autres classes ont bien été enregistrées.` : "") +
          " Réessaie.",
      );
    }
    setSubmitting(false);
  }

  const missingParams = classIds.length === 0 || !subjectId || !timeSlotId || !date;
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
              {formatDateLabel(date)} · {timeSlot?.label} ({formatDuration(sessionMinutes)})
            </div>
            <div className={styles.title}>
              {classGroups.map((g) => g.classe?.name).filter(Boolean).join(" + ")} — {subject?.name}
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
              <div className={styles.countValue} style={{ color: "var(--color-teal)" }}>
                {nbPartiels}
              </div>
              <div className={styles.countLabel}>partielles</div>
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
            <div className={styles.countItem}>
              <div className={styles.countValue}>{nbNA}</div>
              <div className={styles.countLabel}>N/A</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {classGroups.length === 1 && (
          <p className={styles.hint}>
            {classGroups[0].classe?.defaultStatusNA ? (
              <>
                Tout le monde est marqué <strong>N/A par défaut</strong> pour cette classe. Ne marque que
                les écarts.
              </>
            ) : (
              <>
                Tout le monde est{" "}
                <strong style={{ color: "var(--color-green)" }}>présent par défaut</strong>. Ne marque que
                les écarts.
              </>
            )}
          </p>
        )}
        {classGroups.length > 1 && (
          <p className={styles.hint}>
            Appel regroupé pour {classGroups.length} classes — chacune garde son propre statut par défaut.
          </p>
        )}

        {errorMsg && (
          <div style={{ marginBottom: 16 }}>
            <div className="card" style={{ padding: "12px 16px", color: "var(--color-red)", fontSize: 13 }}>
              {errorMsg}
            </div>
          </div>
        )}

        <div className="card">
          {classGroups.map((g, i) => (
            <div key={g.classe?.id || i}>
              {classGroups.length > 1 && (
                <div className={styles.groupHeader}>
                  <span className={styles.groupBadge}>{g.classe?.name}</span>
                  <span className={styles.groupHint}>
                    {g.classe?.defaultStatusNA ? "N/A par défaut" : "Présent par défaut"}
                  </span>
                </div>
              )}
              {g.students.map((s) => (
                <RollRow
                  key={s.id}
                  student={s}
                  entry={roll[s.id] || defaultEntry(g.classe)}
                  settings={settings}
                  sessionMinutes={sessionMinutes}
                  onSetStatus={(status) => setStatus(s.id, status)}
                  onPatch={(patch) => patchEntry(s.id, patch)}
                />
              ))}
            </div>
          ))}
        </div>
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
          detail={`${classGroups.map((g) => g.classe?.name).filter(Boolean).join(" + ")} · ${subject?.name} · ${timeSlot?.label}`}
          confirmLabel={submitting ? "Enregistrement…" : "Enregistrer"}
          cancelLabel="Relire"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submitting ? undefined : handleConfirmValidate}
        />
      )}
    </div>
  );
}

function ReasonPicker({ entry, onPatch, settings, sessionMinutes }) {
  const isLate = entry.status === STATUS.LATE;
  const isPartial = entry.status === STATUS.PARTIAL;
  const reasons = isLate ? settings.lateReasons : isPartial ? settings.partialReasons : settings.absenceReasons;
  return (
    <div>
      {(isLate || isPartial) && (
        <div style={{ marginBottom: 14 }}>
          <div className={styles.detailLabel}>{isLate ? "Temps d'absence" : "Temps de présence"}</div>
          <div className={styles.chipRow}>
            {(isLate ? settings.lateMinuteChoices : settings.partialMinuteChoices)
              .filter((m) => m < sessionMinutes)
              .map((m) => (
                <Pill
                  key={m}
                  size="sm"
                  tone={isLate ? "amber" : "teal"}
                  active={(isLate ? entry.minutesMissed : entry.minutesPresent) === m}
                  onClick={() => onPatch(isLate ? { minutesMissed: m } : { minutesPresent: m })}
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
            <Pill key={r.label} size="sm" active={entry.reason === r.label} onClick={() => onPatch({ reason: r.label })}>
              {r.label}
            </Pill>
          ))}
        </div>
      </div>
    </div>
  );
}

function RollRow({ student, entry, onSetStatus, onPatch, settings, sessionMinutes }) {
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
          <Pill tone="teal" active={entry.status === STATUS.PARTIAL} onClick={() => onSetStatus(STATUS.PARTIAL)}>
            Présence partielle
          </Pill>
          <Pill tone="amber" active={entry.status === STATUS.LATE} onClick={() => onSetStatus(STATUS.LATE)}>
            Retard
          </Pill>
          <Pill tone="red" active={entry.status === STATUS.ABSENT} onClick={() => onSetStatus(STATUS.ABSENT)}>
            Absent
          </Pill>
          <Pill active={entry.status === STATUS.NA} onClick={() => onSetStatus(STATUS.NA)}>
            N/A
          </Pill>
        </div>
      </div>
      {entry.status !== STATUS.PRESENT && entry.status !== STATUS.NA && (
        <div className={[styles.detail, "animate-pop"].join(" ")}>
          <div className={styles.detailBox}>
            <ReasonPicker entry={entry} onPatch={onPatch} settings={settings} sessionMinutes={sessionMinutes} />
          </div>
        </div>
      )}
    </div>
  );
}
