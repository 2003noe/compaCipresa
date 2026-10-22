import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import AccountingAssistant from "./AccountingAssistant";
import TrafficTracker from "./TrafficTracker";
export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <TrafficTracker />
      <Sidebar />
      <main className="main-shell">
        <TopBar />
        {children}
      </main>
      <AccountingAssistant />
    </div>
  );
}
