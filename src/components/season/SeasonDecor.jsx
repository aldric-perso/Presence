import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSeason } from "../../context/SeasonContext";
import styles from "./SeasonDecor.module.css";

/* Formes des particules : tracés SVG simples, colorés par `currentColor`. */
const SHAPES = {
  circle: <circle cx="12" cy="12" r="10" />,
  confetti: <rect x="3" y="8" width="18" height="8" rx="1.5" />,
  flake: (
    <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
    </g>
  ),
  leaf: <path d="M4 20C4 9 11 3 21 3c0 10-6 17-17 17Zm0 0 9-9" />,
  petal: <path d="M12 2c5 4 7 9 0 20C5 11 7 6 12 2Z" />,
  heart: <path d="M12 21S3 14.5 3 8.6A4.6 4.6 0 0 1 12 6.9 4.6 4.6 0 0 1 21 8.6C21 14.5 12 21 12 21Z" />,
  star: <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6L12 2Z" />,
  // Croche : tête pleine, hampe et crochet.
  note: (
    <>
      <ellipse cx="8" cy="18" rx="4.4" ry="3.3" transform="rotate(-20 8 18)" />
      <path d="M11.4 3h2v15h-2z" />
      <path d="M13.4 3c1.2 5.2 6.4 5.6 6 11.6-1.6-3-4.6-3.6-6-4.8Z" />
    </>
  ),
  // Deux croches liées par une barre.
  notes: (
    <>
      <ellipse cx="6.5" cy="18.5" rx="4" ry="3" transform="rotate(-20 6.5 18.5)" />
      <ellipse cx="17.5" cy="16.5" rx="4" ry="3" transform="rotate(-20 17.5 16.5)" />
      <path d="M9 5h2v13.5H9zM20 3h2v13.5h-2z" />
      <path d="M9 5 22 3v4.4L9 9.4Z" />
    </>
  ),
};

/** Générateur pseudo-aléatoire déterministe : le décor est identique d'un rendu à l'autre. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h;
}

/**
 * Couche de particules animées (neige, confettis, feuilles…). Purement décorative : positionnée en
 * absolu dans son parent (qui doit être `position: relative; overflow: hidden`), insensible à la
 * souris, masquée si la personne préfère réduire les animations.
 */
export function SeasonParticles({ season, count }) {
  const { shape, motion, colors, size, count: defaultCount } = season.particles;
  const shapes = Array.isArray(shape) ? shape : [shape];
  const total = count ?? defaultCount;

  const items = useMemo(() => {
    const rand = seeded(hash(season.id));
    return Array.from({ length: total }, (_, i) => {
      const dur = 9 + rand() * 10;
      return {
        key: i,
        left: rand() * 100,
        size: size[0] + rand() * (size[1] - size[0]),
        color: colors[i % colors.length],
        dur,
        delay: -rand() * dur,
        dx: (rand() - 0.5) * 120,
        rot: (rand() - 0.5) * 540,
      };
    });
  }, [season.id, total, size, colors]);

  return (
    <div className={styles.layer} aria-hidden="true">
      {items.map((p) => (
        <svg
          key={p.key}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={[styles.particle, styles[motion]].join(" ")}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            color: p.color,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            "--dx": `${p.dx}px`,
            "--rot": `${p.rot}deg`,
          }}
        >
          {SHAPES[shapes[p.key % shapes.length]]}
        </svg>
      ))}
    </div>
  );
}

/**
 * En-tête « poussé » de la page Aujourd'hui : dégradé aux couleurs de la période, particules,
 * grand pictogramme et mot de saison. Sans thème actif, rend simplement ses enfants.
 */
export function SeasonHero({ children }) {
  const { season } = useSeason();
  if (!season) return children;

  return (
    <header className={styles.hero}>
      <SeasonParticles season={season} />
      <div className={styles.heroBody}>
        <span className={styles.chip}>
          <span aria-hidden="true">{season.emoji}</span> {season.greeting}
        </span>
        {children}
      </div>
      <div className={styles.heroEmoji} aria-hidden="true">
        {season.emoji}
      </div>
    </header>
  );
}

/** Bandeau « moyen » affiché en haut des autres pages (la page Aujourd'hui a son propre en-tête). */
export function SeasonBand() {
  const { season } = useSeason();
  const { pathname } = useLocation();
  if (!season || pathname === "/") return null;

  return (
    <div className={styles.band}>
      <SeasonParticles season={season} count={Math.min(season.particles.count, 12)} />
      <span className={styles.bandText}>
        <span aria-hidden="true">{season.emoji}</span> {season.greeting}
      </span>
    </div>
  );
}

/** Pastille flottante rappelant qu'un aperçu local est en cours (écran Apparence, admins). */
export function SeasonPreviewPill() {
  const { previewId, setPreviewId, season } = useSeason();
  if (!previewId || !season) return null;

  return (
    <div className={styles.previewPill} role="status">
      <span>
        Aperçu : <strong>{season.label}</strong>
      </span>
      <button type="button" onClick={() => setPreviewId(null)}>
        Quitter l'aperçu
      </button>
    </div>
  );
}
