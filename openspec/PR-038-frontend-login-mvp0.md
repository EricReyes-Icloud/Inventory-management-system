# PR-038: Frontend login MVP0 with Firebase Auth and protected routes

## Description

This pull request introduces the MVP0 frontend for Condimentos El Colibrí: a React + Vite PWA scaffold with Firebase client authentication, a login screen, and route protection backed by server-side verification. The goal is to allow authorized administrators to sign in through Firebase Auth and reach a protected area while the backend enforces access with ID token verification against Firestore admin records.

The change addresses the gap between existing backend admin authentication (`adminAuth`) and a usable client: there was no frontend application, no login flow, and no read-only endpoint to validate an authenticated admin session from the browser after sign-in. Without this, operators could not start using the MVP0 web flow and the system lacked a consistent pattern for guarding protected UI routes with backend confirmation.

The approach seeds or expects the three admin Firestore documents (`Usuarios/Usuarios/Admin`, `Usuarios/Usuarios/Admin_2`, `Usuarios/Usuarios/Admin_3`) to align with Firebase Auth identities, adds a rate-limited login exchange endpoint and a read-only session check endpoint, then implements a frontend flow that signs in with the Firebase Web SDK, exchanges the ID token with the backend, and uses `ProtectedRoute` with `onAuthStateChanged` plus `GET /api/auth/me` verification before rendering protected content.

## Changes Made

### Backend (authentication and authorization)

- `backend/scripts/seed-admins.js`: added an idempotent seed script to create missing Firebase Auth users for the three admin documents, print one-time passwords only at creation time, and flag Firestore documents with `passwordChangeRequired: true` (with dry-run support).
- `backend/src/services/auth.service.js`: added login exchange logic that verifies Firebase ID tokens, resolves admin records across the three admin collections, and enforces allowed states (including `passwordChangeRequired` handling as defined in the service).
- `backend/src/repositories/admin.repository.js`: added lookup across `Usuarios/Usuarios/Admin`, `Usuarios/Usuarios/Admin_2`, and `Usuarios/Usuarios/Admin_3` for admin resolution by email.
- `backend/src/middlewares/adminAuth.js`: widened admin lookup to use the shared multi-collection resolution and tightened behavior for protected API access.
- `backend/src/routes/auth.js`: added `POST /api/auth/login` (rate-limited) and `GET /api/auth/me` (behind `adminAuth`) returning the non-secret admin profile for session verification.
- `backend/tests/integration/admin.routes.test.ts`: updated mocks/integration coverage for multi-collection admin lookup and the new session check route.
- `backend/tests/probes/adminAuth.me.probe.test.ts`: added HTTP probes for `GET /api/auth/me` behavior.

### Frontend (scaffold, login, and protected routes)

- `frontend/` (scaffold): added a React + Vite PWA shell (`index.html`, `vite.config.js`, `package.json`, `public/manifest.json`, `public/sw.js`, `src/main.jsx`, `src/App.jsx`, `src/index.css`, `src/App.css`) as the base client application.
- `frontend/src/firebase.js`: initialized the Firebase Web client SDK from environment configuration.
- `frontend/src/config.js`: added helpers to read Vite Firebase env vars and the backend API base URL (`VITE_API_BASE_URL`, default `http://localhost:4000`).
- `frontend/src/api.js`: added `loginWithIdToken` (`POST /api/auth/login`) and `verifyAdminSession` (`GET /api/auth/me` with Bearer token), keeping transport separate from Firebase Auth calls.
- `frontend/src/loginFlow.js`: added the sign-in flow (Firebase `signInWithEmailAndPassword` + token exchange) and `describeLoginError` mapping for user-facing messages.
- `frontend/src/pages/Login.jsx`: added the login page UI (email/password form, loading/error states, session notice support).
- `frontend/src/sessionCheck.js`: added pure session verification logic (`runSessionCheck`) mapping token/backend results to guard reasons and messages.
- `frontend/src/components/ProtectedRoute.jsx`: added a route guard that waits for Firebase auth restoration, verifies a fresh ID token via the backend, and redirects to `/login` with a session message when denied; allows access when verified.
- `frontend/src/pages/Dashboard.jsx`: added a minimal protected dashboard placeholder.
- Frontend tests/probes: added `src/loginFlow.test.js`, `src/loginFlow.nonbrowser.test.js`, `src/sessionCheck.test.js`, `src/api.me.probes.test.js`, `src/protectedRoute.probes.test.js`, `src/scaffold.probes.test.js` (and related test wiring) to cover login flow, session checks, and scaffold/API probe behavior.

### Documentation and planning artifacts

- `odd/tasks/frontend-login-mvp0.md`: added the ODD feature document for frontend login MVP0 (tasks, specs, and log entries through the recorded milestones).

## Impact

- Users: administrators can sign in through the frontend login screen; unauthenticated access to protected routes redirects to `/login`. Session validity is confirmed against the backend using a fresh ID token rather than trusting client state alone.
- Backend: new public/auth-related HTTP surface (`POST /api/auth/login`, `GET /api/auth/me`) with rate limiting on login and existing `adminAuth` protection on the session check route. Admin resolution accepts records in `Admin`, `Admin_2`, or `Admin_3` under `Usuarios/Usuarios`.
- Compatibility and operations: Firebase client configuration must be provided via Vite env vars (`VITE_FIREBASE_*`) and `VITE_API_BASE_URL` as needed; backend CORS must allow the frontend origin. Seeding (`backend/scripts/seed-admins.js`) is a manual operational step when creating or repairing admin Auth users and flags.
- Risks and caveats: client-side behavior depends on correct Firebase Web config and network reachability to both Firebase and the backend API. Some login failure modes are intentionally mapped to generic messages to avoid leaking account enumeration details. Full independent verification for all frontend/backend changes in this feature may remain pending depending on environment capacity (see Notes).

## Notes

- Recommended local verification (adjust commands to the repository scripts): run backend and frontend dev servers, configure `frontend/.env.local` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, optional `VITE_API_BASE_URL`) and backend CORS/origin settings, then confirm redirect to `/login` when unauthenticated and successful login for a seeded admin.
- Admin credentials are not stored in the repository; one-time passwords from `seed-admins.js` are printed only at creation time. Password resets must be handled via Firebase Console or an approved operational process.
- Known follow-up (from feature notes): align frontend origin/CORS across environments, complete any pending independent verification when tooling/model capacity is available, and decide whether to commit or ignore local-only artifacts under `docs/frontend/` and related tooling caches if they appear in a working tree.
