import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

initializeApp();

export const auth = getAuth();
export const db = getFirestore();
export { Timestamp };
