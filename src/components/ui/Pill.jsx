import styles from "./Pill.module.css";

const TONE_CLASS = {
  dark: styles.toneDark,
  green: styles.toneGreen,
  amber: styles.toneAmber,
  red: styles.toneRed,
};

export function Pill({
  active = false,
  tone = "dark",
  size = "md",
  className = "",
  ...props
}) {
  const classes = [
    styles.pill,
    TONE_CLASS[tone],
    active ? styles.active : "",
    size === "sm" ? styles.sm : "",
    size === "xs" ? styles.xs : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button type="button" className={classes} {...props} />;
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <div className={styles.segmentWrap}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={[
            styles.segmentBtn,
            value === opt.value ? styles.active : "",
          ].join(" ")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
