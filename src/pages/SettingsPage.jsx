import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Callout from "../components/ui/Callout";
import styles from "./settings/Shared.module.css";
import StudentsAdminTab from "./settings/StudentsAdminTab";
import ClassesAdminTab from "./settings/ClassesAdminTab";
import SubjectsAdminTab from "./settings/SubjectsAdminTab";
import TeachersAdminTab from "./settings/TeachersAdminTab";
import RegisterTab from "./settings/RegisterTab";
import ScheduleTab from "./settings/ScheduleTab";

const TABS = [
  { key: "eleves", label: "Élèves", Component: StudentsAdminTab },
  { key: "classes", label: "Classes", Component: ClassesAdminTab },
  { key: "matieres", label: "Matières", Component: SubjectsAdminTab },
  { key: "enseignants", label: "Enseignants & admins", Component: TeachersAdminTab },
  { key: "registre", label: "Registre des appels", Component: RegisterTab },
  { key: "horaires", label: "Horaires & seuil", Component: ScheduleTab },
];

export default function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  if (!tab) return <Navigate to="/parametres/eleves" replace />;

  const current = TABS.find((t) => t.key === tab) || TABS[0];

  return (
    <div className="page">
      <h1>Paramètres</h1>
      <p style={{ fontSize: 15, color: "var(--color-ink-soft)", margin: "8px 0 20px" }}>
        Réservé aux administrateurs. Toute modification est horodatée et signée.
      </p>

      {!isAdmin && (
        <div style={{ marginBottom: 24 }}>
          <Callout tone="warning">
            Ton compte n'a pas le rôle administrateur : tu peux consulter ces écrans, mais les
            créations, affectations et corrections sont désactivées.
          </Callout>
        </div>
      )}

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={[styles.tab, t.key === current.key ? styles.active : ""].join(" ")}
            onClick={() => navigate(`/parametres/${t.key}`)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <current.Component isAdmin={isAdmin} />
    </div>
  );
}
