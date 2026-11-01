import { normalize } from "./ids";

/**
 * Valeurs de départ de l'onglet « Paramètres » de l'export Excel, reprises du fichier modèle
 * « Temps scolaire élèves 2026-2027 » : pour chaque classe et chaque matière, les heures
 * hebdomadaires de scolarité ordinaire (colonne B de l'export) et celles prévues pour un élève
 * en UE (colonne C). Elles ne servent que de point de départ — tout est modifiable dans Excel.
 */
const DEFAULTS = {
  6: {
    arts: [1, 1], musique: [1, 0], eps: [4, 3], francais: [4.5, 4], histgeo: [3, 4], lv1: [4, 3],
    maths: [4.5, 4], physique: [1.5, 0], svt: [1.5, 0], soutien: [1, 0],
  },
  5: {
    arts: [1, 1], musique: [1, 0], eps: [3, 2], francais: [4.5, 4], histgeo: [3, 4], lv1: [3, 3],
    lv2: [2.5, 0], maths: [3.5, 4.25], physique: [1.5, 0], svt: [1.5, 0], techno: [1.5, 0],
  },
  4: {
    accompagnement: [0, 0], arts: [1, 1], musique: [1, 0], eps: [3, 2], francais: [4.5, 4],
    histgeo: [3, 4], lv1: [3, 3], lv2: [2.5, 1], maths: [3.5, 4], physique: [1.5, 0], svt: [1.5, 0],
    techno: [1.5, 0],
  },
  3: {
    arts: [1, 1], musique: [1, 0], eps: [3, 2], francais: [4, 4.25], histgeo: [3.5, 4], lv1: [3, 3],
    lv2: [2.5, 1], maths: [3.5, 3], apmaths: [0, 1], physique: [1.5, 0], svt: [1.5, 0], techno: [1.5, 0],
  },
  UIS: {
    arts: [1, 0.75], musique: [1, 0], eps: [3, 0.5], francais: [4.5, 3], histgeo: [3, 2], lv1: [3, 1.5],
    lv2: [2.5, 0], maths: [3.5, 3], physique: [1.5, 0], quotidien: [1.5, 0], techno: [1.5, 1.5],
  },
};

/** "6ème", "6e", "6IEME" → "6" ; "UIS" → "UIS" ; autre nom de classe → null. */
function classKey(className) {
  const n = normalize(className);
  const grade = n.match(/^([3-6])/);
  if (grade) return grade[1];
  if (n.includes("uis")) return "UIS";
  return null;
}

/** Les noms de matières sont libres : on les rattache à une clé par mots-clés, sans tenir compte des accents. */
const SUBJECT_PATTERNS = [
  ["apmaths", /^ap.*math/],
  ["accompagnement", /accompagnement/],
  ["soutien", /soutien/],
  ["arts", /artsplast/],
  ["musique", /musi/],
  ["eps", /^eps|sport/],
  ["francais", /francais/],
  ["histgeo", /hist/],
  ["lv1", /lv1|anglais/],
  ["lv2", /lv2|espagnol/],
  ["maths", /math/],
  ["physique", /physique/],
  ["svt", /svt|science|vieetdelaterre/],
  ["techno", /techno/],
  ["quotidien", /quotidien/],
];

function subjectKey(subjectName) {
  const n = normalize(subjectName);
  return SUBJECT_PATTERNS.find(([, re]) => re.test(n))?.[0] ?? null;
}

/** Heures de départ { ordinary, ue } pour une classe et une matière ; 0/0 si le modèle n'en a pas. */
export function defaultReferenceHours(className, subjectName) {
  const [ordinary, ue] = DEFAULTS[classKey(className)]?.[subjectKey(subjectName)] ?? [0, 0];
  return { ordinary, ue };
}
