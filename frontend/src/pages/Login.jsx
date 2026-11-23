import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase.js";
import { loginWithIdToken } from "../api.js";
import { describeLoginError, runLogin } from "../loginFlow.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionMessage = location.state && location.state.sessionMessage;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await runLogin({
        email: email.trim(),
        password,
        auth,
        signIn: signInWithEmailAndPassword,
        exchange: loginWithIdToken,
      });
      // MVP0 has no password-change screen: carry the flag to the destination
      // instead of blocking a valid login.
      navigate("/", {
        replace: true,
        state: {
          passwordChangeRequired: Boolean(
            result && result.passwordChangeRequired
          ),
        },
      });
    } catch (loginError) {
      setError(describeLoginError(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Iniciar sesión</h1>
        <p className="login-subtitle">Condimentos El Colibrí</p>

        {sessionMessage && (
          <p className="login-notice" role="status">
            {sessionMessage}
          </p>
        )}

        <div className="login-field">
          <label htmlFor="login-email">Correo electrónico</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
          />
        </div>

        <div className="login-field">
          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
        </div>

        {error && (
          <p className="login-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
