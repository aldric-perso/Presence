import styles from "./Callout.module.css";

const ICONS = { warning: "⚠", danger: "⛔", success: "✓", neutral: "ℹ" };

export default function Callout({ tone = "neutral", children }) {
  return (
    <div className={[styles.callout, styles[tone]].join(" ")}>
      <span className={styles.icon}>{ICONS[tone]}</span>
      <div>{children}</div>
    </div>
  );
}
