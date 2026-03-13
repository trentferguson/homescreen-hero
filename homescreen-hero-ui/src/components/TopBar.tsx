import { Menu, SwatchBook } from "lucide-react";
import { useLocation } from "react-router-dom";
import VersionBadge from "./VersionBadge";
import { usePageHeader } from "../utils/pageHeader";
import { useTheme } from "../utils/theme";

const routeTitles: Record<string, string> = {
    "/": "System Overview",
    "/groups": "Groups",
    "/collections": "Collections",
    "/lists": "Lists",
    "/tools": "Tools & Utilities",
    "/settings": "Settings",
};

type TopBarProps = {
    onMenuClick: () => void;
};

export default function TopBar({ onMenuClick }: TopBarProps) {
    const location = useLocation();
    const { title, actions } = usePageHeader();
    const { accent, setAccent } = useTheme();

    const displayTitle = title || routeTitles[location.pathname] || "";

    return (
        <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 lg:px-6 border-b border-slate-800/60 bg-[#12161b]/80 backdrop-blur-xl">
            {/* Left: hamburger (mobile) + page title */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
                    aria-label="Open navigation"
                >
                    <Menu size={20} />
                </button>

                {displayTitle && (
                    <span className="text-sm font-bold uppercase tracking-widest text-slate-400">
                        {displayTitle}
                    </span>
                )}
            </div>

            {/* Right: page actions + version + theme toggle */}
            <div className="flex items-center gap-3">
                {actions}
                <VersionBadge />
                <button
                    onClick={() => setAccent(accent === "plex-orange" ? "default" : "plex-orange")}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
                    title={`Switch to ${accent === "plex-orange" ? "default" : "plex"} theme`}
                >
                    <SwatchBook size={18} />
                </button>
            </div>
        </header>
    );
}
