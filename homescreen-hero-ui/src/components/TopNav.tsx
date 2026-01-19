import { NavLink, useNavigate } from "react-router-dom";
import { User, LogOut, Settings } from "lucide-react";
import IconButton from "./IconButton";
import { useAuth } from "../utils/auth";

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
    const { logout, username, authEnabled } = useAuth();
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
                            alt="HomeScreen Hero"
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
                    <NavItem to="/integrations" label="Integrations" />
                    <NavItem to="/tools" label="Tools" />
                </nav>

                {/* RIGHT: Icons */}
                <div className="flex items-center gap-3">
                    <IconButton label="Settings" onClick={() => navigate("/settings")}>
                        <Settings size={20} />
                    </IconButton>

                    <IconButton label={username ?? "User"}>
                        <User size={20} />
                    </IconButton>

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