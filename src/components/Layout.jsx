import { Outlet } from "react-router-dom";
import Nav from "./Nav";

export default function Layout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg)" }}>
      <Nav />
      <main style={{ flex: 1, minWidth: 0 }} className="animate-fade">
        <Outlet />
      </main>
    </div>
  );
}
