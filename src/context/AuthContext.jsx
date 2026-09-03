import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { claimInvitation } from "../lib/users";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = pas encore résolu
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setProfileLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let unsubscribe = () => {};
    setProfileLoading(true);

    function subscribe() {
      unsubscribe = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
          setProfileLoading(false);
        },
        async (err) => {
          // Un profil désactivé, ou pas encore réclamé (cf. hasProfile() dans firestore.rules),
          // rend ce document illisible par son propre titulaire. Avant de conclure à un accès
          // refusé, on tente de réclamer une invitation en attente à cette adresse (première
          // connexion Google) : si ça réussit, le profil vient d'être créé, on se réabonne pour
          // le lire normalement plutôt que de déconnecter la personne qu'on vient d'autoriser.
          if (err.code !== "permission-denied") {
            setProfileLoading(false);
            return;
          }
          const claimed = await claimInvitation(user).catch(() => false);
          if (cancelled) return;
          if (claimed) {
            subscribe();
            return;
          }
          setProfileLoading(false);
          sessionStorage.setItem("presences:no-access", "1");
          firebaseSignOut(auth);
        },
      );
    }

    subscribe();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading: user === undefined || (!!user && profileLoading),
      isAdmin: profile?.role === "admin",
      signOut: () => firebaseSignOut(auth),
    }),
    [user, profile, profileLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
