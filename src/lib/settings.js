import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, DEFAULT_SEUIL } from "../firebase";

const settingsDoc = doc(db, "settings", "general");

export function useSettings() {
  const [settings, setSettings] = useState({ presenceThreshold: DEFAULT_SEUIL });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(settingsDoc, (snap) => {
      setSettings(snap.exists() ? snap.data() : { presenceThreshold: DEFAULT_SEUIL });
      setLoading(false);
    });
  }, []);

  return { settings, loading };
}

export async function setPresenceThreshold(value) {
  await setDoc(settingsDoc, { presenceThreshold: value }, { merge: true });
}
