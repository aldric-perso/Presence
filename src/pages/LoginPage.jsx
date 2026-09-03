import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "../firebase";
import Button from "../components/ui/Button";
import Callout from "../components/ui/Callout";
import { Field, TextInput } from "../components/ui/Field";
import styles from "./LoginPage.module.css";

const ERROR_MESSAGES = {
  "auth/invalid-credential": "Identifiant ou mot de passe incorrect.",
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/user-disabled": "Ce compte a été désactivé. Contacte un administrateur.",
  "auth/too-many-requests": "Trop de tentatives. Réessaie dans quelques minutes.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("presences:no-access")) {
      sessionStorage.removeItem("presences:no-access");
      setError("Ce compte n'a pas (ou plus) accès à l'application. Contacte un administrateur.");
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || "La connexion a échoué. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        // La personne a juste fermé la fenêtre Google : rien à afficher.
      } else if (err.code === "auth/account-exists-with-different-credential") {
        setError("Un compte existe déjà avec cette adresse via mot de passe : connecte-toi avec ton mot de passe ci-dessous.");
      } else {
        setError("La connexion avec Google a échoué. Réessaie.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Renseigne ton adresse e-mail ci-dessus pour recevoir un lien de réinitialisation.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("E-mail de réinitialisation envoyé si un compte existe avec cette adresse.");
    } catch {
      setInfo("E-mail de réinitialisation envoyé si un compte existe avec cette adresse.");
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>P</div>
          <span className={styles.brandName}>Présences</span>
        </div>
        <div>
          <div className={styles.title}>Cahier d'appel</div>
          <p className={styles.tagline}>
            Le suivi de présence des élèves, classe par classe, séance par séance.
          </p>
        </div>
        <div className={styles.footNote}>Collège de l'Unité d'enseignement Jean Chevrier</div>
      </div>

      <div className={styles.formSide}>
        <form className={styles.formBox} onSubmit={handleSubmit}>
          <div className="eyebrow">Connexion enseignant</div>
          <h1 className={styles.formTitle}>Identifie-toi</h1>

          <Button
            type="button"
            variant="ghost"
            full
            disabled={submitting}
            onClick={handleGoogleSignIn}
            style={{ marginBottom: 18 }}
          >
            Se connecter avec Google
          </Button>

          <div className={styles.formGroup}>
            <Field label="Adresse e-mail">
              <TextInput
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@etablissement.fr"
              />
            </Field>
            <Field label="Mot de passe">
              <TextInput
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <button type="button" className={styles.forgot} onClick={handleForgotPassword}>
              Mot de passe oublié ?
            </button>
          </div>

          {error && <Callout tone="danger">{error}</Callout>}
          {info && <Callout tone="success">{info}</Callout>}

          <Button type="submit" full disabled={submitting} style={{ marginTop: 20 }}>
            {submitting ? "Connexion…" : "Entrer"}
          </Button>

          <p className={styles.helpText}>
            Si tu n'as pas encore de compte, demande à un admin de t'inviter — tu pourras ensuite
            te connecter avec Google en utilisant la même adresse.
          </p>
        </form>
      </div>
    </div>
  );
}
