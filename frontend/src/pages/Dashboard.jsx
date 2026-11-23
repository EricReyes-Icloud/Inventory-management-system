import { useLocation } from "react-router-dom";

// Placeholder destination after login. T5 wraps the protected routes.
export default function DashboardPage() {
  const location = useLocation();
  const passwordChangeRequired = Boolean(
    location.state && location.state.passwordChangeRequired
  );

  return (
    <main>
      <h1>Panel</h1>
      {passwordChangeRequired && (
        <p className="login-notice" role="status">
          Su contraseña es temporal. Solicite el cambio de contraseña al
          administrador.
        </p>
      )}
      <p>Dashboard — pending T5</p>
    </main>
  );
}
