import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useClasses } from "../lib/classes";
import { useSubjects } from "../lib/subjects";
import { useTimeSlots } from "../lib/timeSlots";
import { checkExistingRecord } from "../lib/attendance";
import { todayISO, isoDaysAgo, formatDateLabel } from "../lib/dates";
import { Pill } from "../components/ui/Pill";
import { Field, Select } from "../components/ui/Field";
import Button from "../components/ui/Button";
import Callout from "../components/ui/Callout";
import Modal from "../components/ui/Modal";

export default function NewAttendancePage() {
  const navigate = useNavigate();
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const { data: timeSlots } = useTimeSlots();

  const [date, setDate] = useState(todayISO());
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [timeSlotId, setTimeSlotId] = useState("");
  const [duplicate, setDuplicate] = useState(null);
  const [checking, setChecking] = useState(false);
  const [confirmRetro, setConfirmRetro] = useState(false);

  useEffect(() => {
    if (classes.length && !classId) setClassId(classes[0].id);
  }, [classes, classId]);
  useEffect(() => {
    if (subjects.length && !subjectId) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);
  useEffect(() => {
    if (timeSlots.length && !timeSlotId) setTimeSlotId(timeSlots[0].id);
  }, [timeSlots, timeSlotId]);

  useEffect(() => {
    if (!classId || !subjectId || !timeSlotId || !date) return;
    let cancelled = false;
    setChecking(true);
    checkExistingRecord({ date, classId, subjectId, timeSlotId }).then((res) => {
      if (!cancelled) {
        setDuplicate(res);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [classId, subjectId, timeSlotId, date]);

  const isToday = date === todayISO();
  const canOpen = !duplicate && !checking && classId && subjectId && timeSlotId;

  const quickDates = useMemo(
    () => [
      { key: todayISO(), label: `Aujourd'hui — ${formatDateLabel(todayISO())}` },
      { key: isoDaysAgo(1), label: formatDateLabel(isoDaysAgo(1)) },
    ],
    [],
  );

  function openSheet() {
    navigate(
      `/appel/prendre?date=${date}&classId=${classId}&subjectId=${subjectId}&timeSlotId=${timeSlotId}`,
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Field label="Classe">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Matière">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Créneau <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>— séances de 50 minutes</span>
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {timeSlots.map((slot) => (
              <Pill key={slot.id} active={timeSlotId === slot.id} onClick={() => setTimeSlotId(slot.id)}>
                {slot.label}
              </Pill>
            ))}
          </div>
        </div>

        {duplicate && (
          <Callout tone="danger">
            <strong>Appel déjà enregistré</strong> pour cette classe, cette matière et ce créneau,
            par {duplicate.authorName}. Tu ne peux pas en créer un second.
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
