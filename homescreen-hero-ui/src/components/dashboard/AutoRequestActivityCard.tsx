import { useEffect, useState } from "react";
import { Film, Tv, AlertCircle, RefreshCw } from "lucide-react";
import { fetchWithAuth } from "../../utils/api";
import { normalizeIso, timeAgo } from "../../utils/dates";

type AutoRequestItem = {
    id: number;
    tmdb_id: number;
    media_type: "movie" | "tv";
    title: string;
    year: number | null;
    integration_type: string;
    source_name: string;
    status: string;
    error_message: string | null;
    requested_at: string;
    downloaded_at: string | null;
};

type AutoRequestSummary = {
    requested: number;
    downloaded: number;
    failed: number;
    already_exists: number;
};

type AutoRequestResponse = {
    items: AutoRequestItem[];
    summary: AutoRequestSummary;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; ring: string; label: string }> = {
    requested: { bg: "bg-blue-500/15", text: "text-blue-300", ring: "ring-blue-500/30", label: "Requested" },
    downloaded: { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-500/30", label: "Downloaded" },
    failed: { bg: "bg-rose-500/15", text: "text-rose-300", ring: "ring-rose-500/30", label: "Failed" },
    already_exists: { bg: "bg-amber-500/15", text: "text-amber-300", ring: "ring-amber-500/30", label: "Exists" },
};

function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLES[status] || STATUS_STYLES.requested;
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 whitespace-nowrap ${style.bg} ${style.text} ${style.ring}`}>
            {style.label}
        </span>
    );
}

function SkeletonItem() {
    return (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/60 bg-slate-800/30 p-2.5 animate-pulse">
            <div className="mt-1 h-3.5 w-3.5 rounded bg-slate-700" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-slate-800" />
                <div className="h-2.5 w-1/2 rounded bg-slate-800" />
            </div>
        </div>
    );
}

function formatSource(integrationType: string, sourceName: string): string {
    const label = integrationType.charAt(0).toUpperCase() + integrationType.slice(1);
    return `${label}: ${sourceName}`;
}

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

export default function AutoRequestActivityCard() {
    const [items, setItems] = useState<AutoRequestItem[]>([]);
    const [summary, setSummary] = useState<AutoRequestSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [seerrEnabled, setSeerrEnabled] = useState<boolean | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            const configRes = await fetchWithAuth("/api/admin/config/seerr");
            if (!configRes.ok) throw new Error("Failed to load Seerr configuration");
            const config = await configRes.json();

            if (!config.enabled) {
                setSeerrEnabled(false);
                setLoading(false);
                return;
            }
            setSeerrEnabled(true);

            const res = await fetchWithAuth("/api/admin/integrations/auto-request/history?limit=50");
            if (!res.ok) throw new Error("Failed to load auto-request history");

            const data: AutoRequestResponse = await res.json();
            setItems(data.items);
            setSummary(data.summary);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load data");
            setSeerrEnabled(true);
        } finally {
            setLoading(false);
        }
    };

    // Seerr not configured
    if (seerrEnabled === false) {
        return (
            <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 via-slate-900/50 to-slate-900/50 shadow-lg p-5 h-[420px] flex flex-col items-center justify-center text-center gap-3">
                <Film className="h-8 w-8 text-slate-600" />
                <div>
                    <p className="text-sm font-medium text-slate-400">Seerr not configured</p>
                    <p className="text-xs text-slate-500 mt-1">Configure Seerr in Integrations to enable auto-requests.</p>
                </div>
            </div>
        );
    }

    const total = summary ? summary.requested + summary.downloaded + summary.failed + summary.already_exists : 0;

    return (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 p-5 space-y-4 transition-all duration-300 hover:bg-slate-800/30 h-[420px] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Auto-Request Activity</h3>
                    <p className="text-sm text-slate-400 mt-0.5">Items automatically requested via Seerr.</p>
                </div>
                {summary && total > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
                        {summary.downloaded > 0 && (
                            <span className="text-emerald-400">{summary.downloaded} downloaded</span>
                        )}
                        {summary.requested > 0 && (
                            <span className="text-blue-400">{summary.requested} pending</span>
                        )}
                        {summary.failed > 0 && (
                            <span className="text-rose-400">{summary.failed} failed</span>
                        )}
                    </div>
                )}
            </div>

            {/* Loading */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <SkeletonItem key={idx} />
                    ))}
                </div>
            ) : error ? (
                /* Error state */
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                    <AlertCircle className="h-6 w-6 text-rose-400" />
                    <p className="text-sm text-rose-300">{error}</p>
                    <button
                        onClick={loadData}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                    </button>
                </div>
            ) : items.length === 0 ? (
                /* Empty state */
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-400">
                    No auto-requested items yet. Enable auto-request on a source to get started.
                </div>
            ) : (
                /* Items list */
                <ul className="space-y-2 flex-1 overflow-y-auto scrollbar-hover-only pr-1">
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className="group flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-800/30 px-2.5 py-1.5 hover:border-slate-700 hover:bg-slate-800/50 transition-all duration-200"
                        >
                            {/* Media type icon */}
                            <div className="pt-1">
                                {item.media_type === "movie" ? (
                                    <Film className="h-3.5 w-3.5 text-slate-400" />
                                ) : (
                                    <Tv className="h-3.5 w-3.5 text-slate-400" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-white truncate">
                                        {item.title}
                                        {item.year && (
                                            <span className="text-slate-400 font-normal ml-1">({item.year})</span>
                                        )}
                                    </p>
                                    <StatusBadge status={item.status} />
                                </div>

                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                    <span className="truncate">{formatSource(item.integration_type, item.source_name)}</span>
                                    <span className="text-slate-600">·</span>
                                    <span className="whitespace-nowrap" title={formatTimestamp(item.requested_at)}>
                                        {timeAgo(item.requested_at)}
                                    </span>
                                </div>

                                {item.error_message && (
                                    <p className="text-xs text-rose-300 leading-relaxed line-clamp-1">
                                        {item.error_message}
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
