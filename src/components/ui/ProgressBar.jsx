import styles from "./ProgressBar.module.css";

export default function ProgressBar({ pct, color, size = "md" }) {
  return (
    <div className={[styles.track, size === "sm" ? styles.sm : ""].join(" ")}>
      <div
        className={styles.fill}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  );
}
