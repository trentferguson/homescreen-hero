import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../utils/theme";

type RotationStatusCardProps = {
    enabled: boolean;
    nextRunTime: string | null;
    loading?: boolean;
    currentTime: number;
    icon?: ReactNode;
};

function formatCountdown(nextRunTime: string | null, currentTime: number): string {
    if (!nextRunTime) return "Not scheduled";

    const nextRun = new Date(nextRunTime).getTime();
    const now = currentTime;
    const diff = nextRun - now;

    if (diff <= 0) return "Any moment now";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

export default function RotationStatusCard({
    enabled,
    nextRunTime,
    loading,
    currentTime,
    icon,
}: RotationStatusCardProps) {
    const navigate = useNavigate();
    const { accent } = useTheme();
    const compact = accent === "plex-orange";

    const handleClick = () => {
        navigate("/settings?section=rotation");
    };

    const statusLabel = loading
        ? "Checking…"
        : enabled
            ? "Enabled"
            : "Disabled";

    const countdown = enabled && nextRunTime ? formatCountdown(nextRunTime, currentTime) : null;

    const detailText = loading
        ? "Loading status"
        : enabled
            ? countdown ?? "Not scheduled"
            : "Auto-rotation is off";

    const detailClass = loading
        ? "text-slate-500 dark:text-slate-400"
        : enabled
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-500 dark:text-amber-300";

    const statusDotClass = [
        "w-4 h-4 rounded-full",
        loading
            ? "bg-slate-500 shadow-[0_0_16px_rgba(148,163,184,0.45)]"
            : enabled
                ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.65)]"
                : "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]",
    ].join(" ");

    // Border color based on status (matching integrations page)
    const borderColor = loading
        ? "border-slate-700/50"
        : enabled
            ? "border-emerald-500/30"
            : "border-amber-500/30";

    // Gradient background based on status (matching integrations page)
    const gradientBg = loading
        ? "from-slate-500/5 via-slate-900/50 to-slate-900/50"
        : enabled
            ? "from-emerald-500/5 via-slate-900/50 to-slate-900/50"
            : "from-amber-500/5 via-slate-900/50 to-slate-900/50";

    // Shadow color based on status
    const shadowColor = loading
        ? "shadow-slate-500/5"
        : enabled
            ? "shadow-emerald-500/5"
            : "shadow-amber-500/5";

    return (
        <div
            onClick={handleClick}
            className={`group relative overflow-hidden rounded-xl border ${borderColor} bg-gradient-to-br ${gradientBg} shadow-lg ${shadowColor} transition-all duration-300 hover:bg-slate-800/30 cursor-pointer ${compact ? "px-4 py-3 h-20" : "p-5 h-32"}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick();
                }
            }}
        >
            <div className="relative h-full flex items-center justify-between">
                <div className="min-w-0">
                    {compact ? (
                        <>
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Auto Rotation</div>
                            <div className="text-xl font-bold tracking-tight leading-none text-white">{statusLabel}</div>
                        </>
                    ) : (
                        <>
                            <div className="text-sm font-medium text-slate-400 mb-1">Auto Rotation</div>
                            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none text-white transition-all duration-200">
                                {statusLabel}
                            </div>
                            <div
                                className={["mt-2.5 font-semibold", "text-xs sm:text-sm", "whitespace-nowrap overflow-hidden text-ellipsis", detailClass].join(" ")}
                                title={detailText ?? undefined}
                            >
                                {detailText}
                            </div>
                        </>
                    )}
                </div>

                {/* icon + status dot */}
                <div className={`relative flex items-center justify-center shrink-0 ${compact ? "w-10 h-10" : "w-16 h-16"}`}>
                    <div className={`absolute z-10 ${compact ? "-top-0.5 -right-0.5" : "-top-1 -right-0.5"}`}>
                        <div className={compact
                            ? `w-2.5 h-2.5 rounded-full ${loading ? "bg-slate-500 animate-pulse" : enabled ? "bg-emerald-400" : "bg-amber-400"}`
                            : statusDotClass + (loading ? " animate-pulse" : "")}
                        />
                    </div>
                    <div className={`transition-transform duration-200 group-hover:scale-110 ${compact ? "text-primary" : "text-slate-200"}`}>
                        {icon ?? <DefaultRotationIcon compact={compact} />}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DefaultRotationIcon({ compact }: { compact?: boolean }) {
    return (
        <svg
            className={compact ? "w-6 h-6" : "w-12 h-12"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
    );
}
