import { onCall, HttpsError } from "firebase-functions/v2/https";
import { auth, db } from "./admin.js";
import { assertAdmin } from "./guards.js";

export const setUserRole = onCall({ region: "europe-west1" }, async (request) => {
  assertAdmin(request);

  const { uid, role } = request.data || {};
  if (!uid || (role !== "admin" && role !== "teacher")) {
    throw new HttpsError("invalid-argument", "Paramètres invalides.");
  }

  if (role === "teacher") {
    const admins = await db.collection("users").where("role", "==", "admin").get();
    const isLastAdmin = admins.size === 1 && admins.docs[0].id === uid;
    if (isLastAdmin) {
      throw new HttpsError(
        "failed-precondition",
        "Impossible de retirer le dernier compte administrateur.",
      );
    }
  }

  await auth.setCustomUserClaims(uid, { role });
  await db.collection("users").doc(uid).update({ role });

  return { uid, role };
});
