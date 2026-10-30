import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import AccountingAssistant from "./AccountingAssistant";
import TrafficTracker from "./TrafficTracker";

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <TrafficTracker />
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-shell">
        <TopBar onMenuOpen={() => setSidebarOpen(true)} />
        {children}
      </main>
      <AccountingAssistant />
    </div>
  );
}
