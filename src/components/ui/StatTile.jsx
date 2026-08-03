import styles from "./StatTile.module.css";

export default function StatTile({ label, value, alert = false }) {
  return (
    <div className={styles.tile}>
      <div className={styles.label}>{label}</div>
      <div className={[styles.value, alert ? styles.alert : ""].join(" ")}>{value}</div>
    </div>
  );
}
