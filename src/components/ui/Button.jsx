import styles from "./Button.module.css";

const VARIANT_CLASS = {
  primary: styles.primary,
  ghost: styles.ghost,
  subtle: styles.subtle,
  danger: styles.danger,
};

const SIZE_CLASS = {
  md: "",
  sm: styles.sm,
  xs: styles.xs,
};

export default function Button({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
  as: As = "button",
  ...props
}) {
  const classes = [
    styles.btn,
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    full ? styles.full : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <As className={classes} {...props} />;
}
