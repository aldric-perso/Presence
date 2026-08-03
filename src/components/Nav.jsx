import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Avatar from "./ui/Avatar";
import styles from "./Nav.module.css";

const LINKS = [
  { to: "/", label: "Aujourd'hui", end: true, match: ["/appel"] },
  { to: "/eleves", label: "Suivi des élèves" },
  { to: "/parametres", label: "Paramètres" },
];

export default function Nav() {
  const { profile, signOut } = useAuth();

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>P</div>
        <span className={styles.brandName}>Présences</span>
      </div>

      <div className={styles.links}>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => {
              const alsoActive =
                !isActive &&
                link.match?.some((m) => window.location.pathname.startsWith(m));
              return [styles.link, isActive || alsoActive ? styles.active : ""].join(" ");
            }}
          >
            <span className={styles.dot} />
            {link.label}
          </NavLink>
        ))}
      </div>

      <div className={styles.footer}>
        <Avatar name={profile?.displayName || ""} size={30} tone="brand" />
        <div className={styles.userMeta}>
          <div className={styles.userName}>{profile?.displayName || "…"}</div>
          <div className={styles.userRole}>
            {profile?.role === "admin" ? "Administrateur" : "Enseignant"}
          </div>
        </div>
        <button className={styles.logout} onClick={signOut}>
          Sortir
        </button>
      </div>
    </nav>
  );
}
