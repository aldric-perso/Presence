import styles from "./Badge.module.css";

export default function Badge({ tone = "neutral", title, children }) {
  return (
    <span className={[styles.badge, styles[tone]].join(" ")} title={title}>
      {children}
    </span>
  );
}
