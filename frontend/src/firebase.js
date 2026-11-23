// Firebase Web SDK initialization. Email/password sign-in happens here, in the
// browser; the backend only verifies the resulting ID token (see S2).
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirebaseConfig } from "./config.js";

const config = getFirebaseConfig(import.meta.env);

// Reuse the app on hot reload instead of initializing a second instance.
const app = getApps().length ? getApp() : initializeApp(config);

export const auth = getAuth(app);
export default app;
