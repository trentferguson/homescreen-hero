import { useState } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "../components/TopNav";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { Sheet, SheetContent, SheetTitle } from "../components/ui/sheet";
import { useTheme } from "../utils/theme";
import { PageHeaderProvider } from "../utils/pageHeader";

function TopNavLayout() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <TopNav />

            <main className="mx-auto max-w-7xl px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
}

function SidebarLayout() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const closeMobileNav = () => setMobileNavOpen(false);

    return (
        <PageHeaderProvider>
        <div className="min-h-screen bg-[#11161b] text-slate-100">
            {/* Desktop sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60">
                <Sidebar />
            </div>

            {/* Mobile sidebar */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetContent side="left" className="w-60 p-0 bg-[#12161b] border-slate-800/60">
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <Sidebar onNavigate={closeMobileNav} />
                </SheetContent>
            </Sheet>

            {/* Content area offset by sidebar width on desktop */}
            <div className="lg:pl-60 flex flex-col min-h-screen">
                <TopBar onMenuClick={() => setMobileNavOpen(true)} />

                <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
                    <Outlet />
                </main>
            </div>
        </div>
        </PageHeaderProvider>
    );
}

export default function AppLayout() {
    const { accent } = useTheme();

    if (accent === "plex-orange") return <SidebarLayout />;
    return <TopNavLayout />;
}
