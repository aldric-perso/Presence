import { useMemo } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { app, db } from "../firebase";
import { useCollection } from "./useCollection";
import { normalize, squeezeSpaces } from "./ids";

const usersRef = collection(db, "users");

export function useTeachers() {
  const q = useMemo(() => query(usersRef, orderBy("displayName")), []);
  return useCollection(q);
}

export function findDuplicateTeacher(teachers, displayName) {
  const key = normalize(displayName);
  return teachers.find((t) => normalize(t.displayName) === key) || null;
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
}

/**
 * Crée le compte Auth + le profil Firestore, et envoie un e-mail de réinitialisation de mot de
 * passe (gratuit, géré nativement par Firebase Auth). Utilise une instance Firebase secondaire
 * pour que la création du compte ne déconnecte pas l'administrateur en cours de session — aucune
 * Cloud Function n'est nécessaire (compatible plan Spark gratuit).
 */
export async function createTeacherAccount({ displayName, email, role, classIds = [], subjectIds = [] }) {
  const secondaryApp = initializeApp(app.options, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), randomPassword());

    await setDoc(doc(db, "users", credential.user.uid), {
      displayName: squeezeSpaces(displayName),
      email: email.trim(),
      role,
      classIds,
      subjectIds,
      active: true,
      createdAt: serverTimestamp(),
    });

    await sendPasswordResetEmail(secondaryAuth, email.trim());

    return { uid: credential.user.uid };
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp);
  }
}

/**
 * Sans Cloud Function, la protection du dernier administrateur n'est qu'un garde-fou côté client
 * (pas une garantie de sécurité au niveau des règles, qui ne peuvent pas compter des documents).
 */
export async function setUserRole(uid, role) {
  if (role === "teacher") {
    const admins = await getDocs(query(usersRef, where("role", "==", "admin")));
    const isLastAdmin = admins.size === 1 && admins.docs[0].id === uid;
    if (isLastAdmin) {
      throw Object.assign(new Error("Impossible de retirer le dernier compte administrateur."), {
        code: "failed-precondition",
      });
    }
  }
  await updateDoc(doc(db, "users", uid), { role });
}

export async function updateTeacherAssignments(uid, { classIds, subjectIds }) {
  await updateDoc(doc(db, "users", uid), { classIds, subjectIds });
}

/**
 * Désactive/réactive un compte : une fois désactivé, la personne garde son compte Authentication
 * et son nom reste attaché à ses appels passés (authorName y est recopié tel quel), mais elle perd
 * tout accès à l'appli — les règles Firestore traitent un profil désactivé comme un profil absent
 * (cf. hasProfile() dans firestore.rules). Aucun besoin de désactiver le compte Authentication
 * lui-même (ce qui exigerait l'Admin SDK, donc une Cloud Function).
 */
export async function setTeacherActive(uid, active) {
  if (!active) {
    const admins = await getDocs(query(usersRef, where("role", "==", "admin")));
    const isLastAdmin = admins.size === 1 && admins.docs[0].id === uid;
    if (isLastAdmin) {
      throw Object.assign(new Error("Impossible de désactiver le dernier compte administrateur."), {
        code: "failed-precondition",
      });
    }
  }
  await updateDoc(doc(db, "users", uid), { active });
}
