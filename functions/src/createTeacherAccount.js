import crypto from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "./admin.js";
import { assertAdmin } from "./guards.js";

export const createTeacherAccount = onCall({ region: "europe-west1" }, async (request) => {
  assertAdmin(request);

  const { displayName, email, role, classIds = [], subjectIds = [] } = request.data || {};

  if (!displayName?.trim() || !email?.trim()) {
    throw new HttpsError("invalid-argument", "Le nom et l'adresse e-mail sont obligatoires.");
  }
  if (role !== "admin" && role !== "teacher") {
    throw new HttpsError("invalid-argument", "Rôle invalide.");
  }

  const temporaryPassword = crypto.randomBytes(24).toString("base64url");

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: email.trim(),
      password: temporaryPassword,
      displayName: displayName.trim(),
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Un compte existe déjà avec cette adresse e-mail.");
    }
    throw new HttpsError("internal", "La création du compte a échoué.");
  }

  await auth.setCustomUserClaims(userRecord.uid, { role });

  await db.collection("users").doc(userRecord.uid).set({
    displayName: displayName.trim(),
    email: email.trim(),
    role,
    classIds,
    subjectIds,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  const resetLink = await auth.generatePasswordResetLink(email.trim());

  return { uid: userRecord.uid, resetLink };
});
