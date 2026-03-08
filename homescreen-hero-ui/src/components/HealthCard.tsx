import type { ReactNode } from "react";
import { useTheme } from "../utils/theme";

type HealthCardProps = {
    title: string;
    ok?: boolean;
    loading?: boolean;
    subtitleOk?: string;
    subtitleBad?: string;
    detail?: string | null;
    icon?: ReactNode;
};

export default function HealthCard({
    title,
    ok,
    loading,
    subtitleOk = "Online",
    subtitleBad = "Needs attention",
    detail,
    icon,
}: HealthCardProps) {
    const { accent } = useTheme();
    const compact = accent === "plex-orange";

    const isOk = ok === true;
    const statusLabel = loading ? "Checking…" : isOk ? subtitleOk : subtitleBad;

    const detailText =
        loading || detail
            ? loading
                ? "Running health check"
                : detail
            : isOk
                ? "All good"
                : "Check details";

    const detailClass = loading
        ? "text-slate-500 dark:text-slate-400"
        : isOk
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-500 dark:text-amber-300";

    const statusDotClass = [
        "w-4 h-4 rounded-full",
        loading
            ? "bg-slate-500 shadow-[0_0_16px_rgba(148,163,184,0.45)]"
            : isOk
                ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.65)]"
                : "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]",
    ].join(" ");

    // Border color based on status (matching integrations page)
    const borderColor = loading
        ? "border-slate-700/50"
        : isOk
            ? "border-emerald-500/30"
            : "border-amber-500/30";

    // Gradient background based on status (matching integrations page)
    const gradientBg = loading
        ? "from-slate-500/5 via-slate-900/50 to-slate-900/50"
        : isOk
            ? "from-emerald-500/5 via-slate-900/50 to-slate-900/50"
            : "from-amber-500/5 via-slate-900/50 to-slate-900/50";

    // Shadow color based on status
    const shadowColor = loading
        ? "shadow-slate-500/5"
        : isOk
            ? "shadow-emerald-500/5"
            : "shadow-amber-500/5";

    if (compact) {
        return (
            <div className={`group relative overflow-hidden rounded-xl border ${borderColor} bg-gradient-to-br ${gradientBg} px-4 py-3 h-20 transition-all duration-300 hover:bg-slate-800/30`}>
                <div className="relative h-full flex items-center justify-between">
                    <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">{title}</div>
                        <div className="text-xl font-bold tracking-tight leading-none text-white">
                            {statusLabel}
                        </div>
                    </div>
                    <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                        <div className="absolute -top-0.5 -right-0.5 z-10">
                            <div className={[
                                "w-2.5 h-2.5 rounded-full",
                                loading ? "bg-slate-500" : isOk ? "bg-emerald-400" : "bg-amber-400",
                                loading ? "animate-pulse" : "",
                            ].join(" ")} />
                        </div>
                        <div className="text-primary">{icon ?? <DefaultStackIcon compact />}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`group relative overflow-hidden rounded-xl border ${borderColor} bg-gradient-to-br ${gradientBg} shadow-lg ${shadowColor} p-5 h-32 transition-all duration-300 hover:bg-slate-800/30`}>
            <div className="relative h-full flex items-center justify-between">
                {/* text */}
                <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-400 mb-1">{title}</div>

                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none text-white transition-all duration-200">
                        {statusLabel}
                    </div>

                    <div
                        className={[
                            "mt-2.5 font-semibold",
                            "text-xs sm:text-sm",
                            "whitespace-nowrap overflow-hidden text-ellipsis",
                            detailClass,
                        ].join(" ")}
                        title={detailText ?? undefined}
                    >
                        {detailText}
                    </div>
                </div>

                {/* icon + status dot */}
                <div className="relative w-16 h-16 flex items-center justify-center justify-self-end shrink-0">
                    <div className="absolute -top-1 -right-0.5 z-10">
                        <div className={statusDotClass + (loading ? " animate-pulse" : "")} />
                    </div>

                    <div className="text-slate-200 transition-transform duration-200 group-hover:scale-110">{icon ?? <DefaultStackIcon />}</div>
                </div>
            </div>
        </div>
    );
}

function DefaultStackIcon({ compact }: { compact?: boolean }) {
    if (compact) {
        return (
            <div className="relative">
                <div className="w-6 h-4 rounded bg-slate-700/70 border border-slate-600/60" />
                <div className="w-6 h-4 rounded bg-slate-700/70 border border-slate-600/60 mt-1" />
            </div>
        );
    }
    return (
        <div className="relative">
            <div className="w-11 h-8 rounded-lg bg-slate-800/70 border border-slate-700/60" />
            <div className="w-11 h-8 rounded-lg bg-slate-800/70 border border-slate-700/60 mt-2" />
            <div className="absolute left-2 top-2.5 w-2 h-2 rounded-full bg-slate-700" />
            <div className="absolute left-6 top-2.5 w-2 h-2 rounded-full bg-slate-700" />
            <div className="absolute left-2 top-[2.85rem] w-2 h-2 rounded-full bg-slate-700" />
            <div className="absolute left-6 top-[2.85rem] w-2 h-2 rounded-full bg-slate-700" />
        </div>
    );
}
