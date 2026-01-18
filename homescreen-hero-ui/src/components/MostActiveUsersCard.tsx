import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { Listbox } from "@headlessui/react";
import { ChevronDown, Check } from "lucide-react";

type ActiveUser = {
    username: string;
    total_plays: number;
    total_duration: number;
};

type TimeRange = "day" | "week" | "month" | "year";

const TIME_RANGE_DAYS: Record<TimeRange, number> = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
};

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    day: "24 Hours",
    week: "Week",
    month: "Month",
    year: "Year",
};

export default function MostActiveUsersCard({ loading }: { loading?: boolean }) {
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tautulliEnabled, setTautulliEnabled] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>("year");
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        // Only animate transition if we already have data (not initial load)
        if (activeUsers.length > 0) {
            setIsTransitioning(true);
            const timer = setTimeout(() => {
                loadActiveUsers();
            }, 150);
            return () => clearTimeout(timer);
        } else {
            loadActiveUsers();
        }
    }, [timeRange]);

    const loadActiveUsers = async () => {
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

            // Fetch most active users with selected time range
            const queryDays = TIME_RANGE_DAYS[timeRange];
            const response = await fetchWithAuth(`/api/admin/analytics/users/top?limit=5&query_days=${queryDays}`);
            if (!response.ok) {
                throw new Error("Failed to load user analytics");
            }
            const data = await response.json();
            setActiveUsers(data);
            // Small delay to allow fade-in animation
            setTimeout(() => setIsTransitioning(false), 50);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load user analytics");
            setIsTransitioning(false);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const getInitials = (username: string): string => {
        return username.slice(0, 2).toUpperCase();
    };

    // Generate a consistent color based on username
    const getAvatarColor = (username: string): string => {
        const colors = [
            "bg-blue-500",
            "bg-emerald-500",
            "bg-violet-500",
            "bg-amber-500",
            "bg-rose-500",
            "bg-cyan-500",
            "bg-indigo-500",
            "bg-pink-500",
        ];
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const cardClass = "rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 px-5 py-4 transition-all duration-300 h-[420px] flex flex-col";
    const cardClassHover = "rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 px-5 py-4 transition-all duration-300 hover:bg-slate-800/30 h-[420px] flex flex-col";

    // Loading state - only show on initial load, not during transitions
    if (loading || (analyticsLoading && activeUsers.length === 0 && !tautulliEnabled)) {
        return (
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Most Active Users
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Top viewers from Tautulli
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
                            Most Active Users
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Top viewers from Tautulli
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
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                        </svg>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">
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
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Most Active Users
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Top viewers from Tautulli
                        </p>
                    </div>
                </div>
                <div className="text-center flex-1 flex flex-col items-center justify-center">
                    <p className="text-sm text-red-400 mb-3">{error}</p>
                    <button
                        onClick={loadActiveUsers}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // No data state
    if (activeUsers.length === 0) {
        return (
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Most Active Users
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Top viewers from Tautulli
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
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                        </svg>
                    </div>
                    <p className="text-sm text-slate-400">
                        No user data available yet
                    </p>
                </div>
            </div>
        );
    }

    // Display active users
    return (
        <div className={cardClassHover}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                        Most Active Users
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Tautulli Top Viewers
                    </p>
                </div>
                <button
                    onClick={loadActiveUsers}
                    className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all duration-200"
                    title="Refresh user data"
                >
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
                </button>
            </div>

            {/* Time Range Filter */}
            <div className="mb-4 flex-shrink-0">
                <Listbox value={timeRange} onChange={setTimeRange}>
                    <div className="relative">
                        <Listbox.Button className="w-full px-3 py-2 rounded-lg text-sm font-medium border border-slate-700/50 bg-slate-800/30 text-slate-300 hover:text-white hover:border-primary/30 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 flex items-center justify-between">
                            <span>Past {TIME_RANGE_LABELS[timeRange]}</span>
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                        </Listbox.Button>
                        <Listbox.Options className="absolute z-10 mt-1 w-full border border-slate-700/50 bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 max-h-60 overflow-auto focus:outline-none">
                            {(Object.keys(TIME_RANGE_DAYS) as TimeRange[]).map((range) => (
                                <Listbox.Option
                                    key={range}
                                    value={range}
                                    className="px-3 py-2 cursor-pointer transition-all duration-150 text-sm text-slate-300 hover:text-white hover:bg-primary/10 data-[selected]:bg-primary/20 data-[selected]:text-white flex items-center justify-between"
                                >
                                    {({ selected }) => (
                                        <>
                                            <span className={selected ? "font-semibold" : ""}>
                                                Past {TIME_RANGE_LABELS[range]}
                                            </span>
                                            {selected && <Check className="h-4 w-4 text-primary" />}
                                        </>
                                    )}
                                </Listbox.Option>
                            ))}
                        </Listbox.Options>
                    </div>
                </Listbox>
            </div>

            <div className={`space-y-1.5 flex-1 overflow-y-auto scrollbar-hover-only transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                {activeUsers.map((user, index) => (
                    <div
                        key={`${user.username}-${index}`}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition"
                    >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 ${getAvatarColor(user.username)}`}>
                                <span className="text-[10px] font-bold text-white">
                                    {getInitials(user.username)}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white truncate">
                                    {user.username}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {formatDuration(user.total_duration)} watched
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                                <p className="text-sm font-bold text-white">
                                    {user.total_plays.toLocaleString()}
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
