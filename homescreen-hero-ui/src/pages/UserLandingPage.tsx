import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../utils/auth";

export default function UserLandingPage() {
    const { logout, username, thumb } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-8 space-y-6 text-center">
                {/* User avatar + name */}
                <div className="flex flex-col items-center gap-3">
                    {thumb ? (
                        <img
                            src={thumb}
                            alt={username ?? "User"}
                            className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700"
                        />
                    ) : (
                        <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <span className="text-2xl font-semibold text-slate-500 dark:text-slate-400">
                                {username?.charAt(0).toUpperCase() ?? "?"}
                            </span>
                        </div>
                    )}
                    <p className="text-lg font-medium text-slate-900 dark:text-white">
                        Hey, {username}!
                    </p>
                </div>

                {/* Message */}
                <div className="space-y-2">
                    <p className="text-slate-600 dark:text-slate-400">
                        User tools are coming soon.
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                        Your server admin is working on some cool features for you. Check back later!
                    </p>
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                    <LogOut size={16} />
                    Sign out
                </button>
            </div>
        </div>
    );
}
