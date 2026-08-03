import Button from "./Button";
import styles from "./Modal.module.css";

export default function Modal({
  kicker,
  title,
  text,
  detail,
  confirmLabel,
  cancelLabel = "Fermer",
  onConfirm,
  onCancel,
  danger = false,
  confirmDisabled = false,
}) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.dialog}>
        {kicker && <div className={styles.kicker}>{kicker}</div>}
        <h2 className={styles.title}>{title}</h2>
        {text && <p className={styles.text}>{text}</p>}
        {detail && <div className={styles.detail}>{detail}</div>}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {onConfirm && (
            <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={confirmDisabled}>
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
