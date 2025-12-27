import { NavLink, useNavigate } from "react-router-dom";
import { User, LogOut, Moon, Sun, Menu, X } from "lucide-react";
import IconButton from "./IconButton";
import { useTheme } from "../utils/theme";
import { useAuth } from "../utils/auth";
import { useState } from "react";

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
    const { logout, username, authEnabled } = useAuth();
    const navigate = useNavigate();
    const isDark = theme === "dark";
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">HomeScreen Hero</h1>
                </div>

                {/* CENTER: Nav - Desktop */}
                <nav className="hidden md:flex items-center gap-1">
                    <NavItem to="/" label="Dashboard" />
                    <NavItem to="/groups" label="Groups" />
                    <NavItem to="/collections" label="Collections" />
                    <NavItem to="/settings" label="Settings" />
                    <NavItem to="/logs" label="Logs" />
                </nav>

                {/* RIGHT: Icons */}
                <div className="flex items-center gap-3">
                    {/* Mobile menu button */}
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                        className="md:hidden flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-100 hover:shadow hover:border-slate-300 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-600"
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-100 hover:shadow hover:border-slate-300 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-600"
                    >
                        {isDark ? <Sun size={18} className="transition-transform duration-200" /> : <Moon size={18} className="transition-transform duration-200" />}
                        <span className="hidden sm:inline">{isDark ? "Light" : "Dark"} mode</span>
                    </button>

                    {/*
                    <IconButton label="Notifications">
                        <Bell size={20} />
                    </IconButton>
                    */}

                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <User size={18} />
                        <span>{username}</span>
                    </div>

                    {authEnabled && (
                        <IconButton label="Logout" onClick={handleLogout}>
                            <LogOut size={20} />
                        </IconButton>
                    )}
                </div>
            </div>

            {/* Mobile Navigation Menu */}
            {mobileMenuOpen && (
                <nav className="md:hidden border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <div className="mx-auto max-w-7xl px-4 py-2 flex flex-col gap-1">
                        <NavLink
                            to="/"
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                `px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${isActive
                                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                                }`
                            }
                            end
                        >
                            Dashboard
                        </NavLink>
                        <NavLink
                            to="/groups"
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                `px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${isActive
                                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                                }`
                            }
                        >
                            Groups
                        </NavLink>
                        <NavLink
                            to="/collections"
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                `px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${isActive
                                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                                }`
                            }
                        >
                            Collections
                        </NavLink>
                        <NavLink
                            to="/settings"
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                `px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${isActive
                                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                                }`
                            }
                        >
                            Settings
                        </NavLink>
                        <NavLink
                            to="/logs"
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                `px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${isActive
                                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                                }`
                            }
                        >
                            Logs
                        </NavLink>
                    </div>
                </nav>
            )}
        </header>
    );
}