import Sidebar from './Sidebar';import TopBar from './TopBar';
export default function AppLayout({children}){return <div className="app-shell"><Sidebar/><main className="main-shell"><TopBar/>{children}</main></div>}
