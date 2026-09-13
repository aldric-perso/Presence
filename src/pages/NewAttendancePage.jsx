import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClasses } from "../lib/classes";
import { useSubjects } from "../lib/subjects";
import { useTimeSlots, durationMinutes, formatDuration } from "../lib/timeSlots";
import { checkExistingRecord } from "../lib/attendance";
import { todayISO, isoDaysAgo, formatDateLabel } from "../lib/dates";
import { Pill } from "../components/ui/Pill";
import { Field, Select } from "../components/ui/Field";
import Button from "../components/ui/Button";
import Callout from "../components/ui/Callout";
import Modal from "../components/ui/Modal";

export default function NewAttendancePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: allClasses } = useClasses();
  const { data: allSubjects } = useSubjects();
  const { data: timeSlots } = useTimeSlots();

  const classes = useMemo(
    () => allClasses.filter((c) => (profile?.classIds || []).includes(c.id)),
    [allClasses, profile],
  );
  const subjects = useMemo(
    () => allSubjects.filter((s) => (profile?.subjectIds || []).includes(s.id)),
    [allSubjects, profile],
  );

  const [date, setDate] = useState(todayISO());
  const [classIds, setClassIds] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [timeSlotId, setTimeSlotId] = useState("");
  const [duplicates, setDuplicates] = useState([]);
  const [checking, setChecking] = useState(false);
  const [confirmRetro, setConfirmRetro] = useState(false);

  useEffect(() => {
    if (subjects.length && !subjectId) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);
  useEffect(() => {
    if (timeSlots.length && !timeSlotId) setTimeSlotId(timeSlots[0].id);
  }, [timeSlots, timeSlotId]);

  function toggleClass(id) {
    setClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const classIdsKey = classIds.join(",");
  useEffect(() => {
    if (classIds.length === 0 || !subjectId || !timeSlotId || !date) {
      setDuplicates([]);
      return;
    }
    let cancelled = false;
    setChecking(true);
    Promise.all(classIds.map((classId) => checkExistingRecord({ date, classId, subjectId, timeSlotId }))).then(
      (results) => {
        if (cancelled) return;
        setDuplicates(
          results
            .map((record, i) => ({ classId: classIds[i], record }))
            .filter((d) => d.record),
        );
        setChecking(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classIdsKey, subjectId, timeSlotId, date]);

  const isToday = date === todayISO();
  const canOpen = duplicates.length === 0 && !checking && classIds.length > 0 && subjectId && timeSlotId;

  const quickDates = useMemo(
    () => [
      { key: todayISO(), label: `Aujourd'hui — ${formatDateLabel(todayISO())}` },
      { key: isoDaysAgo(1), label: formatDateLabel(isoDaysAgo(1)) },
    ],
    [],
  );

  function openSheet() {
    navigate(
      `/appel/prendre?date=${date}&classIds=${classIds.join(",")}&subjectId=${subjectId}&timeSlotId=${timeSlotId}`,
    );
  }

  function handleOpenClick() {
    if (!isToday) {
      setConfirmRetro(true);
    } else {
      openSheet();
    }
  }

  return (
    <div className="page page--narrow">
      <div className="eyebrow">Étape 1 sur 2</div>
      <h1 style={{ margin: "10px 0 8px", fontSize: 40 }}>Paramètres de l'appel</h1>
      <p style={{ fontSize: 15, color: "var(--color-ink-soft)", margin: "0 0 32px", maxWidth: "56ch" }}>
        Ces quatre champs identifient l'appel de façon unique. Un seul enregistrement est possible
        par combinaison.
      </p>

      <div className="card" style={{ padding: 28, display: "grid", gap: 22 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Date de l'appel
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {quickDates.map((d) => (
              <Pill key={d.key} active={date === d.key} onClick={() => setDate(d.key)}>
                {d.label}
              </Pill>
            ))}
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid var(--color-line-strong)",
                fontSize: 13,
              }}
            />
          </div>
          {!isToday && (
            <div style={{ marginTop: 12 }}>
              <Callout tone="warning">
                Tu t'apprêtes à saisir un appel pour un jour différent d'aujourd'hui. Une
                confirmation te sera demandée avant l'enregistrement.
              </Callout>
            </div>
          )}
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Classe(s)
          </label>
          <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: "0 0 10px" }}>
            Sélectionne plusieurs classes si tu fais l'appel pour un groupe réuni (co-enseignement,
            option…) : une liste unique s'ouvrira, regroupée par classe.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {classes.map((c) => (
              <Pill key={c.id} active={classIds.includes(c.id)} onClick={() => toggleClass(c.id)}>
                {c.name}
              </Pill>
            ))}
          </div>
        </div>

        <Field label="Matière">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        {classes.length === 0 && (
          <Callout tone="warning">
            Aucune classe ne t'a été affectée. Demande à un administrateur de mettre à jour tes
            affectations dans Paramètres → Enseignants & admins.
          </Callout>
        )}

        {subjects.length === 0 && (
          <Callout tone="warning">
            Aucune matière ne t'a été affectée. Demande à un administrateur de mettre à jour tes
            affectations dans Paramètres → Enseignants & admins.
          </Callout>
        )}

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Créneau
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {timeSlots.map((slot) => {
              const minutes = durationMinutes(slot.label);
              return (
                <Pill key={slot.id} active={timeSlotId === slot.id} onClick={() => setTimeSlotId(slot.id)}>
                  {slot.label}
                  {minutes != null && ` (${formatDuration(minutes)})`}
                </Pill>
              );
            })}
          </div>
        </div>

        {duplicates.length > 0 && (
          <Callout tone="danger">
            <strong>Appel déjà enregistré</strong> pour cette matière et ce créneau, pour{" "}
            {duplicates
              .map((d) => {
                const c = classes.find((cl) => cl.id === d.classId);
                return `${c?.name || "?"} (par ${d.record.authorName})`;
              })
              .join(", ")}
            . Désélectionne cette classe ou change de créneau pour continuer.
          </Callout>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <Button variant="ghost" as={Link} to="/">
          Annuler
        </Button>
        <Button onClick={handleOpenClick} disabled={!canOpen}>
          Ouvrir la feuille →
        </Button>
      </div>

      {confirmRetro && (
        <Modal
          kicker="Contrôle de date"
          title="Ce n'est pas la date du jour"
          text="Tu t'apprêtes à saisir un appel pour une date antérieure. Cette saisie sera signalée comme rétroactive dans le registre et signée à ton nom."
          confirmLabel="Confirmer la date"
          cancelLabel="Revenir"
          onCancel={() => setConfirmRetro(false)}
          onConfirm={openSheet}
        />
      )}
    </div>
  );
}
