import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { Listbox } from "@headlessui/react";
import { ChevronDown, Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from "recharts";

type HourlyData = {
    hour: number;
    plays: number;
};

type DailyData = {
    date: string;
    plays: number;
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

const GRAPHS = [
    { id: "hourly", title: "Peak Viewing Hours", subtitle: "Plays by hour of day" },
    { id: "daily", title: "Stream History", subtitle: "Plays over time" },
] as const;

type GraphId = (typeof GRAPHS)[number]["id"];

function formatHour(hour: number): string {
    if (hour === 0) return "12am";
    if (hour === 12) return "12pm";
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
}

function formatDate(dateStr: string): string {
    // dateStr is typically "YYYY-MM-DD" or "Jan 15" format
    if (dateStr.includes("-")) {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            const month = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${months[month - 1]} ${day}`;
        }
    }
    return dateStr;
}

export default function GraphCarouselCard({ loading }: { loading?: boolean }) {
    const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
    const [dailyData, setDailyData] = useState<DailyData[]>([]);
    const [graphLoading, setGraphLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tautulliEnabled, setTautulliEnabled] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>("month");
    const [activeGraph, setActiveGraph] = useState<GraphId>("hourly");

    useEffect(() => {
        loadGraphData();
    }, [timeRange]);

    const loadGraphData = async () => {
        setGraphLoading(true);
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
                setGraphLoading(false);
                return;
            }

            setTautulliEnabled(true);

            const queryDays = TIME_RANGE_DAYS[timeRange];

            // Fetch both datasets in parallel
            const [hourlyResponse, dailyResponse] = await Promise.all([
                fetchWithAuth(`/api/admin/analytics/graph/plays-by-hour?query_days=${queryDays}`),
                fetchWithAuth(`/api/admin/analytics/graph/plays-by-date?query_days=${queryDays}`),
            ]);

            if (!hourlyResponse.ok) {
                throw new Error("Failed to load hourly data");
            }
            if (!dailyResponse.ok) {
                throw new Error("Failed to load daily data");
            }

            const hourlyResult = await hourlyResponse.json();
            const dailyResult = await dailyResponse.json();

            setHourlyData(hourlyResult);
            setDailyData(dailyResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load graph data");
        } finally {
            setGraphLoading(false);
        }
    };

    const navigateGraph = (direction: "prev" | "next") => {
        const currentIndex = GRAPHS.findIndex((g) => g.id === activeGraph);
        if (direction === "prev") {
            const newIndex = currentIndex === 0 ? GRAPHS.length - 1 : currentIndex - 1;
            setActiveGraph(GRAPHS[newIndex].id);
        } else {
            const newIndex = currentIndex === GRAPHS.length - 1 ? 0 : currentIndex + 1;
            setActiveGraph(GRAPHS[newIndex].id);
        }
    };

    const currentGraphInfo = GRAPHS.find((g) => g.id === activeGraph)!;

    // Loading state
    if (loading || graphLoading) {
        return (
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 transition-all duration-300 h-[420px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Graph Analytics
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Loading chart data...
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
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 transition-all duration-300 h-[420px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Graph Analytics
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Viewing trends and patterns
                        </p>
                    </div>
                </div>
                <div className="text-center flex-1 flex flex-col items-center justify-center">
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
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 transition-all duration-300 h-[420px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Graph Analytics
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Viewing trends and patterns
                        </p>
                    </div>
                </div>
                <div className="text-center flex-1 flex flex-col items-center justify-center">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
                    <button
                        onClick={loadGraphData}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Prepare chart data
    const hourlyChartData = hourlyData.map((d) => ({
        ...d,
        label: formatHour(d.hour),
    }));

    const dailyChartData = dailyData.map((d) => ({
        ...d,
        label: formatDate(d.date),
    }));

    const hasHourlyData = hourlyData.some((d) => d.plays > 0);
    const hasDailyData = dailyData.some((d) => d.plays > 0);

    return (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 dark:hover:border-slate-700 transition-all duration-300 h-[420px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        {currentGraphInfo.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        {currentGraphInfo.subtitle}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Time Range Selector */}
                    <Listbox value={timeRange} onChange={setTimeRange}>
                        <div className="relative">
                            <Listbox.Button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 flex items-center gap-1.5">
                                <span>{TIME_RANGE_LABELS[timeRange]}</span>
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                            </Listbox.Button>
                            <Listbox.Options className="absolute z-10 mt-1 right-0 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                {(Object.keys(TIME_RANGE_DAYS) as TimeRange[]).map((range) => (
                                    <Listbox.Option
                                        key={range}
                                        value={range}
                                        className="px-3 py-2 cursor-pointer transition-colors text-xs text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:text-white flex items-center justify-between"
                                    >
                                        {({ selected }) => (
                                            <>
                                                <span className={selected ? "font-semibold" : ""}>
                                                    {TIME_RANGE_LABELS[range]}
                                                </span>
                                                {selected && <Check className="h-3 w-3" />}
                                            </>
                                        )}
                                    </Listbox.Option>
                                ))}
                            </Listbox.Options>
                        </div>
                    </Listbox>

                    {/* Navigation Arrows */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigateGraph("prev")}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Previous graph"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => navigateGraph("next")}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Next graph"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 min-h-0">
                {activeGraph === "hourly" && (
                    hasHourlyData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={hourlyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10 }}
                                    className="text-slate-600 dark:text-slate-400"
                                    interval={2}
                                />
                                <YAxis
                                    tick={{ fontSize: 10 }}
                                    className="text-slate-600 dark:text-slate-400"
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "rgb(30, 41, 59)",
                                        border: "1px solid rgb(51, 65, 85)",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                    }}
                                    labelStyle={{ color: "white", fontWeight: "bold" }}
                                    itemStyle={{ color: "rgb(147, 197, 253)" }}
                                    formatter={(value) => [`${value} plays`, "Plays"]}
                                />
                                <Bar
                                    dataKey="plays"
                                    fill="#195de6"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400">
                            No viewing data available for this time range
                        </div>
                    )
                )}

                {activeGraph === "daily" && (
                    hasDailyData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorPlays" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#195de6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#195de6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10 }}
                                    className="text-slate-600 dark:text-slate-400"
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fontSize: 10 }}
                                    className="text-slate-600 dark:text-slate-400"
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "rgb(30, 41, 59)",
                                        border: "1px solid rgb(51, 65, 85)",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                    }}
                                    labelStyle={{ color: "white", fontWeight: "bold" }}
                                    itemStyle={{ color: "rgb(147, 197, 253)" }}
                                    formatter={(value) => [`${value} plays`, "Plays"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="plays"
                                    stroke="#195de6"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorPlays)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400">
                            No viewing data available for this time range
                        </div>
                    )
                )}
            </div>

            {/* Dot Indicators */}
            <div className="flex items-center justify-center gap-2 mt-3 flex-shrink-0">
                {GRAPHS.map((graph) => (
                    <button
                        key={graph.id}
                        onClick={() => setActiveGraph(graph.id)}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                            activeGraph === graph.id
                                ? "bg-primary w-4"
                                : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
                        }`}
                        title={graph.title}
                    />
                ))}
            </div>
        </div>
    );
}
