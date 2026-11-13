/**
 * Thèmes saisonniers : calendrier des périodes, palettes et décors.
 *
 * Une seule source de vérité : pour ajouter / retirer / déplacer une période, il suffit de
 * modifier le tableau SEASONS ci-dessous.
 *
 * - `range: ["MM-JJ", "MM-JJ"]` : période fixe, bornes incluses, chaque année.
 * - `easter: [décalageDébut, décalageFin]` : période mobile, en jours autour du dimanche de Pâques
 *   (ex. [-3, 1] = du jeudi précédent au lundi suivant).
 * - L'ORDRE COMPTE : si deux périodes se chevauchent une année donnée, la première du tableau gagne.
 *   Les événements précis passent donc avant les débuts de saison.
 *
 * Palette (toutes les couleurs sont validées pour le contraste, cf. scripts/check-season-contrast.mjs) :
 * - dark      : fond du menu, des boutons principaux et du bandeau de connexion
 * - brand*    : couleur d'accent de l'interface (liens, avatar, pastille de marque). Volontairement
 *               distincte du vert/rouge/ambre « sémantiques » (présent / absent / retard), qui ne
 *               changent jamais d'une période à l'autre.
 * - bg        : fond de page (très léger voile de couleur)
 * - heroFrom/heroTo : dégradé du bandeau décoratif (texte clair par-dessus)
 * - strip     : liseré décoratif en haut des pages (facultatif, sinon dégradé hero)
 *
 * Message : `greeting` (ex. « Bientôt la Saint-Valentin ! »), remplacé par `lateGreeting.text`
 *   (ex. « Joyeuse Saint-Valentin ! ») à partir du jour "MM-JJ" (`from`) ou, pour les fêtes mobiles,
 *   du jour situé à `easterOffset` jours de Pâques. Les périodes qui précèdent la fête disent donc
 *   « Bientôt… », et le vœu n'est formulé que le jour J.
 *
 * Particules : `shape` (ou liste de formes, alternées) ∈ flake | circle | confetti | leaf | petal | heart | star | note | notes,
 * `motion` ∈ fall (tombent) | rise (montent).
 */

export const SEASONS = [
  // Le 21 décembre tombe en plein Noël : « hiver » passe avant « noel » pour ce seul jour.
  {
    id: "hiver",
    label: "Début de l'hiver",
    emoji: "❄️",
    greeting: "Bon hiver !",
    range: ["12-21", "12-21"],
    palette: {
      dark: "#14232e",
      brand: "#2a6a8f",
      brandDark: "#1f506c",
      brandSoft: "#a8d4ee",
      brandBg: "#e8f1f7",
      bg: "#f2f6f9",
      heroFrom: "#16384d",
      heroTo: "#2a6a8f",
      strip: "repeating-linear-gradient(90deg, #cfe8f7 0 18px, #2a6a8f 18px 36px, #ffffff 36px 44px, #2a6a8f 44px 62px)",
    },
    particles: { shape: "flake", motion: "fall", colors: ["#d6ecfa", "#ffffff", "#9cd3f0"], count: 26, size: [8, 18] },
  },
  {
    id: "noel",
    label: "Noël",
    emoji: "🎄",
    // La période démarre très tôt : on prépare Noël, et on ne souhaite « Joyeux Noël » qu'aux derniers jours.
    greeting: "En avant vers Noël !",
    lateGreeting: { from: "12-24", text: "Joyeux Noël !" },
    range: ["12-01", "12-25"],
    palette: {
      dark: "#2b1215",
      brand: "#9f2f2a",
      brandDark: "#7a2320",
      brandSoft: "#f0a9a0",
      brandBg: "#fbeceb",
      bg: "#f8f3ee",
      heroFrom: "#1d3b2f",
      heroTo: "#7d2422",
      strip:
        "repeating-linear-gradient(90deg, #b3342e 0 16px, #f3d27a 16px 22px, #2f7a58 22px 38px, #f3d27a 38px 44px)",
    },
    particles: { shape: "flake", motion: "fall", colors: ["#ffffff", "#e8f1ff"], count: 30, size: [6, 14] },
  },
  {
    id: "nouvel-an",
    label: "Nouvel An",
    emoji: "🥂",
    greeting: "Bonne année !",
    range: ["01-01", "01-15"],
    palette: {
      dark: "#14172b",
      brand: "#3b4a9e",
      brandDark: "#2b3678",
      brandSoft: "#aab4f0",
      brandBg: "#eceefb",
      bg: "#f4f4f8",
      heroFrom: "#14172b",
      heroTo: "#4a3b8f",
      strip:
        "repeating-linear-gradient(90deg, #d9b24c 0 14px, #3b4a9e 14px 28px, #c9ccd9 28px 36px, #3b4a9e 36px 50px)",
    },
    particles: { shape: "confetti", motion: "fall", colors: ["#e8c766", "#c9ccd9", "#8f7ae0", "#ffffff"], count: 30, size: [6, 11] },
  },
  {
    id: "halloween",
    label: "Halloween",
    emoji: "🎃",
    greeting: "Bientôt Halloween !",
    lateGreeting: { from: "10-31", text: "Joyeux Halloween !" },
    range: ["10-24", "10-31"],
    palette: {
      dark: "#1a1210",
      brand: "#a8480a",
      brandDark: "#7c3407",
      brandSoft: "#f3a66a",
      brandBg: "#fbede2",
      bg: "#f8f3ec",
      heroFrom: "#1a1210",
      heroTo: "#6b2f08",
      strip:
        "repeating-linear-gradient(90deg, #d9690f 0 18px, #1a1210 18px 24px, #6c3fa0 24px 40px, #1a1210 40px 46px)",
    },
    particles: { shape: "circle", motion: "rise", colors: ["#f08a24", "#b266e0", "#f6c26b"], count: 22, size: [5, 12] },
  },
  {
    id: "paques",
    label: "Pâques",
    emoji: "🐣",
    greeting: "Bientôt Pâques !",
    lateGreeting: { easterOffset: 0, text: "Joyeuses Pâques !" },
    easter: [-3, 1],
    palette: {
      dark: "#2a1f3d",
      brand: "#6d4a9e",
      brandDark: "#523778",
      brandSoft: "#cbb2f0",
      brandBg: "#f1ecf9",
      bg: "#f7f5f3",
      heroFrom: "#4b3a7a",
      heroTo: "#a6407f",
      strip:
        "repeating-linear-gradient(90deg, #f6d65a 0 16px, #f4a6c8 16px 32px, #a8d8b0 32px 48px, #b9a4ec 48px 64px)",
    },
    particles: { shape: "circle", motion: "fall", colors: ["#f6d65a", "#f4a6c8", "#a8d8b0", "#cbb2f0"], count: 22, size: [7, 14] },
  },
  {
    id: "mardi-gras",
    label: "Mardi gras",
    emoji: "🎭",
    greeting: "Bientôt Mardi gras !",
    lateGreeting: { easterOffset: -47, text: "Joyeux Mardi gras !" },
    easter: [-49, -47],
    palette: {
      dark: "#1f1a33",
      brand: "#7a3fa0",
      brandDark: "#5c2d7a",
      brandSoft: "#d3b0ee",
      brandBg: "#f3ebf9",
      bg: "#f6f3f7",
      heroFrom: "#3b1d6b",
      heroTo: "#a0366e",
      strip:
        "repeating-linear-gradient(90deg, #7a3fa0 0 16px, #e7b93c 16px 32px, #2f9a7a 32px 48px, #d9467a 48px 64px)",
    },
    particles: { shape: "confetti", motion: "fall", colors: ["#f2c94c", "#4cc3a0", "#f06292", "#b388f0", "#ffffff"], count: 36, size: [6, 11] },
  },
  {
    id: "saint-valentin",
    label: "Saint-Valentin",
    emoji: "💝",
    greeting: "Bientôt la Saint-Valentin !",
    lateGreeting: { from: "02-14", text: "Joyeuse Saint-Valentin !" },
    range: ["02-08", "02-14"],
    palette: {
      dark: "#2a1220",
      brand: "#b0305a",
      brandDark: "#8a2447",
      brandSoft: "#f4a6c0",
      brandBg: "#fbebf1",
      bg: "#faf2f4",
      heroFrom: "#6b1a3a",
      heroTo: "#b0305a",
      strip: "repeating-linear-gradient(90deg, #b0305a 0 20px, #f4a6c0 20px 30px, #7a1f44 30px 50px, #f4a6c0 50px 60px)",
    },
    particles: { shape: "heart", motion: "rise", colors: ["#ffb3cc", "#ff7aa2", "#ffffff"], count: 20, size: [10, 20] },
  },
  {
    id: "chandeleur",
    label: "Chandeleur",
    emoji: "🥞",
    greeting: "Bientôt la Chandeleur !",
    lateGreeting: { from: "02-02", text: "Bonne Chandeleur !" },
    range: ["01-31", "02-02"],
    palette: {
      dark: "#3a2a14",
      brand: "#8f5a10",
      brandDark: "#6b420a",
      brandSoft: "#f0c987",
      brandBg: "#fbf1de",
      bg: "#faf5ea",
      heroFrom: "#4a3010",
      heroTo: "#8f5a10",
      strip: "repeating-linear-gradient(90deg, #e3a83a 0 18px, #f6e2a8 18px 28px, #8f5a10 28px 46px, #f6e2a8 46px 56px)",
    },
    particles: { shape: "circle", motion: "rise", colors: ["#f6d98a", "#e7b24a", "#fff3cf"], count: 20, size: [10, 22] },
  },
  {
    id: "poisson-avril",
    label: "1er avril",
    emoji: "🐟",
    greeting: "Poisson d'avril !",
    range: ["04-01", "04-01"],
    palette: {
      dark: "#10253a",
      brand: "#1f6f9c",
      brandDark: "#16547a",
      brandSoft: "#9cd3f0",
      brandBg: "#e8f3f9",
      bg: "#f2f6f9",
      heroFrom: "#0f3552",
      heroTo: "#1f6f9c",
      strip: "repeating-linear-gradient(90deg, #1f6f9c 0 20px, #9cd3f0 20px 30px, #0f3552 30px 50px, #9cd3f0 50px 60px)",
    },
    particles: { shape: "circle", motion: "rise", colors: ["#cfeaf8", "#9cd3f0", "#ffffff"], count: 22, size: [6, 16] },
  },
  {
    id: "muguet",
    label: "1er mai",
    emoji: "💐",
    greeting: "Bientôt le 1er mai !",
    lateGreeting: { from: "05-01", text: "Bon 1er mai !" },
    range: ["04-28", "05-01"],
    palette: {
      dark: "#17302a",
      brand: "#2f6b57",
      brandDark: "#23523f",
      brandSoft: "#9fd8c0",
      brandBg: "#eaf4ef",
      bg: "#f4f8f5",
      heroFrom: "#17402f",
      heroTo: "#2f6b57",
      strip: "repeating-linear-gradient(90deg, #2f6b57 0 20px, #e9f4ee 20px 30px, #1d4a3a 30px 50px, #e9f4ee 50px 60px)",
    },
    particles: { shape: "petal", motion: "fall", colors: ["#ffffff", "#e3f3ea", "#9fd8c0"], count: 22, size: [8, 16] },
  },
  {
    id: "fete-musique",
    label: "Fête de la musique",
    emoji: "🎶",
    greeting: "Bientôt la fête de la musique !",
    lateGreeting: { from: "06-21", text: "Bonne fête de la musique !" },
    range: ["06-18", "06-21"],
    palette: {
      dark: "#1a1a2e",
      brand: "#a02f7a",
      brandDark: "#7c235e",
      brandSoft: "#f0a6d6",
      brandBg: "#f9ebf4",
      bg: "#f7f3f7",
      heroFrom: "#1a1a2e",
      heroTo: "#6a2a8a",
      strip: "repeating-linear-gradient(90deg, #a02f7a 0 16px, #3fb6c9 16px 32px, #f2c94c 32px 48px, #6a2a8a 48px 64px)",
    },
    particles: { shape: ["note", "notes"], motion: "rise", colors: ["#f0a6d6", "#7fdcea", "#f6d98a", "#ffffff"], count: 20, size: [16, 28] },
  },
  {
    id: "quatorze-juillet",
    label: "Fête nationale",
    emoji: "🎆",
    greeting: "Bientôt la fête nationale !",
    lateGreeting: { from: "07-14", text: "Bonne fête nationale !" },
    range: ["07-10", "07-14"],
    palette: {
      dark: "#0f1b3d",
      brand: "#1f3f9c",
      brandDark: "#17307a",
      brandSoft: "#a4b8f4",
      brandBg: "#eaeefb",
      bg: "#f3f5f9",
      heroFrom: "#14286b",
      heroTo: "#1f3f9c",
      strip: "linear-gradient(90deg, #1f3f9c 0 33.33%, #ffffff 33.33% 66.66%, #c8312b 66.66% 100%)",
    },
    particles: { shape: "star", motion: "fall", colors: ["#ffffff", "#ff6b64", "#8fa8f5"], count: 26, size: [8, 16] },
  },
  {
    id: "rentree",
    label: "Rentrée",
    emoji: "🎒",
    greeting: "Bonne rentrée !",
    range: ["09-01", "09-10"],
    palette: {
      dark: "#12263a",
      brand: "#1f5aa0",
      brandDark: "#17447a",
      brandSoft: "#9cc4f0",
      brandBg: "#e8f0f9",
      bg: "#f3f6f9",
      heroFrom: "#12263a",
      heroTo: "#1f5aa0",
      strip: "repeating-linear-gradient(90deg, #f2c94c 0 18px, #1f5aa0 18px 36px, #ffffff 36px 44px, #1f5aa0 44px 62px)",
    },
    particles: { shape: "star", motion: "fall", colors: ["#f6d65a", "#ffffff", "#9cc4f0"], count: 22, size: [8, 15] },
  },
  {
    id: "printemps",
    label: "Début du printemps",
    emoji: "🌸",
    greeting: "Bon printemps !",
    range: ["03-20", "03-26"],
    palette: {
      dark: "#18301f",
      brand: "#3f7d4e",
      brandDark: "#2f5f3b",
      brandSoft: "#a8dbb4",
      brandBg: "#ecf5ee",
      bg: "#f6f8f4",
      heroFrom: "#2f6b45",
      heroTo: "#a8406f",
      strip: "repeating-linear-gradient(90deg, #f4a6c0 0 18px, #a8dbb4 18px 36px, #fff3a8 36px 54px)",
    },
    particles: { shape: "petal", motion: "fall", colors: ["#ffc2d6", "#ffffff", "#ff9fbf"], count: 26, size: [9, 17] },
  },
  {
    id: "ete",
    label: "Début de l'été",
    emoji: "☀️",
    greeting: "Bon été !",
    range: ["06-22", "06-28"],
    palette: {
      dark: "#12323a",
      brand: "#0f7a88",
      brandDark: "#0b5c66",
      brandSoft: "#8fdbe6",
      brandBg: "#e6f5f7",
      bg: "#f6f8f6",
      heroFrom: "#0b5c66",
      heroTo: "#b4560e",
      strip: "repeating-linear-gradient(90deg, #f6c445 0 18px, #3fb6c9 18px 36px, #ffffff 36px 44px, #3fb6c9 44px 62px)",
    },
    particles: { shape: "circle", motion: "rise", colors: ["#ffe08a", "#ffd166", "#ffffff"], count: 20, size: [6, 14] },
  },
  {
    id: "automne",
    label: "Début de l'automne",
    emoji: "🍂",
    greeting: "Bon automne !",
    range: ["09-23", "09-29"],
    palette: {
      dark: "#2e1a0e",
      brand: "#a2551a",
      brandDark: "#7a3f12",
      brandSoft: "#f0b98a",
      brandBg: "#fbeee3",
      bg: "#f8f3ec",
      heroFrom: "#5a2d12",
      heroTo: "#a2551a",
      strip: "repeating-linear-gradient(90deg, #c8651a 0 18px, #e7b24a 18px 36px, #8f2f1a 36px 54px)",
    },
    particles: { shape: "leaf", motion: "fall", colors: ["#f08a24", "#d9531e", "#f2c14e", "#b8431a"], count: 24, size: [12, 22] },
  },
];

const SEASONS_BY_ID = new Map(SEASONS.map((s) => [s.id, s]));

export function getSeason(id) {
  return SEASONS_BY_ID.get(id) || null;
}

/** Valeurs possibles du réglage admin « seasonalTheme » : "auto", "off" ou l'id d'un thème. */
export function normalizeSeasonMode(value) {
  if (value === "off" || value === "auto") return value;
  return SEASONS_BY_ID.has(value) ? value : "auto";
}

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus/Jones/Butcher), en UTC. */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysISO(date, days) {
  return new Date(date.getTime() + days * 86400000).toISOString().slice(0, 10);
}

/** Message affiché pour ce thème à cette date (certains évoluent au fil de la période). */
export function seasonGreeting(season, isoDate) {
  const late = season.lateGreeting;
  if (!late) return season.greeting;
  const year = Number(isoDate.slice(0, 4));
  const since =
    late.easterOffset !== undefined ? addDaysISO(easterSunday(year), late.easterOffset) : `${year}-${late.from}`;
  return isoDate >= since ? late.text : season.greeting;
}

/** Bornes ISO [début, fin] de la période d'un thème pour une année donnée. */
export function seasonRange(season, year) {
  if (season.range) return [`${year}-${season.range[0]}`, `${year}-${season.range[1]}`];
  const easter = easterSunday(year);
  return [addDaysISO(easter, season.easter[0]), addDaysISO(easter, season.easter[1])];
}

/** Thème de la période en cours pour une date ISO (YYYY-MM-DD), ou null hors période. */
export function findSeasonForDate(isoDate) {
  const year = Number(isoDate.slice(0, 4));
  for (const season of SEASONS) {
    const [start, end] = seasonRange(season, year);
    if (isoDate >= start && isoDate <= end) return season;
  }
  return null;
}

/**
 * Thème à afficher, selon (dans l'ordre) :
 * 1. l'aperçu local d'un admin, qui prime sur tout ;
 * 2. le choix de la personne de désactiver les thèmes (jamais outrepassé, même par un thème forcé) ;
 * 3. le réglage admin : "off" (aucun thème pour personne), un thème forcé, ou "auto" (selon la date).
 */
export function resolveSeason({ isoDate, mode = "auto", userDisabled = false, previewId = null }) {
  if (previewId) return getSeason(previewId);
  if (userDisabled || mode === "off") return null;
  if (mode !== "auto") return getSeason(mode);
  return findSeasonForDate(isoDate);
}

/** "1 déc. → 25 déc." pour l'année donnée (utilisé dans l'écran d'administration). */
export function describeSeasonRange(season, year) {
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const [start, end] = seasonRange(season, year);
  const a = fmt.format(new Date(`${start}T00:00:00Z`));
  const b = fmt.format(new Date(`${end}T00:00:00Z`));
  return a === b ? a : `${a} → ${b}`;
}

/** Variables CSS posées sur <html> quand un thème est actif (et retirées sinon). */
export function seasonCssVars(season) {
  const p = season.palette;
  return {
    "--color-dark": p.dark,
    "--brand": p.brand,
    "--brand-dark": p.brandDark,
    "--brand-soft": p.brandSoft,
    "--brand-bg": p.brandBg,
    "--color-bg": p.bg,
    "--season-hero-bg": `linear-gradient(135deg, ${p.heroFrom}, ${p.heroTo})`,
    "--season-strip": p.strip || `linear-gradient(90deg, ${p.heroFrom}, ${p.heroTo})`,
  };
}
