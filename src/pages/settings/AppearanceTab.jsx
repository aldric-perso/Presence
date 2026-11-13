import { useState } from "react";
import { useSeason } from "../../context/SeasonContext";
import { SEASONS, describeSeasonRange } from "../../lib/seasons";
import { updateSettings } from "../../lib/settings";
import { Field, Select } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import styles from "./Shared.module.css";
import local from "./AppearanceTab.module.css";

export default function AppearanceTab({ isAdmin }) {
  const { mode, autoSeason, previewId, setPreviewId } = useSeason();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const year = new Date().getFullYear();

  async function handleModeChange(e) {
    setError("");
    setSaved(false);
    try {
      await updateSettings({ seasonalTheme: e.target.value });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Impossible d'enregistrer ce réglage. Réessaie.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className={["card", styles.formCard].join(" ")} style={{ margin: 0 }}>
        <div className={styles.formTitle}>Thèmes saisonniers</div>
        <p className={styles.formHint}>
          Couleurs et décors qui changent selon la période de l'année. Chaque personne peut aussi les
          désactiver pour elle-même (carte de profil, en haut de cette page) : ce choix passe avant
          un thème forcé ici.
        </p>
        <div style={{ maxWidth: 380 }}>
          <Field label="Affichage pour tout le monde">
            <Select value={mode} onChange={handleModeChange} disabled={!isAdmin}>
              <option value="auto">Automatique (selon la date)</option>
              <option value="off">Désactivés pour tout le monde</option>
              <optgroup label="Forcer un thème pour tout le monde">
                {SEASONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.emoji} {s.label}
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
        </div>
        {saved && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-green)", fontWeight: 600 }}>
            Réglage enregistré.
          </p>
        )}
        {error && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-red)", fontWeight: 600 }}>{error}</p>
        )}
        {!isAdmin && (
          <p className={styles.formHint} style={{ marginTop: 12, marginBottom: 0 }}>
            Seuls les administrateurs peuvent modifier ce réglage.
          </p>
        )}
      </div>

      <div className={["card", styles.formCard].join(" ")} style={{ margin: 0 }}>
        <div className={styles.formTitle}>Calendrier des thèmes</div>
        <p className={styles.formHint}>
          Hors de ces périodes, l'application garde son design habituel. « Aperçu » n'affecte que ton
          écran, jusqu'à ce que tu quittes l'aperçu ou recharges la page.
        </p>
        <div className={local.grid}>
          {SEASONS.map((s) => (
            <div key={s.id} className={local.item}>
              <div
                className={local.swatch}
                style={{ background: `linear-gradient(135deg, ${s.palette.heroFrom}, ${s.palette.heroTo})` }}
                aria-hidden="true"
              >
                {s.emoji}
              </div>
              <div className={local.meta}>
                <div className={local.name}>
                  {s.label}
                  {autoSeason?.id === s.id && (
                    <span style={{ marginLeft: 8 }}>
                      <Badge tone="green">En cours</Badge>
                    </span>
                  )}
                </div>
                <div className={local.dates}>{describeSeasonRange(s, year)}</div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setPreviewId(previewId === s.id ? null : s.id)}
              >
                {previewId === s.id ? "Quitter" : "Aperçu"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
