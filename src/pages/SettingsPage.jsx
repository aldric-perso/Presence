import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { linkWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import Callout from "../components/ui/Callout";
import Button from "../components/ui/Button";
import Avatar from "../components/ui/Avatar";
import styles from "./settings/Shared.module.css";
import StudentsAdminTab from "./settings/StudentsAdminTab";
import ClassesAdminTab from "./settings/ClassesAdminTab";
import SubjectsAdminTab from "./settings/SubjectsAdminTab";
import TeachersAdminTab from "./settings/TeachersAdminTab";
import ScheduleTab from "./settings/ScheduleTab";

const TABS = [
  { key: "eleves", label: "Élèves", Component: StudentsAdminTab },
  { key: "classes", label: "Classes", Component: ClassesAdminTab },
  { key: "matieres", label: "Matières", Component: SubjectsAdminTab },
  { key: "enseignants", label: "Enseignants & admins", Component: TeachersAdminTab },
  { key: "horaires", label: "Horaires & seuil", Component: ScheduleTab },
];

export default function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut, user } = useAuth();
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");

  if (!tab) return <Navigate to="/parametres/eleves" replace />;

  const current = TABS.find((t) => t.key === tab) || TABS[0];
  const hasGoogleLinked = user?.providerData?.some((p) => p.providerId === "google.com");

  async function handleLinkGoogle() {
    setLinkError("");
    setLinking(true);
    try {
      await linkWithPopup(user, new GoogleAuthProvider());
    } catch (err) {
      setLinkError(
        err.code === "auth/credential-already-in-use"
          ? "Ce compte Google est déjà utilisé par un autre compte."
          : "La liaison avec Google a échoué. Réessaie.",
      );
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="page">
      <h1>Paramètres</h1>
      <p style={{ fontSize: 15, color: "var(--color-ink-soft)", margin: "8px 0 20px" }}>
        Réservé aux administrateurs. Toute modification est horodatée et signée.
      </p>

      <div className="card" style={{ padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar name={profile?.displayName || ""} size={38} tone="brand" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{profile?.displayName || "…"}</div>
          <div style={{ fontSize: 12, color: "var(--color-ink-soft)" }}>
            {isAdmin ? "Administrateur" : "Enseignant"}
          </div>
        </div>
        {!hasGoogleLinked && (
          <Button variant="ghost" size="sm" onClick={handleLinkGoogle} disabled={linking}>
            {linking ? "Liaison…" : "Lier mon compte Google"}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={signOut}>
          Se déconnecter
        </Button>
      </div>

      {linkError && (
        <div style={{ marginBottom: 24 }}>
          <Callout tone="danger">{linkError}</Callout>
        </div>
      )}

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
