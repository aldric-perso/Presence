import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClasses } from "../lib/classes";
import { useStudents } from "../lib/students";
import { useTodayRecords, STATUS } from "../lib/attendance";
import { todayISO, formatDateLabel } from "../lib/dates";
import Button from "../components/ui/Button";
import StatTile from "../components/ui/StatTile";
import styles from "./HomePage.module.css";

export default function HomePage() {
  const { profile } = useAuth();
  const { data: classes } = useClasses();
  const { data: students } = useStudents();
  const { data: todayRecords, loading } = useTodayRecords();

  const nbAbsents = todayRecords.reduce(
    (sum, r) => sum + (r.entries || []).filter((e) => e.status === STATUS.ABSENT).length,
    0,
  );
  const nbRetards = todayRecords.reduce(
    (sum, r) => sum + (r.entries || []).filter((e) => e.status === STATUS.LATE).length,
    0,
  );

  return (
    <div className="page">
      <div className="eyebrow">{formatDateLabel(todayISO())}</div>
      <h1>Bonjour {profile?.displayName?.split(" ")[0] || ""}.</h1>
      <p className={styles.subtitle}>
        {classes.length} classes actives · {students.length} élèves suivis à l'établissement.
      </p>

      <div className={styles.statsGrid}>
        <StatTile label="Appels aujourd'hui" value={todayRecords.length} />
        <StatTile label="Absents aujourd'hui" value={nbAbsents} alert={nbAbsents > 0} />
        <StatTile label="Retards aujourd'hui" value={nbRetards} />
      </div>

      <div className={styles.header}>
        <h2 className={styles.sectionTitle}>Appels enregistrés aujourd'hui</h2>
        <Button as={Link} to="/appel/nouveau">
          Nouvel appel
        </Button>
      </div>

      <div className={["card", styles.list].join(" ")}>
        {!loading && todayRecords.length === 0 && (
          <div className={styles.empty}>Aucun appel enregistré pour aujourd'hui pour l'instant.</div>
        )}
        {todayRecords.map((r) => (
          <div key={r.id} className={styles.row}>
            <div className="tabular" style={{ fontWeight: 600, fontSize: 14 }}>
              {r.timeSlotLabel}
            </div>
            <div>
              <div className={styles.className}>{r.className}</div>
              <div className={styles.classMeta}>
                {r.subjectName} · signé {r.authorName}
              </div>
            </div>
            <div className="tabular" style={{ fontSize: 13, color: "var(--color-ink-soft)" }}>
              {r.entries.filter((e) => e.status === STATUS.PRESENT).length} présents ·{" "}
              {r.entries.filter((e) => e.status === STATUS.LATE).length} retards ·{" "}
              {r.entries.filter((e) => e.status === STATUS.ABSENT).length} absents
            </div>
            <div style={{ textAlign: "right" }}>
              <Button as={Link} to="/parametres/registre" variant="ghost" size="sm">
                Consulter
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
