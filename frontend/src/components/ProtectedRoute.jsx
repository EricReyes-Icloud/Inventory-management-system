import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { verifyAdminSession } from "../api.js";
import { runSessionCheck, sessionErrorMessage } from "../sessionCheck.js";

// Waits for Firebase Auth to finish restoring the session, then verifies the
// fresh ID token against the backend before rendering the protected tree.
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [state, setState] = useState({ status: "checking" });

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const result = await runSessionCheck({
        getToken: () => (user ? user.getIdToken() : Promise.resolve(null)),
        verify: verifyAdminSession,
      });
      if (!active) return;
      setState(
        result.ok
          ? { status: "allowed", admin: result.admin }
          : { status: "denied", reason: result.reason }
      );
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (state.status === "checking") {
    return (
      <main>
        <p role="status">Verificando sesión…</p>
      </main>
    );
  }

  if (state.status === "denied") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          sessionMessage: sessionErrorMessage(state.reason),
        }}
      />
    );
  }

  return children ?? <Outlet />;
}
