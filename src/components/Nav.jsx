import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Avatar from "./ui/Avatar";
import styles from "./Nav.module.css";

const ICONS = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V20a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9.5" />
    </svg>
  ),
  students: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.7 14.3c2.3.5 4 2.5 4 5.7" />
    </svg>
  ),
  register: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 3v3M15 3v3M8 11h8M8 15h5" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h9M17 7h3" />
      <circle cx="14" cy="7" r="2" />
      <path d="M4 12h3M11 12h9" />
      <circle cx="8" cy="12" r="2" />
      <path d="M4 17h9M17 17h3" />
      <circle cx="14" cy="17" r="2" />
    </svg>
  ),
};

const LINKS = [
  { to: "/", label: "Aujourd'hui", shortLabel: "Aujourd'hui", icon: "home", end: true, match: ["/appel"] },
  { to: "/eleves", label: "Suivi des élèves", shortLabel: "Élèves", icon: "students" },
  { to: "/registre", label: "Registre des appels", shortLabel: "Registre", icon: "register" },
  { to: "/parametres", label: "Paramètres", shortLabel: "Paramètres", icon: "settings" },
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
            <span className={styles.icon}>{ICONS[link.icon]}</span>
            <span className={styles.dot} />
            <span className={styles.label}>{link.label}</span>
            <span className={styles.shortLabel}>{link.shortLabel}</span>
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
