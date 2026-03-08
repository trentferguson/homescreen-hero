import { NavLink, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Layers,
    Library,
    Plug,
    Wrench,
    Settings,
    LogOut,
    User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "../utils/auth";

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
    const { logout, username, role, authEnabled, thumb } = useAuth();

    const handleLogout = () => {
        logout();
        navigate("/login");
        onNavigate?.();
    };

    return (
        <aside className="flex flex-col h-full w-60 bg-[#12161b] border-r border-slate-800/60">
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

            {/* Bottom: compact user row */}
            <div className="px-3 py-3 border-t border-slate-800/60">
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
                    {/* Avatar */}
                    <div className="shrink-0">
                        {thumb ? (
                            <img src={thumb} alt={username ?? "User"} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold select-none">
                                {username?.[0]?.toUpperCase() ?? <User size={14} />}
                            </div>
                        )}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{username ?? "User"}</div>
                        {role && <div className="text-xs text-slate-500 truncate capitalize">{role}</div>}
                    </div>

                    {/* Icon actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        <button
                            onClick={() => { navigate("/settings"); onNavigate?.(); }}
                            className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors"
                            title="Settings"
                        >
                            <Settings size={16} />
                        </button>
                        {authEnabled && (
                            <button
                                onClick={handleLogout}
                                className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors"
                                title="Logout"
                            >
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}
