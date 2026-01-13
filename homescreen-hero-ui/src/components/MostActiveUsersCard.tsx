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

    useEffect(() => {
        loadActiveUsers();
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
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load user analytics");
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

    // Loading state
    if (loading || analyticsLoading) {
        return (
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Most Active Users
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Top viewers from Tautulli
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
                            Most Active Users
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Top viewers from Tautulli
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
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
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
                            Most Active Users
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Top viewers from Tautulli
                        </p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
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
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Most Active Users
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Top viewers from Tautulli
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
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                        </svg>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        No user data available yet
                    </p>
                </div>
            </div>
        );
    }

    // Display active users
    return (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 dark:hover:border-slate-700 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        Most Active Users
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        Tautulli Top Viewers
                    </p>
                </div>
                <button
                    onClick={loadActiveUsers}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
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
            <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Time Range
                </label>
                <Listbox value={timeRange} onChange={setTimeRange}>
                    <div className="relative">
                        <Listbox.Button className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 flex items-center justify-between">
                            <span>Past {TIME_RANGE_LABELS[timeRange]}</span>
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                        </Listbox.Button>
                        <Listbox.Options className="absolute z-10 mt-1 w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                            {(Object.keys(TIME_RANGE_DAYS) as TimeRange[]).map((range) => (
                                <Listbox.Option
                                    key={range}
                                    value={range}
                                    className="px-3 py-2 cursor-pointer transition-colors text-sm text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:text-white flex items-center justify-between"
                                >
                                    {({ selected }) => (
                                        <>
                                            <span className={selected ? "font-semibold" : ""}>
                                                Past {TIME_RANGE_LABELS[range]}
                                            </span>
                                            {selected && <Check className="h-4 w-4" />}
                                        </>
                                    )}
                                </Listbox.Option>
                            ))}
                        </Listbox.Options>
                    </div>
                </Listbox>
            </div>

            <div className="space-y-3">
                {activeUsers.map((user, index) => (
                    <div
                        key={`${user.username}-${index}`}
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
                                    {user.username}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatDuration(user.total_duration)} watched
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {user.total_plays.toLocaleString()}
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
