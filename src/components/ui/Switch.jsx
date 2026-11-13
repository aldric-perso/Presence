import styles from "./Switch.module.css";

/** Interrupteur accessible (checkbox native stylée) : `label` est lu par les lecteurs d'écran. */
export default function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <label className={[styles.switch, disabled ? styles.disabled : ""].join(" ")}>
      <input
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
