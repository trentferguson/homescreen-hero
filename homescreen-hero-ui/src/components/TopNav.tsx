import { NavLink, useNavigate } from "react-router-dom";
import { User, LogOut, Settings } from "lucide-react";
import IconButton from "./IconButton";
import VersionBadge from "./VersionBadge";
import { useAuth } from "../utils/auth";
import { useTheme } from "../utils/theme";

function NavItem({ to, label }: { to: string; label: string }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `px-3 py-2 text-sm font-semibold transition-colors ${isActive
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`
            }
            end={to === "/"}
        >
            {label}
        </NavLink>
    );
}

export default function TopNav() {
    const { logout, username, authEnabled, thumb } = useAuth();
    const { setAccent } = useTheme();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80 transition-all duration-300">
            <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
                {/* LEFT: Logo */}
                <div className="flex items-center gap-3">
                    <NavLink to="/" className="flex items-center group">
                        <img
                            src="/logo.svg"
                            alt="homescreen-hero"
                            className="h-10 w-auto select-none transition-transform duration-200 group-hover:scale-105"
                        />
                    </NavLink>
                    <h1 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'Oxanium' }}>homescreen-hero</h1>
                </div>

                {/* CENTER: Nav */}
                <nav className="hidden md:flex items-center gap-1">
                    <NavItem to="/" label="Dashboard" />
                    <NavItem to="/groups" label="Groups" />
                    <NavItem to="/collections" label="Collections" />
                    <NavItem to="/lists" label="Lists" />
                    <NavItem to="/tools" label="Tools" />
                </nav>

                {/* RIGHT: Version + Icons */}
                <div className="flex items-center gap-3">
                    {/* Dev-only theme toggle */}
                    <button
                        onClick={() => setAccent("plex-orange")}
                        className="px-2 py-1 rounded text-[10px] font-bold tracking-wider border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                        title="Switch to Plex theme (dev)"
                    >
                        PLEX
                    </button>
                    <VersionBadge />
                    <IconButton label="Settings" onClick={() => navigate("/settings")}>
                        <Settings size={20} />
                    </IconButton>

                    <div className="text-slate-400" title={username ?? "User"}>
                        {thumb ? (
                            <img
                                src={thumb}
                                alt={username ?? "User"}
                                className="h-5 w-5 rounded-full object-cover"
                            />
                        ) : (
                            <User size={20} />
                        )}
                    </div>

                    {authEnabled && (
                        <IconButton label="Logout" onClick={handleLogout}>
                            <LogOut size={20} />
                        </IconButton>
                    )}
                </div>
            </div>
        </header>
    );
}