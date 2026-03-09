import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";

type TopCollection = {
    collection_name: string;
    total_plays: number;
    plex_library: string;
    last_collected: string;
};

type MediaType = "movie" | "show";

export default function AnalyticsCard({ loading }: { loading?: boolean }) {
    const [topCollections, setTopCollections] = useState<TopCollection[]>([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tautulliEnabled, setTautulliEnabled] = useState(false);
    const [isCollecting, setIsCollecting] = useState(false);
    const [mediaType, setMediaType] = useState<MediaType>("movie");
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        // Only animate transition if we already have data (not initial load)
        if (topCollections.length > 0) {
            setIsTransitioning(true);
            const timer = setTimeout(() => {
                loadAnalytics();
            }, 150);
            return () => clearTimeout(timer);
        } else {
            loadAnalytics();
        }
    }, [mediaType]);

    const loadAnalytics = async () => {
        setAnalyticsLoading(true);
        setError(null);

        try {
            // Check if Tautulli is enabled
            const configResponse = await fetchWithAuth("/api/admin/config/tautulli");
            if (!configResponse.ok) {
                throw new Error("Failed to load Tautulli configuration");
            }
            const config = await configResponse.json();

            if (!config.enabled) {
                setTautulliEnabled(false);
                setAnalyticsLoading(false);
                return;
            }

            setTautulliEnabled(true);

            // Fetch top collections with media type filter
            const response = await fetchWithAuth(`/api/admin/analytics/top?limit=5&media_type=${mediaType}`);
            if (!response.ok) {
                throw new Error("Failed to load analytics");
            }
            const data = await response.json();
            setTopCollections(data);
            // Small delay to allow fade-in animation
            setTimeout(() => setIsTransitioning(false), 50);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load analytics");
            setIsTransitioning(false);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const handleCollectNow = async () => {
        setIsCollecting(true);
        setError(null);

        try {
            const response = await fetchWithAuth("/api/admin/analytics/collect", {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Failed to collect analytics");
            }

            // Wait a moment then reload
            setTimeout(loadAnalytics, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to collect analytics");
            setIsCollecting(false);
        }
    };

    const cardClass = "rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 px-5 py-4 transition-all duration-300 h-[420px] flex flex-col";
    const cardClassHover = "rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 px-5 py-4 transition-all duration-300 hover:bg-slate-800/30 h-[420px] flex flex-col";

    // Loading state - only show on initial load, not during transitions
    if (loading || (analyticsLoading && topCollections.length === 0 && !tautulliEnabled)) {
        return (
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Collection Analytics
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Watch statistics from Tautulli
                        </p>
                    </div>
                </div>
                <div className="flex items-center justify-center flex-1">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    // Tautulli not enabled state
    if (!tautulliEnabled) {
        return (
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Collection Analytics
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Watch statistics from Tautulli
                        </p>
                    </div>
                </div>
                <div className="text-center flex-1 flex flex-col items-center justify-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 mb-3">
                        <svg
                            className="w-6 h-6 text-slate-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                        </svg>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">
                        Tautulli is not configured
                    </p>
                    <a
                        href="/settings#integrations"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                    >
                        Configure Tautulli
                    </a>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Collection Analytics
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Watch statistics from Tautulli
                        </p>
                    </div>
                </div>
                <div className="text-center flex-1 flex flex-col items-center justify-center">
                    <p className="text-sm text-red-400 mb-3">{error}</p>
                    <button
                        onClick={loadAnalytics}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // No data state
    if (topCollections.length === 0) {
        return (
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Collection Analytics
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Watch statistics from Tautulli
                        </p>
                    </div>
                </div>
                <div className="text-center flex-1 flex flex-col items-center justify-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 mb-3">
                        <svg
                            className="w-6 h-6 text-slate-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                        </svg>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">
                        No analytics data yet
                    </p>
                    <button
                        onClick={handleCollectNow}
                        disabled={isCollecting}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCollecting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Collecting...
                            </>
                        ) : (
                            <>
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                                Collect Now
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Display top collections
    return (
        <div className={cardClassHover}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                        Collection Analytics
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Top collections by plays (30 days)
                    </p>
                </div>
                <button
                    onClick={handleCollectNow}
                    disabled={isCollecting}
                    className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh analytics data"
                >
                    {isCollecting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    ) : (
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    )}
                </button>
            </div>

            {/* Media Type Filter */}
            <div className="flex gap-2 mb-4 flex-shrink-0">
                <button
                    onClick={() => setMediaType("movie")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        mediaType === "movie"
                            ? "bg-primary text-white shadow-md"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                >
                    Movies
                </button>
                <button
                    onClick={() => setMediaType("show")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        mediaType === "show"
                            ? "bg-primary text-white shadow-md"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                >
                    TV Shows
                </button>
            </div>

            <div className={`space-y-1.5 flex-1 overflow-y-auto scrollbar-hover-only transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                {topCollections.map((collection, index) => (
                    <div
                        key={`${collection.collection_name}-${index}`}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition"
                    >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 flex-shrink-0">
                                <span className="text-xs font-bold text-primary">
                                    {index + 1}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white truncate">
                                    {collection.collection_name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {collection.plex_library}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                                <p className="text-sm font-bold text-white">
                                    {collection.total_plays.toLocaleString()}
                                </p>
                                <p className="text-[10px] text-slate-400">plays</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
