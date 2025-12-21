import { Outlet } from "react-router-dom";
import TopNav from "../components/TopNav";

export default function AppLayout() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <TopNav />

            <main className="mx-auto max-w-7xl px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
}