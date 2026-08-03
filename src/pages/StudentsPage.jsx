import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStudents } from "../lib/students";
import { useClasses } from "../lib/classes";
import { useAllRecords, computeStudentStats, exportStudentsCsv } from "../lib/attendance";
import { useSettings, buildReasonsLookup } from "../lib/settings";
import { formatDateShort } from "../lib/dates";
import { normalize } from "../lib/ids";
import { SegmentedControl } from "../components/ui/Pill";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { TextInput } from "../components/ui/Field";
import ProgressBar from "../components/ui/ProgressBar";
import Ring from "../components/ui/Ring";
import styles from "./StudentsPage.module.css";

export default function StudentsPage() {
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: classes } = useClasses({ includeArchived: true });
  const { data: records, loading: recordsLoading } = useAllRecords();
  const { settings } = useSettings();
  const [params] = useSearchParams();

  const [selectedId, setSelectedId] = useState(() => params.get("id"));
  const [view, setView] = useState("fiche");
  const [search, setSearch] = useState("");

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const stats = useMemo(() => {
    const enriched = students.map((s) => ({ ...s, className: classById.get(s.classId)?.name || "—" }));
    const reasonsLookup = buildReasonsLookup(settings);
    return computeStudentStats({
      students: enriched,
      records,
      seuil: settings.presenceThreshold,
      reasonsLookup,
    }).sort((a, b) => a.pct - b.pct);
  }, [students, classById, records, settings]);

  const filteredStats = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return stats;
    return stats.filter((s) => normalize(s.fullName).includes(q));
  }, [stats, search]);

  const selected = stats.find((s) => s.id === selectedId) || stats[0];
  const loading = studentsLoading || recordsLoading;

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1>Suivi de présence</h1>
          <p className={styles.subtitle}>
            Temps de présence effectif rapporté au temps de cours dû. Seuil d'alerte :{" "}
            {settings.presenceThreshold}%.
          </p>
        </div>
        <Button variant="ghost" onClick={() => exportStudentsCsv(stats)} disabled={!stats.length}>
          Exporter en CSV
        </Button>
      </div>

      {!loading && stats.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--color-muted)" }}>
          Aucun élève enregistré pour le moment. Ajoute des élèves depuis Paramètres → Élèves.
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={["card", styles.listPanel].join(" ")}>
            <div className={styles.searchBox}>
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un élève…"
              />
            </div>
            <div className={styles.listHeader}>{filteredStats.length} élèves · triés par présence</div>
            <div className={styles.listScroll}>
              {filteredStats.map((s) => (
                <button
                  key={s.id}
                  className={[styles.listItem, s.id === selected?.id ? styles.selected : ""].join(" ")}
                  onClick={() => setSelectedId(s.id)}
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
          </div>

          <div>
            <div className={styles.toolbar}>
              <SegmentedControl
                value={view}
                onChange={setView}
                options={[
                  { value: "fiche", label: "Fiche élève" },
                  { value: "tableau", label: "Tableau de bord" },
                ]}
              />
            </div>

            {selected &&
              (view === "fiche" ? (
                <StudentSheet student={selected} />
              ) : (
                <StudentDashboard student={selected} />
              ))}
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
              <div className={styles.ficheStatLabel}>absences</div>
            </div>
            <div>
              <div className={styles.ficheStatValue} style={{ color: "var(--color-amber)" }}>
                {s.nbRet}
              </div>
              <div className={styles.ficheStatLabel}>retards</div>
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

function StudentDashboard({ student: s }) {
  const absJust = s.absences.filter((a) => a.justified).length;
  const absNonJust = s.absences.filter((a) => !a.justified).length;
  const retardMin = s.absences
    .filter((a) => a.minutesMissed && a.minutesMissed < 50)
    .reduce((sum, a) => sum + a.minutesMissed, 0);

  return (
    <div className="animate-pop">
      <div className={styles.tableauHead}>
        <div>
          <div className={styles.tableauName}>{s.fullName}</div>
          <div className={styles.tableauMeta}>{s.className}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className={styles.tableauPct}>{s.pct}%</div>
          <div className={styles.tableauPctLabel}>
            présence effective · {s.minutesSeen} / {s.minutesDue} min
          </div>
        </div>
      </div>

      <div className={styles.miniStats}>
        <div className={["card", styles.miniStat].join(" ")}>
          <div className={styles.miniStatLabel}>Absences justifiées</div>
          <div className={styles.miniStatValue}>{absJust}</div>
        </div>
        <div className={["card", styles.miniStat].join(" ")}>
          <div className={styles.miniStatLabel}>Non justifiées</div>
          <div className={styles.miniStatValue} style={{ color: "var(--color-red)" }}>
            {absNonJust}
          </div>
        </div>
        <div className={["card", styles.miniStat].join(" ")}>
          <div className={styles.miniStatLabel}>Retards cumulés</div>
          <div className={styles.miniStatValue} style={{ color: "var(--color-amber)" }}>
            {retardMin} min
          </div>
        </div>
      </div>

      <div className={["card", styles.subjectTable].join(" ")}>
        <div className={styles.subjectTableHead}>
          <span>Matière</span>
          <span>Séances</span>
          <span>Minutes</span>
          <span>Présence</span>
        </div>
        {s.subjects.map((subj) => (
          <div key={subj.name} className={["tabular", styles.subjectTableRow].join(" ")}>
            <span style={{ fontWeight: 600 }}>{subj.name}</span>
            <span style={{ color: "var(--color-ink-soft)" }}>{subj.sessions}</span>
            <span style={{ color: "var(--color-ink-soft)" }}>
              {subj.seen} / {subj.due}
            </span>
            <span className={styles.presenceCell}>
              <span style={{ flex: 1 }}>
                <ProgressBar pct={subj.pct} color={subj.color} size="sm" />
              </span>
              <strong>{subj.pct}%</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
