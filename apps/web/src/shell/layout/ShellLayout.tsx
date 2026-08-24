import { Outlet } from "react-router-dom";
import { Header } from "./Header.js";
import { Sidebar } from "./Sidebar.js";

export function ShellLayout() {
  return (
    <div className="zp-shell" style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: "100vh" }}>
      <Header />
      <div className="zp-shell-body" style={{ display: "grid", gridTemplateColumns: "var(--sidebar-width) minmax(0, 1fr)" }}>
        <Sidebar />
        <main className="zp-shell-main" style={{ background: "var(--color-off-white)", padding: "36px 40px", minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
