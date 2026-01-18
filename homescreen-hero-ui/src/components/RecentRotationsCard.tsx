import { normalizeIso, timeAgo } from "../utils/dates";

type RotationEvent = {
    created_at: string;
    success: boolean;
    summary: string;
    error_message?: string | null;
};

type LastRun = {
    created_at: string;
    success: boolean;
    duration?: number | null;
} | null;

function formatTimestamp(iso: string) {
    const parsed = new Date(normalizeIso(iso));
    if (Number.isNaN(parsed.getTime())) return iso;

    return parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function StatusPill({ success }: { success: boolean }) {
    const classes = success
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : "bg-rose-500/15 text-rose-300 ring-rose-500/30";

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${classes}`}>
            {success ? "Success" : "Failed"}
        </span>
    );
}

function SkeletonItem() {
    return (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/60 bg-slate-800/30 p-2.5 animate-pulse">
            <div className="mt-1 h-2 w-2 rounded-full bg-slate-700" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-slate-800" />
                <div className="h-2.5 w-1/2 rounded bg-slate-800" />
            </div>
        </div>
    );
}

export default function RecentRotationsCard({
    items,
    lastRun,
    loading,
    formatTimeAgo = timeAgo,
    limit,
}: {
    items: RotationEvent[];
    lastRun: LastRun;
    loading?: boolean;
    formatTimeAgo?: (iso: string) => string;
    limit?: number;
}) {
    const displayItems = limit ? items.slice(0, limit) : items;

    return (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 p-5 space-y-4 transition-all duration-300 hover:bg-slate-800/30">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Recent Rotations</h3>
                    <p className="text-sm text-slate-400 mt-0.5">Latest sync attempts and their outcomes.</p>
                </div>
                {lastRun ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{formatTimeAgo(lastRun.created_at)}</span>
                        <StatusPill success={lastRun.success} />
                    </div>
                ) : null}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <SkeletonItem key={idx} />
                    ))}
                </div>
            ) : displayItems.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-400">
                    No rotation history available yet.
                </div>
            ) : (
                <ul className="space-y-2 max-h-[440px] overflow-y-auto scrollbar-hover-only pr-1">
                    {displayItems.map((event, idx) => {
                        const { created_at, success, summary, error_message } = event;
                        return (
                            <li
                                key={`${created_at}-${idx}`}
                                className="group flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-800/30 p-2.5 hover:border-slate-700 hover:bg-slate-800/50 transition-all duration-200"
                            >
                                <div className="pt-1">
                                    <div
                                        className={`h-2 w-2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.35)] transition-all duration-200 ${success
                                            ? "bg-emerald-400 shadow-emerald-500/40 group-hover:shadow-emerald-500/60"
                                            : "bg-rose-400 shadow-rose-500/40 group-hover:shadow-rose-500/60"
                                            }`}
                                    />
                                </div>

                                <div className="flex-1 min-w-0 space-y-1">
                                    <p className="text-sm font-semibold text-white truncate" title={summary}>
                                        {summary}
                                    </p>

                                    {error_message ? (
                                        <p className="text-xs text-rose-300 leading-relaxed line-clamp-2">
                                            {error_message}
                                        </p>
                                    ) : null}

                                    <div className="text-xs text-slate-400" title={formatTimestamp(created_at)}>
                                        {formatTimeAgo(created_at)} · {formatTimestamp(created_at)}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}