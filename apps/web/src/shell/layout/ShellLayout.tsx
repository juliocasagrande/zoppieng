import { Outlet } from "react-router-dom";
import { Header } from "./Header.js";
import { Sidebar } from "./Sidebar.js";

export function ShellLayout() {
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: "100vh" }}>
      <Header />
      <div style={{ display: "grid", gridTemplateColumns: "var(--sidebar-width) 1fr" }}>
        <Sidebar />
        <main style={{ background: "var(--color-off-white)", padding: "36px 40px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
