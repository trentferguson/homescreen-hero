import { NavLink } from "react-router-dom";
import { Bell, User, LogOut, Moon, Sun } from "lucide-react";
import IconButton from "./IconButton";
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
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";

    return (
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
            <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
                {/* LEFT: Logo */}
                <div className="flex items-center gap-3">
                    <NavLink to="/" className="flex items-center">
                        <img
                            src="/logo.svg"
                            alt="HomeScreen Hero"
                            className="h-10 w-auto select-none"
                        />
                    </NavLink>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">HomeScreen Hero</h1>
                </div>

                {/* CENTER: Nav */}
                <nav className="hidden md:flex items-center gap-2">
                    <NavItem to="/" label="Dashboard" />
                    <NavItem to="/groups" label="Collection Groups" />
                    <NavItem to="/settings" label="Settings" />
                    <NavItem to="/logs" label="Logs" />
                </nav>

                {/* RIGHT: Icons */}
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        <span className="hidden sm:inline">{isDark ? "Light" : "Dark"} mode</span>
                    </button>

                    <IconButton label="Notifications">
                        <Bell size={20} />
                    </IconButton>

                    <IconButton label="Profile">
                        <User size={20} />
                    </IconButton>

                    <IconButton label="Logout">
                        <LogOut size={20} />
                    </IconButton>
                </div>
            </div>
        </header>
    );
}