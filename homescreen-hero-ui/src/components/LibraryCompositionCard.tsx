import { useEffect, useState, useMemo, useRef } from "react";
import { fetchWithAuth } from "../utils/api";
import { Listbox, Dialog } from "@headlessui/react";
import { ChevronDown, Check, ChevronLeft, ChevronRight, Settings, X } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type CompositionSlice = {
    name: string;
    count: number;
};

type CompositionData = {
    library: string;
    total_items: number;
    genres: CompositionSlice[];
    resolutions: CompositionSlice[];
    content_ratings: CompositionSlice[];
};

type LibraryInfo = {
    title: string;
    type: string;
};

const PAGES = [
    { id: "genres", title: "Genre Distribution", subtitle: "Content breakdown by genre" },
    { id: "resolutions", title: "Resolution Breakdown", subtitle: "Video quality distribution" },
    { id: "content_ratings", title: "Content Rating", subtitle: "Age rating distribution" },
] as const;

type PageId = (typeof PAGES)[number]["id"];

const PAGE_IDS = PAGES.map((p) => p.id);

const STORAGE_KEY_PAGE = "libraryComposition.defaultPage";
const STORAGE_KEY_LIBRARY = "libraryComposition.defaultLibrary";

// Palette designed for dark backgrounds
const CHART_COLORS = [
    "#6366f1", // indigo
    "#22d3ee", // cyan
    "#f472b6", // pink
    "#facc15", // yellow
    "#34d399", // emerald
    "#fb923c", // orange
    "#a78bfa", // violet
    "#38bdf8", // sky
    "#f87171", // red
    "#4ade80", // green
];

const MAX_SLICES = 8;

function getStoredPage(): PageId {
    const stored = localStorage.getItem(STORAGE_KEY_PAGE);
    if (stored && PAGE_IDS.includes(stored as PageId)) return stored as PageId;
    return "genres";
}

function getStoredLibrary(): string {
    return localStorage.getItem(STORAGE_KEY_LIBRARY) || "";
}

function prepareChartData(slices: CompositionSlice[]): (CompositionSlice & { color: string })[] {
    if (slices.length <= MAX_SLICES) {
        return slices.map((s, i) => ({ ...s, color: CHART_COLORS[i % CHART_COLORS.length] }));
    }

    const top = slices.slice(0, MAX_SLICES - 1);
    const rest = slices.slice(MAX_SLICES - 1);
    const otherCount = rest.reduce((sum, s) => sum + s.count, 0);

    return [
        ...top.map((s, i) => ({ ...s, color: CHART_COLORS[i % CHART_COLORS.length] })),
        { name: "Other", count: otherCount, color: "#64748b" },
    ];
}

type CustomTooltipProps = {
    active?: boolean;
    payload?: Array<{ payload: CompositionSlice & { color: string } }>;
    total: number;
};

function CustomTooltip({ active, payload, total }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const pct = total > 0 ? ((data.count / total) * 100).toFixed(1) : "0";

    return (
        <div className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 shadow-lg text-xs">
            <p className="font-semibold text-white">{data.name}</p>
            <p className="text-slate-300">
                {data.count.toLocaleString()} items ({pct}%)
            </p>
        </div>
    );
}

export default function LibraryCompositionCard({ loading }: { loading?: boolean }) {
    const [activePage, setActivePage] = useState<PageId>(getStoredPage);
    const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
    const [selectedLibrary, setSelectedLibrary] = useState<string>(getStoredLibrary);
    const [data, setData] = useState<CompositionData | null>(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [defaultPage, setDefaultPage] = useState<PageId>(getStoredPage);
    const [defaultLibrary, setDefaultLibrary] = useState<string>(getStoredLibrary);
    const [contentVisible, setContentVisible] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);
    const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Fetch available libraries on mount
    useEffect(() => {
        const loadLibraries = async () => {
            try {
                const res = await fetchWithAuth("/api/collections/libraries");
                if (!res.ok) throw new Error("Failed to load libraries");
                const result = await res.json();
                setLibraries(result.libraries || []);

                // Set default library if none stored
                if (!selectedLibrary && result.libraries?.length > 0) {
                    setSelectedLibrary(result.libraries[0].title);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load libraries");
            }
        };
        loadLibraries();
    }, []);

    // Fetch composition data when library changes (with fade transition)
    useEffect(() => {
        if (!selectedLibrary) return;

        clearTimeout(fadeTimeoutRef.current);

        const loadComposition = async () => {
            // On initial load, just show spinner. On subsequent switches, fade out first.
            if (!initialLoad) {
                setContentVisible(false);
                // Wait for fade-out before fetching
                await new Promise((r) => { fadeTimeoutRef.current = setTimeout(r, 200); });
            }

            setDataLoading(true);
            setError(null);
            try {
                const res = await fetchWithAuth(
                    `/api/admin/library-stats/composition?library=${encodeURIComponent(selectedLibrary)}`
                );
                if (!res.ok) throw new Error("Failed to load composition data");
                const result = await res.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load composition");
            } finally {
                setDataLoading(false);
                setInitialLoad(false);
                // Small delay so the DOM updates before we fade in
                requestAnimationFrame(() => setContentVisible(true));
            }
        };
        loadComposition();

        return () => clearTimeout(fadeTimeoutRef.current);
    }, [selectedLibrary]);

    const switchPage = (newPageId: PageId) => {
        if (newPageId === activePage) return;
        setContentVisible(false);
        setTimeout(() => {
            setActivePage(newPageId);
            requestAnimationFrame(() => setContentVisible(true));
        }, 200);
    };

    const navigatePage = (direction: "prev" | "next") => {
        const currentIndex = PAGES.findIndex((p) => p.id === activePage);
        if (direction === "prev") {
            const newIndex = currentIndex === 0 ? PAGES.length - 1 : currentIndex - 1;
            switchPage(PAGES[newIndex].id);
        } else {
            const newIndex = currentIndex === PAGES.length - 1 ? 0 : currentIndex + 1;
            switchPage(PAGES[newIndex].id);
        }
    };

    const saveDefaultPage = (pageId: PageId) => {
        localStorage.setItem(STORAGE_KEY_PAGE, pageId);
        setDefaultPage(pageId);
    };

    const saveDefaultLibrary = (lib: string) => {
        localStorage.setItem(STORAGE_KEY_LIBRARY, lib);
        setDefaultLibrary(lib);
    };

    const currentPageInfo = PAGES.find((p) => p.id === activePage)!;

    const activeSlices = useMemo(() => {
        if (!data) return [];
        return data[activePage] || [];
    }, [data, activePage]);

    const chartData = useMemo(() => prepareChartData(activeSlices), [activeSlices]);

    const sliceTotal = useMemo(
        () => activeSlices.reduce((sum, s) => sum + s.count, 0),
        [activeSlices]
    );

    // Loading state (only for initial load - subsequent switches use fade)
    if (loading || (dataLoading && initialLoad)) {
        return (
            <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 px-5 py-4 transition-all duration-300 h-[420px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Library Composition
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">Loading library data...</p>
                    </div>
                </div>
                <div className="flex items-center justify-center flex-1">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 px-5 py-4 transition-all duration-300 h-[420px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Library Composition
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {currentPageInfo.subtitle}
                        </p>
                    </div>
                </div>
                <div className="text-center flex-1 flex flex-col items-center justify-center">
                    <p className="text-sm text-red-400 mb-3">{error}</p>
                    <button
                        onClick={() => setSelectedLibrary((prev) => prev)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 px-5 py-4 transition-all duration-300 hover:bg-slate-800/30 h-[420px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            {currentPageInfo.title}
                        </h3>
                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="p-1 rounded-lg text-slate-400 hover:text-primary transition-all duration-200"
                            title="Composition settings"
                        >
                            <Settings className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {currentPageInfo.subtitle}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Library Picker */}
                    {libraries.length > 1 && (
                        <Listbox value={selectedLibrary} onChange={setSelectedLibrary}>
                            <div className="relative">
                                <Listbox.Button className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/50 bg-slate-800/30 text-slate-300 hover:text-white hover:border-primary/30 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 flex items-center gap-1.5 max-w-[140px]">
                                    <span className="truncate">{selectedLibrary}</span>
                                    <ChevronDown className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                </Listbox.Button>
                                <Listbox.Options className="absolute z-10 mt-1 right-0 w-40 border border-slate-700/50 bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 max-h-60 overflow-auto focus:outline-none">
                                    {libraries.map((lib) => (
                                        <Listbox.Option
                                            key={lib.title}
                                            value={lib.title}
                                            className="px-3 py-2 cursor-pointer transition-all duration-150 text-xs text-slate-300 hover:text-white hover:bg-primary/10 data-[selected]:bg-primary/20 data-[selected]:text-white flex items-center justify-between"
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <span className={selected ? "font-semibold" : ""}>
                                                        {lib.title}
                                                    </span>
                                                    {selected && <Check className="h-3 w-3 text-primary" />}
                                                </>
                                            )}
                                        </Listbox.Option>
                                    ))}
                                </Listbox.Options>
                            </div>
                        </Listbox>
                    )}

                    {/* Navigation Arrows */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigatePage("prev")}
                            className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all duration-200"
                            title="Previous chart"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => navigatePage("next")}
                            className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all duration-200"
                            title="Next chart"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart + Legend */}
            <div className={`flex-1 min-h-0 flex items-center transition-opacity duration-300 ${contentVisible && !dataLoading ? "opacity-100" : "opacity-0"}`}>
                {chartData.length === 0 ? (
                    <div className="flex items-center justify-center w-full text-sm text-slate-400">
                        No data available
                    </div>
                ) : (
                    <div className="flex w-full h-full gap-3">
                        {/* Donut Chart */}
                        <div className="flex-1 min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="55%"
                                        outerRadius="85%"
                                        paddingAngle={2}
                                        dataKey="count"
                                        nameKey="name"
                                        stroke="none"
                                        animationDuration={700}
                                        animationEasing="ease-out"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip total={sliceTotal} />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Legend */}
                        <div className="w-[140px] flex-shrink-0 flex flex-col justify-center overflow-y-auto py-1 gap-1.5">
                            {chartData.map((entry, index) => {
                                const pct = sliceTotal > 0 ? ((entry.count / sliceTotal) * 100).toFixed(0) : "0";
                                return (
                                    <div key={index} className="flex items-center gap-2 min-w-0">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: entry.color }}
                                        />
                                        <span className="text-xs text-slate-300 truncate flex-1">
                                            {entry.name}
                                        </span>
                                        <span className="text-xs text-slate-500 flex-shrink-0">
                                            {pct}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Dot Indicators */}
            <div className="flex items-center justify-center gap-2 mt-3 flex-shrink-0">
                {PAGES.map((page) => (
                    <button
                        key={page.id}
                        onClick={() => switchPage(page.id)}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                            activePage === page.id
                                ? "bg-primary w-4"
                                : "bg-slate-600 hover:bg-slate-500"
                        }`}
                        title={page.title}
                    />
                ))}
            </div>

            {/* Settings Modal */}
            <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                            <Dialog.Title className="text-lg font-bold text-white">
                                Composition Settings
                            </Dialog.Title>
                            <button
                                onClick={() => setSettingsOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">
                                    Default Chart
                                </label>
                                <Listbox value={defaultPage} onChange={saveDefaultPage}>
                                    <div className="relative">
                                        <Listbox.Button className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700/50 bg-slate-800/30 text-slate-300 hover:text-white hover:border-primary/30 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 flex items-center gap-2 min-w-[180px] justify-between">
                                            <span>{PAGES.find((p) => p.id === defaultPage)?.title}</span>
                                            <ChevronDown className="h-4 w-4 text-slate-400" />
                                        </Listbox.Button>
                                        <Listbox.Options className="absolute z-10 mt-1 right-0 w-full border border-slate-700/50 bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 max-h-60 overflow-auto focus:outline-none">
                                            {PAGES.map((page) => (
                                                <Listbox.Option
                                                    key={page.id}
                                                    value={page.id}
                                                    className="px-3 py-2 cursor-pointer transition-all duration-150 text-sm text-slate-300 hover:text-white hover:bg-primary/10 data-[selected]:bg-primary/20 data-[selected]:text-white flex items-center justify-between"
                                                >
                                                    {({ selected }) => (
                                                        <>
                                                            <span className={selected ? "font-semibold" : ""}>
                                                                {page.title}
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
                            {libraries.length > 1 && (
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-slate-300">
                                        Default Library
                                    </label>
                                    <Listbox value={defaultLibrary} onChange={saveDefaultLibrary}>
                                        <div className="relative">
                                            <Listbox.Button className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700/50 bg-slate-800/30 text-slate-300 hover:text-white hover:border-primary/30 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 flex items-center gap-2 min-w-[180px] justify-between">
                                                <span>{defaultLibrary}</span>
                                                <ChevronDown className="h-4 w-4 text-slate-400" />
                                            </Listbox.Button>
                                            <Listbox.Options className="absolute z-10 mt-1 right-0 w-full border border-slate-700/50 bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 max-h-60 overflow-auto focus:outline-none">
                                                {libraries.map((lib) => (
                                                    <Listbox.Option
                                                        key={lib.title}
                                                        value={lib.title}
                                                        className="px-3 py-2 cursor-pointer transition-all duration-150 text-sm text-slate-300 hover:text-white hover:bg-primary/10 data-[selected]:bg-primary/20 data-[selected]:text-white flex items-center justify-between"
                                                    >
                                                        {({ selected }) => (
                                                            <>
                                                                <span className={selected ? "font-semibold" : ""}>
                                                                    {lib.title}
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
                            )}
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </div>
    );
}
