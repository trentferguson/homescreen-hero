import { User, LogOut, Menu } from "lucide-react";
import IconButton from "./IconButton";
import VersionBadge from "./VersionBadge";
import { useAuth } from "../utils/auth";
import { useNavigate } from "react-router-dom";

type TopBarProps = {
    onMenuClick: () => void;
};

export default function TopBar({ onMenuClick }: TopBarProps) {
    const { logout, username, authEnabled, thumb } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 lg:px-6 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
            {/* Left: hamburger (mobile only) */}
            <div className="flex items-center">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
                    aria-label="Open navigation"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Right: version, user, logout */}
            <div className="flex items-center gap-3 ml-auto">
                <VersionBadge />

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
        </header>
    );
}
