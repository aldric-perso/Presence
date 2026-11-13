// Vérifie le contraste (WCAG) des palettes saisonnières : `node scripts/check-season-contrast.mjs`
// Sort avec un code d'erreur si une paire de couleurs passe sous son seuil.
import { SEASONS, seasonRange, findSeasonForDate } from "../src/lib/seasons.js";

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const INK = "#1b1d1f";
const LIGHT = "#f6f4f0"; // texte clair sur fond sombre (--color-bg par défaut)
let failures = 0;

for (const s of SEASONS) {
  const p = s.palette;
  const checks = [
    ["texte blanc sur brand (avatar, pastille)", "#ffffff", p.brand, 4.5],
    ["brand sur fond de page (liens)", p.brand, p.bg, 4.5],
    ["brandDark sur fond de page (liens survolés)", p.brandDark, p.bg, 4.5],
    ["texte du site sur fond de page", INK, p.bg, 12],
    ["texte clair sur dark (menu, boutons)", LIGHT, p.dark, 12],
    ["brandSoft sur dark (nav mobile active)", p.brandSoft, p.dark, 4.5],
    ["texte blanc sur début du bandeau", "#ffffff", p.heroFrom, 4.5],
    ["texte blanc sur fin du bandeau", "#ffffff", p.heroTo, 4.5],
  ];
  for (const [label, fg, bg, min] of checks) {
    const r = ratio(fg, bg);
    if (r < min) {
      failures++;
      console.log(`✗ ${s.id.padEnd(17)} ${label}: ${r.toFixed(2)} (min ${min})`);
    }
  }
}

// Chevauchements : on liste, pour information, les années où deux périodes se recouvrent.
const overlaps = new Set();
for (let year = 2026; year <= 2040; year++) {
  const ranges = SEASONS.map((s) => [s.id, ...seasonRange(s, year)]);
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const [a, a0, a1] = ranges[i];
      const [b, b0, b1] = ranges[j];
      if (a0 <= b1 && b0 <= a1) overlaps.add(`${a} / ${b} (ex. ${year})`);
    }
  }
}
if (overlaps.size) console.log("Chevauchements (le premier de la liste l'emporte) :", [...overlaps].join(", "));

console.log("Pâques 2027 →", seasonRange(SEASONS.find((s) => s.id === "paques"), 2027).join(" au "));
console.log("Aujourd'hui :", findSeasonForDate(new Date().toISOString().slice(0, 10))?.id ?? "aucun thème");
console.log(failures ? `\n${failures} contraste(s) insuffisant(s)` : "\nTous les contrastes sont suffisants ✓");
process.exit(failures ? 1 : 0);
