import type { ReactNode } from "react";

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

    return (
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 h-32 dark:bg-card-dark dark:border-slate-800">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-100/60 via-transparent to-transparent dark:from-white/5" />

            <div className="relative h-full flex items-center justify-between">
                {/* text */}
                <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</div>

                    <div className="mt-2 text-4xl font-extrabold tracking-tight leading-none text-slate-900 dark:text-white">
                        {statusLabel}
                    </div>

                    <div
                        className={[
                            "mt-3 font-semibold",
                            "text-sm sm:text-base",
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
                        <div className={statusDotClass} />
                    </div>

                    <div className="text-slate-600 dark:text-slate-200">{icon ?? <DefaultStackIcon />}</div>
                </div>
            </div>
        </div>
    );
}

function DefaultStackIcon() {
    return (
        <div className="relative">
            <div className="w-11 h-8 rounded-lg bg-slate-200 border border-slate-300/80 dark:bg-slate-800/70 dark:border-slate-700/60" />
            <div className="w-11 h-8 rounded-lg bg-slate-200 border border-slate-300/80 mt-2 dark:bg-slate-800/70 dark:border-slate-700/60" />
            <div className="absolute left-2 top-2.5 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="absolute left-6 top-2.5 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="absolute left-2 top-[2.85rem] w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="absolute left-6 top-[2.85rem] w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
    );
}