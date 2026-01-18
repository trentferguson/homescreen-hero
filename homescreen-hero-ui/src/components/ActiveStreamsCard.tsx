import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";

type ActiveStream = {
    user: string;
    state: string;
    title: string;
    media_type: string;
    progress_percent: number | null;
};

type CurrentActivity = {
    stream_count: number;
    streams: ActiveStream[];
};

export default function ActiveStreamsCard({ loading }: { loading?: boolean }) {
    const [activity, setActivity] = useState<CurrentActivity | null>(null);
    const [activityLoading, setActivityLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        loadActivity();
        // Refresh every 30 seconds
        const interval = setInterval(loadActivity, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadActivity = async () => {
        setActivityLoading(true);
        setError(null);

        try {
            // Fetch current activity from Plex API
            const response = await fetchWithAuth("/api/admin/analytics/activity/current");
            if (!response.ok) {
                throw new Error("Failed to load current activity");
            }
            const data = await response.json();
            setActivity(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load current activity");
        } finally {
            setActivityLoading(false);
        }
    };

    const getStateColor = (state: string): string => {
        switch (state.toLowerCase()) {
            case "playing":
                return "text-green-600 dark:text-green-400";
            case "paused":
                return "text-yellow-600 dark:text-yellow-400";
            case "buffering":
                return "text-blue-600 dark:text-blue-400";
            default:
                return "text-slate-600 dark:text-slate-400";
        }
    };

    const getStateIcon = (state: string): string => {
        switch (state.toLowerCase()) {
            case "playing":
                return "▶";
            case "paused":
                return "⏸";
            case "buffering":
                return "⏳";
            default:
                return "•";
        }
    };

    // Loading state - match health card height
    if (loading || activityLoading) {
        return (
            <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 p-5 h-32 transition-all duration-300">
                <div className="relative h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    // Error state - match health card height
    if (error) {
        return (
            <div className="group relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-red-500/5 p-5 h-32 transition-all duration-300">
                <div className="relative h-full flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-red-400 mb-2">{error}</p>
                    <button
                        onClick={loadActivity}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const streamCount = activity?.stream_count ?? 0;
    const streams = activity?.streams ?? [];

    // Get first stream for preview
    const firstStream = streams.length > 0 ? streams[0] : null;

    // Build detail text based on stream count
    let detailText = "No one watching";
    let tooltipText: string | undefined;

    if (streamCount === 1 && firstStream) {
        detailText = `${firstStream.user} watching`;
        tooltipText = `${firstStream.user}: ${firstStream.title}`;
    } else if (streamCount > 1) {
        // Show "X users watching"
        detailText = `${streamCount} users watching`;
        // Tooltip shows all users and what they're watching
        tooltipText = streams.map(s => `${s.user}: ${s.title}`).join('\n');
    }

    const statusDotClass = [
        "w-4 h-4 rounded-full",
        streamCount > 0
            ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.65)]"
            : "bg-slate-400 shadow-[0_0_16px_rgba(148,163,184,0.45)]",
    ].join(" ");

    // Border color based on stream count (matching integrations page)
    const borderColor = streamCount > 0
        ? "border-emerald-500/30"
        : "border-slate-700/50";

    // Gradient background based on stream count
    const gradientBg = streamCount > 0
        ? "from-emerald-500/5 via-slate-900/50 to-slate-900/50"
        : "from-slate-500/5 via-slate-900/50 to-slate-900/50";

    // Shadow color based on stream count
    const shadowColor = streamCount > 0
        ? "shadow-emerald-500/5"
        : "shadow-slate-500/5";

    // Main display state - compact health card style
    return (
        <>
            <div
                className={`group relative overflow-hidden rounded-xl border ${borderColor} bg-gradient-to-br ${gradientBg} shadow-lg ${shadowColor} p-5 h-32 transition-all duration-300 hover:bg-slate-800/30 ${streamCount > 0 ? 'cursor-pointer' : ''}`}
                onClick={streamCount > 0 ? () => setShowModal(true) : undefined}
                title={streamCount > 0 ? "Click to view details" : undefined}
            >
                {/* Click indicator - show subtle icon when there are active streams */}
                {streamCount > 0 && (
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity duration-200 pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </div>
                )}

                <div className="relative h-full flex items-center justify-between pointer-events-none">
                    {/* text */}
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-400 mb-1">
                            Active Streams
                        </div>

                        <div className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none text-white transition-all duration-200">
                            {streamCount === 0 ? "None" : streamCount}
                        </div>

                        <div
                            className={[
                                "mt-2.5 font-semibold text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis",
                                streamCount > 0 ? "text-emerald-400" : "text-slate-400"
                            ].join(" ")}
                            title={tooltipText}
                        >
                            {detailText}
                        </div>
                    </div>

                    {/* icon + status dot */}
                    <div className="relative w-16 h-16 flex items-center justify-center justify-self-end shrink-0">
                        <div className="absolute -top-1 -right-0.5 z-10">
                            <div className={statusDotClass} />
                        </div>

                        <div className="text-slate-200 transition-transform duration-200 group-hover:scale-110">
                            <svg
                                className="w-12 h-12"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal with detailed stream view */}
            {showModal && streamCount > 0 && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 px-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800/80 animate-in zoom-in-95 duration-300 max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-800/80">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    Active Streams
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {streamCount} {streamCount === 1 ? "user is" : "users are"} currently watching
                                </p>
                            </div>
                            <button
                                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-200 text-2xl leading-none px-2"
                                onClick={() => setShowModal(false)}
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Stream list */}
                        <div className="p-5 space-y-3 overflow-y-auto">
                            {streams.map((stream, index) => (
                                <div
                                    key={`${stream.user}-${index}`}
                                    className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-700/50"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-sm font-semibold ${getStateColor(stream.state)}`}>
                                                    {getStateIcon(stream.state)}
                                                </span>
                                                <p className="text-base font-bold text-slate-900 dark:text-white">
                                                    {stream.user}
                                                </p>
                                                <span className={`text-xs font-medium ${getStateColor(stream.state)}`}>
                                                    {stream.state}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                {stream.title}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase">
                                                {stream.media_type}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    {stream.progress_percent !== null && (
                                        <div className="mt-3">
                                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                                                <span>Progress</span>
                                                <span>{stream.progress_percent}%</span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                                <div
                                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${stream.progress_percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50">
                            <button
                                onClick={loadActivity}
                                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-200 active:scale-95 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                            <button
                                className="px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95"
                                onClick={() => setShowModal(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
