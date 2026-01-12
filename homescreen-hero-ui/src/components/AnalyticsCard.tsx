import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";

type TopCollection = {
    collection_name: string;
    total_plays: number;
    plex_library: string;
    last_collected: string;
};

export default function AnalyticsCard({ loading }: { loading?: boolean }) {
    const [topCollections, setTopCollections] = useState<TopCollection[]>([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tautulliEnabled, setTautulliEnabled] = useState(false);
    const [isCollecting, setIsCollecting] = useState(false);

    useEffect(() => {
        loadAnalytics();
    }, []);

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

            // Fetch top collections
            const response = await fetchWithAuth("/api/admin/analytics/top?limit=5");
            if (!response.ok) {
                throw new Error("Failed to load analytics");
            }
            const data = await response.json();
            setTopCollections(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load analytics");
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

    // Loading state
    if (loading || analyticsLoading) {
        return (
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Collection Analytics
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Watch statistics from Tautulli
                        </p>
                    </div>
                </div>
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    // Tautulli not enabled state
    if (!tautulliEnabled) {
        return (
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Collection Analytics
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Watch statistics from Tautulli
                        </p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
                        <svg
                            className="w-6 h-6 text-slate-400 dark:text-slate-500"
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
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Tautulli is not configured
                    </p>
                    <a
                        href="/integrations"
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
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Collection Analytics
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Watch statistics from Tautulli
                        </p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
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
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Collection Analytics
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Watch statistics from Tautulli
                        </p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
                        <svg
                            className="w-6 h-6 text-slate-400 dark:text-slate-500"
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
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
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
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 dark:hover:border-slate-700 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        Collection Analytics
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        Top collections by plays (last 30 days)
                    </p>
                </div>
                <button
                    onClick={handleCollectNow}
                    disabled={isCollecting}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh analytics data"
                >
                    {isCollecting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600 dark:border-slate-300"></div>
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

            <div className="space-y-3">
                {topCollections.map((collection, index) => (
                    <div
                        key={`${collection.collection_name}-${index}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex-shrink-0">
                                <span className="text-sm font-bold text-primary dark:text-primary-light">
                                    {index + 1}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {collection.collection_name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {collection.plex_library}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {collection.total_plays.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">plays</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
