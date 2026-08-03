import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";

const root = createRoot(document.getElementById("root"));

// Import dynamique : si la config Firebase est absente/invalide, firebase.js lève une erreur dès
// son évaluation. Un import statique planterait avant qu'aucun code React n'ait pu s'exécuter et
// laisserait une page blanche muette ; l'import dynamique transforme cette erreur en Promise
// rejetée, qu'on peut rattraper pour afficher un message exploitable.
import("./App.jsx")
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error) => {
    console.error(error);
    root.render(<ConfigErrorScreen error={error} />);
  });

function ConfigErrorScreen({ error }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        fontFamily: "system-ui, sans-serif",
        background: "#F6F4F0",
        color: "#1B1D1F",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#A8402F", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Configuration Firebase manquante ou invalide
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 12 }}>
          L'application n'a pas pu s'initialiser. Vérifie que le fichier <code>.env.local</code>
          existe à la racine du projet et contient les valeurs de configuration de ton projet
          Firebase (voir <code>.env.example</code> et le README).
        </p>
        <pre
          style={{
            marginTop: 16,
            padding: 14,
            background: "#fff",
            border: "1px solid rgba(27,29,31,0.1)",
            borderRadius: 10,
            fontSize: 12,
            overflowX: "auto",
          }}
        >
          {error?.message || String(error)}
        </pre>
      </div>
    </div>
  );
}
