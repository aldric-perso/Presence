import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function FullScreenLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "var(--color-muted)",
        fontSize: 14,
      }}
    >
      Chargement…
    </div>
  );
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function RequireGuest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!isAdmin) return <Navigate to="/parametres" replace />;
  return children;
}
