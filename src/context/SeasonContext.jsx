import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { setSeasonalThemesDisabled } from "../lib/users";
import { todayISO } from "../lib/dates";
import { findSeasonForDate, normalizeSeasonMode, resolveSeason, seasonCssVars, seasonGreeting } from "../lib/seasons";

export const SeasonContext = createContext(null);

// Sur la page de connexion, ni le profil ni les réglages ne sont lisibles (règles Firestore) : on
// se rappelle donc, sur cet appareil, du dernier réglage admin / de la dernière préférence connus.
const CACHE_KEY = "presences:season";

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return { mode: normalizeSeasonMode(raw.mode), userDisabled: raw.userDisabled === true };
  } catch {
    return { mode: "auto", userDisabled: false };
  }
}

function writeCache(patch) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), ...patch }));
  } catch {
    // stockage indisponible (navigation privée…) : tant pis, ce n'est qu'un confort
  }
}

/** Date du jour, rafraîchie au changement de jour (appli laissée ouverte toute la nuit). */
function useToday() {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const id = setInterval(() => setToday((prev) => (todayISO() !== prev ? todayISO() : prev)), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

export function SeasonProvider({ children }) {
  const { profile } = useAuth();
  const today = useToday();
  const [cache] = useState(readCache);
  const [mode, setMode] = useState(cache.mode);
  const [previewId, setPreviewId] = useState(null);

  // Réglage admin (settings/general.seasonalTheme), uniquement une fois le profil chargé.
  const signedIn = !!profile;
  useEffect(() => {
    if (!signedIn) return;
    return onSnapshot(
      doc(db, "settings", "general"),
      (snap) => {
        const next = normalizeSeasonMode(snap.exists() ? snap.data().seasonalTheme : "auto");
        setMode(next);
        writeCache({ mode: next });
      },
      () => {},
    );
  }, [signedIn]);

  // Après une déconnexion, on garde la dernière préférence connue pour l'écran de connexion.
  const [lastDisabled, setLastDisabled] = useState(cache.userDisabled);
  const userDisabled = profile ? profile.seasonalThemesDisabled === true : lastDisabled;
  useEffect(() => {
    if (!profile) return;
    const disabled = profile.seasonalThemesDisabled === true;
    setLastDisabled(disabled);
    writeCache({ userDisabled: disabled });
  }, [profile]);

  const season = useMemo(() => {
    const resolved = resolveSeason({ isoDate: today, mode, userDisabled, previewId });
    return resolved && { ...resolved, greeting: seasonGreeting(resolved, today) };
  }, [today, mode, userDisabled, previewId]);

  // Pose le thème sur <html> : data-season (pour d'éventuels styles ciblés) + variables de palette.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!season) return;
    const vars = seasonCssVars(season);
    root.dataset.season = season.id;
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => {
      delete root.dataset.season;
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [season]);

  const setUserDisabled = useCallback(
    async (disabled) => {
      if (!profile) return;
      writeCache({ userDisabled: disabled });
      await setSeasonalThemesDisabled(profile.id, disabled);
    },
    [profile],
  );

  const value = useMemo(
    () => ({
      season,
      mode,
      userDisabled,
      setUserDisabled,
      previewId,
      setPreviewId,
      autoSeason: findSeasonForDate(today),
    }),
    [season, mode, userDisabled, setUserDisabled, previewId, today],
  );

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason() {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error("useSeason doit être utilisé dans un SeasonProvider");
  return ctx;
}
