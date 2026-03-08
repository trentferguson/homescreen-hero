import { NavLink, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Layers,
    Library,
    Plug,
    Wrench,
    Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItemDef = {
    to: string;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    end?: boolean;
};

const navItems: NavItemDef[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/groups", label: "Groups", icon: Layers },
    { to: "/collections", label: "Collections", icon: Library },
    { to: "/integrations", label: "Integrations", icon: Plug },
    { to: "/tools", label: "Tools", icon: Wrench },
];

function SidebarNavItem({ to, label, icon: Icon, end, onNavigate }: NavItemDef & { onNavigate?: () => void }) {
    return (
        <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
                cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                        ? "bg-primary/10 text-primary"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                )
            }
        >
            <Icon size={20} />
            <span>{label}</span>
        </NavLink>
    );
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
    const navigate = useNavigate();

    return (
        <aside className="flex flex-col h-full w-60 bg-slate-950 border-r border-slate-800/60">
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 h-16 shrink-0">
                <NavLink to="/" onClick={onNavigate} className="flex items-center gap-3 group">
                    <img
                        src="/logo.svg"
                        alt="homescreen-hero"
                        className="h-8 w-auto select-none transition-transform duration-200 group-hover:scale-105"
                    />
                    <span
                        className="text-lg font-medium text-white tracking-tight"
                        style={{ fontFamily: "Oxanium" }}
                    >
                        homescreen-hero
                    </span>
                </NavLink>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                    <SidebarNavItem key={item.to} {...item} onNavigate={onNavigate} />
                ))}
            </nav>

            {/* Bottom: Settings */}
            <div className="px-3 py-4 border-t border-slate-800/60">
                <button
                    onClick={() => { navigate("/settings"); onNavigate?.(); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors w-full"
                >
                    <Settings size={20} />
                    <span>Settings</span>
                </button>
            </div>
        </aside>
    );
}
