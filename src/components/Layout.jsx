import { Outlet } from "react-router-dom";
import Nav from "./Nav";
import styles from "./Layout.module.css";

export default function Layout() {
  return (
    <div className={styles.shell} style={{ background: "var(--color-bg)" }}>
      <Nav />
      <main className={[styles.main, "animate-fade"].join(" ")}>
        <Outlet />
      </main>
    </div>
  );
}
