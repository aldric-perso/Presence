import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { RequireAuth, RequireGuest, RequireAdmin } from "./components/RouteGuards";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import NewAttendancePage from "./pages/NewAttendancePage";
import TakeAttendancePage from "./pages/TakeAttendancePage";
import StudentsPage from "./pages/StudentsPage";
import SettingsPage from "./pages/SettingsPage";
import CorrectionPage from "./pages/CorrectionPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <RequireGuest>
                <LoginPage />
              </RequireGuest>
            }
          />

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/appel/nouveau" element={<NewAttendancePage />} />
            <Route path="/appel/prendre" element={<TakeAttendancePage />} />
            <Route path="/eleves" element={<StudentsPage />} />
            <Route path="/parametres" element={<SettingsPage />} />
            <Route path="/parametres/:tab" element={<SettingsPage />} />
            <Route
              path="/parametres/registre/:recordId/corriger"
              element={
                <RequireAdmin>
                  <CorrectionPage />
                </RequireAdmin>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
