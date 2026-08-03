import { HttpsError } from "firebase-functions/v2/https";

export function assertAuthenticated(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tu dois être connecté pour effectuer cette action.");
  }
  return request.auth;
}

export function assertAdmin(request) {
  const auth = assertAuthenticated(request);
  if (auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Cette action est réservée aux administrateurs.");
  }
  return auth;
}
