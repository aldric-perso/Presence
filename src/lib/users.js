import { useMemo } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "./useCollection";
import { normalize, squeezeSpaces } from "./ids";

const usersRef = collection(db, "users");
const invitationsRef = collection(db, "invitations");

export function useTeachers() {
  const q = useMemo(() => query(usersRef, orderBy("displayName")), []);
  return useCollection(q);
}

export function useInvitations() {
  const q = useMemo(() => query(invitationsRef, orderBy("displayName")), []);
  return useCollection(q);
}

export function findDuplicateTeacher(teachers, displayName) {
  const key = normalize(displayName);
  return teachers.find((t) => normalize(t.displayName) === key) || null;
}

function invitationId(email) {
  return email.trim().toLowerCase();
}

/**
 * Invite une personne par e-mail : aucun compte Authentication n'est créé et aucun mail n'est
 * envoyé — la personne réclame elle-même cette invitation en se connectant avec "Se connecter
 * avec Google" en utilisant cette adresse (cf. claimInvitation). Ça évite complètement le
 * problème de délivrabilité des e-mails Firebase Auth (plus besoin d'exiger une adresse Gmail).
 */
export async function createTeacherInvitation({ displayName, email, role, classIds = [], subjectIds = [] }) {
  await setDoc(doc(db, "invitations", invitationId(email)), {
    displayName: squeezeSpaces(displayName),
    email: email.trim(),
    role,
    classIds,
    subjectIds,
    createdAt: serverTimestamp(),
  });
}

export async function cancelInvitation(id) {
  await deleteDoc(doc(db, "invitations", id));
}

/**
 * Appelée juste après une première connexion Google sans profil users/{uid} : cherche une
 * invitation à l'adresse e-mail du compte connecté et, si elle existe, crée le profil à partir de
 * ses données puis supprime l'invitation. Retourne true si une invitation a été réclamée.
 */
export async function claimInvitation(user) {
  if (!user.email) return false;
  const invRef = doc(db, "invitations", invitationId(user.email));
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) return false;
  const inv = invSnap.data();

  await setDoc(doc(db, "users", user.uid), {
    displayName: inv.displayName,
    email: inv.email,
    role: inv.role,
    classIds: inv.classIds || [],
    subjectIds: inv.subjectIds || [],
    active: true,
    createdAt: serverTimestamp(),
  });

  await deleteDoc(invRef).catch(() => {});
  return true;
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
