import styles from "./Field.module.css";

export function Field({ label, required = false, hint, children }) {
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label}>
          {label} {required && <span className={styles.required}>obligatoire</span>}
        </label>
      )}
      {hint && <p className={styles.hint}>{hint}</p>}
      {children}
    </div>
  );
}

export function TextInput(props) {
  return <input className={styles.input} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className={styles.select} {...props}>
      {children}
    </select>
  );
}
