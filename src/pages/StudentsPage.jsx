import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStudents } from "../lib/students";
import { useClasses } from "../lib/classes";
import { useSubjects } from "../lib/subjects";
import { useAllRecords, computeStudentStats } from "../lib/attendance";
import { exportStudentTrackingExcel } from "../lib/studentTrackingExport";
import { useSettings, buildReasonsLookup } from "../lib/settings";
import { formatDateShort, todayISO, schoolYearStartISO } from "../lib/dates";
import { normalize } from "../lib/ids";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Field, TextInput } from "../components/ui/Field";
import ProgressBar from "../components/ui/ProgressBar";
import Ring from "../components/ui/Ring";
import styles from "./StudentsPage.module.css";

export default function StudentsPage() {
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: classes } = useClasses({ includeArchived: true });
  const { data: subjects } = useSubjects();
  const { data: records, loading: recordsLoading } = useAllRecords();
  const { settings } = useSettings();
  const [params] = useSearchParams();

  const [selectedId, setSelectedId] = useState(() => params.get("id"));
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(() => schoolYearStartISO());
  const [endDate, setEndDate] = useState(() => todayISO());
  const [mobileShowDetail, setMobileShowDetail] = useState(() => !!params.get("id"));
  const [exporting, setExporting] = useState(false);

  async function handleExportExcel() {
    setExporting(true);
    try {
      await exportStudentTrackingExcel({ students, classes, subjects, records, startDate, endDate });
    } finally {
      setExporting(false);
    }
  }

  function selectStudent(id) {
    setSelectedId(id);
    setMobileShowDetail(true);
  }

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const periodRecords = useMemo(() => {
    const start = startDate <= endDate ? startDate : endDate;
    const end = startDate <= endDate ? endDate : startDate;
    return records.filter((r) => r.date >= start && r.date <= end);
  }, [records, startDate, endDate]);

  const stats = useMemo(() => {
    const enriched = students.map((s) => ({ ...s, className: classById.get(s.classId)?.name || "—" }));
    const reasonsLookup = buildReasonsLookup(settings);
    return computeStudentStats({
      students: enriched,
      records: periodRecords,
      seuil: settings.presenceThreshold,
      reasonsLookup,
    }).sort((a, b) => a.pct - b.pct);
  }, [students, classById, periodRecords, settings]);

  const trackedStats = useMemo(() => stats.filter((s) => s.subjects.length > 0), [stats]);

  const filteredStats = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return trackedStats;
    return trackedStats.filter((s) => normalize(s.fullName).includes(q));
  }, [trackedStats, search]);

  const selected = stats.find((s) => s.id === selectedId) || filteredStats[0];
  const loading = studentsLoading || recordsLoading;

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1>Suivi de présence</h1>
          <p className={styles.subtitle}>
            Temps de présence effectif rapporté au temps de cours dû, sur la période sélectionnée.
            Seuil d'alerte : {settings.presenceThreshold}%.
          </p>
        </div>
        <Button
          variant="ghost"
          className={styles.desktopOnly}
          onClick={handleExportExcel}
          disabled={!students.length || !subjects.length || exporting}
        >
          {exporting ? "Export en cours…" : "Exporter en Excel"}
        </Button>
      </div>

      <div className={["card", styles.periodBar].join(" ")}>
        <Field label="Du">
          <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Au">
          <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      {!loading && trackedStats.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--color-muted)" }}>
          {students.length === 0
            ? "Aucun élève enregistré pour le moment. Ajoute des élèves depuis Paramètres → Élèves."
            : "Aucun élève n'a eu d'appel enregistré sur cette période."}
        </div>
      ) : (
        <div className={styles.layout}>
          <div
            className={[
              "card",
              styles.listPanel,
              mobileShowDetail ? styles.mobileHide : "",
            ].join(" ")}
          >
            <div className={styles.searchBox}>
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un élève…"
              />
            </div>
            <div className={styles.listHeader}>{filteredStats.length} élèves · triés par présence</div>
            {filteredStats.length === 0 ? (
              <div style={{ padding: "24px 4px", textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
                Aucun élève ne correspond à « {search.trim()} ».
              </div>
            ) : (
              <div className={styles.listScroll}>
                {filteredStats.map((s) => (
                  <button
                    key={s.id}
                    className={[styles.listItem, s.id === selected?.id ? styles.selected : ""].join(" ")}
                    onClick={() => selectStudent(s.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div className={styles.listItemName}>{s.fullName}</div>
                      <div className={styles.listItemMeta}>
                        {s.className}
                        {s.departedAt && " · parti"}
                      </div>
                    </div>
                    <div className={["tabular", styles.listItemPct].join(" ")}>{s.pct}%</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={!mobileShowDetail ? styles.mobileHide : ""}>
            <button type="button" className={styles.backButton} onClick={() => setMobileShowDetail(false)}>
              ← Retour à la liste
            </button>
            {selected && <StudentSheet student={selected} />}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentSheet({ student: s }) {
  return (
    <div className={["card", styles.fiche, "animate-pop"].join(" ")}>
      <div className={styles.ficheTop}>
        <Ring pct={s.pct} color={s.color} />
        <div style={{ flex: 1 }}>
          <div className={styles.ficheName}>{s.fullName}</div>
          <div className={styles.ficheMeta}>{s.className}</div>
          <div className={["tabular", styles.ficheStats].join(" ")}>
            <div>
              <div className={styles.ficheStatValue}>{s.minutesSeen}</div>
              <div className={styles.ficheStatLabel}>min suivies</div>
            </div>
            <div>
              <div className={styles.ficheStatValue}>{s.minutesDue}</div>
              <div className={styles.ficheStatLabel}>min dues</div>
            </div>
            <div>
              <div className={styles.ficheStatValue} style={{ color: "var(--color-red)" }}>
                {s.nbAbs}
              </div>
              <div className={styles.ficheStatLabel}>
                absences
                {s.nbAbs > 0 && (
                  <span className={styles.ficheStatBreakdown}>
                    {s.nbAbsJustifiee} justifiée{s.nbAbsJustifiee > 1 ? "s" : ""} · {s.nbAbsNonJustifiee} non
                    justifiée{s.nbAbsNonJustifiee > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className={styles.ficheStatValue} style={{ color: "var(--color-amber)" }}>
                {s.nbRet}
              </div>
              <div className={styles.ficheStatLabel}>
                retards
                {s.nbRet > 0 && (
                  <span className={styles.ficheStatBreakdown}>
                    {s.nbRetJustifie} justifié{s.nbRetJustifie > 1 ? "s" : ""} · {s.nbRetNonJustifie} non
                    justifié{s.nbRetNonJustifie > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className={styles.ficheStatValue} style={{ color: "var(--color-teal)" }}>
                {s.nbPartiel}
              </div>
              <div className={styles.ficheStatLabel}>présences partielles</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.sectionLabel}>Détail par matière</div>
      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
        {s.subjects.map((subj) => (
          <div key={subj.name}>
            <div className={styles.subjectRow}>
              <span style={{ fontWeight: 600 }}>{subj.name}</span>
              <span className="tabular" style={{ color: "var(--color-ink-soft)" }}>
                {subj.seen} / {subj.due} min · <strong style={{ color: "var(--color-ink)" }}>{subj.pct}%</strong>
              </span>
            </div>
            <ProgressBar pct={subj.pct} color={subj.color} />
          </div>
        ))}
        {s.subjects.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>Aucun appel enregistré pour cet élève.</p>
        )}
      </div>

      <div className={styles.sectionLabel}>Dernières absences</div>
      <div style={{ marginTop: 10 }}>
        {s.absences.map((a, i) => (
          <div key={i} className={styles.absenceRow}>
            <span className="tabular" style={{ color: "var(--color-ink-soft)" }}>
              {formatDateShort(a.date)}
            </span>
            <span>
              {a.subject} — <span style={{ color: "var(--color-ink-soft)" }}>{a.reason}</span>
            </span>
            <Badge tone={a.justified ? "green" : "red"}>
              {a.minutesMissed} min · {a.justified ? "justifié" : "non justifié"}
            </Badge>
          </div>
        ))}
        {s.absences.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>Aucune absence enregistrée.</p>
        )}
      </div>
    </div>
  );
}
