import { useState, useEffect } from "react";
import {
    Loader2,
    Check,
    ChevronDown,
    Film,
    CalendarIcon,
    Download,
    AlertTriangle,
    FileSearch,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Listbox } from "@headlessui/react";
import { format } from "date-fns";
import { fetchWithAuth } from "../../utils/api";
import Toast from "../Toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    DialogCloseButton,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

type UnwatchedItem = {
    rating_key: string;
    title: string;
    year: number | null;
    thumb: string | null;
    type: string;
    library: string;
    added_at: string | null;
    last_watched_at: string | null;
    total_plays: number;
};

type Library = {
    title: string;
    type: string;
};

type UnwatchedMode = "never_watched" | "not_watched_since";
type TimePeriod = "30d" | "90d" | "6m" | "1y" | "all" | "custom";

type UnwatchedReportProps = {
    onClose: () => void;
};

export default function UnwatchedReport({ onClose }: UnwatchedReportProps) {
    // Configuration state
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [selectedLibrary, setSelectedLibrary] = useState<string>("");
    const [unwatchedMode, setUnwatchedMode] = useState<UnwatchedMode>("never_watched");
    const [timePeriod, setTimePeriod] = useState<TimePeriod>("30d");
    const [customDate, setCustomDate] = useState<Date>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date;
    });
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState<Date>(customDate);

    // Report state
    const [items, setItems] = useState<UnwatchedItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [timeDescription, setTimeDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [hasGenerated, setHasGenerated] = useState(false);

    // UI state
    const [tautulliEnabled, setTautulliEnabled] = useState<boolean | null>(null);
    const [exporting, setExporting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Check Tautulli status on mount
    useEffect(() => {
        const checkTautulli = async () => {
            try {
                const response = await fetchWithAuth("/api/admin/integrations/health");
                const data = await response.json();
                const tautulli = data.integrations?.find(
                    (i: { name: string }) => i.name === "Tautulli"
                );
                setTautulliEnabled(tautulli?.enabled && tautulli?.ok);
            } catch {
                setTautulliEnabled(false);
            }
        };
        checkTautulli();
    }, []);

    // Fetch libraries on mount
    useEffect(() => {
        fetchWithAuth("/api/collections/libraries")
            .then((r) => r.json())
            .then((data) => {
                const libs = data.libraries || [];
                setLibraries(libs);
                if (libs.length > 0) {
                    setSelectedLibrary(libs[0].title);
                }
            })
            .catch((e) => console.error("Failed to fetch libraries:", e));
    }, []);

    // Build request payload
    const buildRequestPayload = (pageNum: number = 1) => {
        const payload: Record<string, unknown> = {
            library: selectedLibrary,
            unwatched_mode: unwatchedMode,
            page: pageNum,
            page_size: 50,
        };

        if (unwatchedMode === "not_watched_since") {
            payload.time_period = timePeriod;
            if (timePeriod === "custom") {
                payload.custom_start_date = format(customDate, "yyyy-MM-dd");
            }
        }

        return payload;
    };

    // Generate report
    const handleGenerate = async (pageNum: number = 1) => {
        if (!selectedLibrary || !tautulliEnabled) return;

        setLoading(true);
        setHasGenerated(true);

        try {
            const response = await fetchWithAuth("/api/tools/unwatched-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildRequestPayload(pageNum)),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Failed to generate report");
            }

            const data = await response.json();
            setItems(data.items || []);
            setTotalCount(data.total_count);
            setPage(data.page);
            setTotalPages(data.total_pages);
            setTimeDescription(data.time_period_description);
        } catch (e) {
            setToast({ message: `Failed to generate report: ${String(e)}`, type: "error" });
            setItems([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    // Handle page change
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            handleGenerate(newPage);
        }
    };

    // Export to CSV
    const handleExport = async () => {
        if (!selectedLibrary || !tautulliEnabled) return;

        setExporting(true);

        try {
            const response = await fetchWithAuth("/api/tools/unwatched-report/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildRequestPayload(1)),
            });

            if (!response.ok) {
                throw new Error("Export failed");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            // Get filename from Content-Disposition header
            const disposition = response.headers.get("Content-Disposition");
            const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
            a.download = filenameMatch?.[1] || "unwatched_report.csv";

            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            setToast({ message: `Exported ${totalCount} items to CSV`, type: "success" });
        } catch (e) {
            setToast({ message: `Export failed: ${String(e)}`, type: "error" });
        } finally {
            setExporting(false);
        }
    };

    // Format date for display
    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return "—";
        try {
            return new Date(dateStr).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
            });
        } catch {
            return "—";
        }
    };

    const timePeriods = [
        { value: "30d", label: "30 days" },
        { value: "90d", label: "90 days" },
        { value: "6m", label: "6 months" },
        { value: "1y", label: "1 year" },
        { value: "all", label: "All time" },
        { value: "custom", label: "Custom" },
    ];

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent size="wide">
                {/* Header */}
                <DialogHeader className="flex-col items-start gap-4 pb-4">
                    <div className="flex items-center justify-between w-full">
                        <div>
                            <DialogTitle>Unwatched Report</DialogTitle>
                            <DialogDescription>
                                Find movies and shows that haven't been watched and export results as CSV
                            </DialogDescription>
                        </div>
                        <DialogCloseButton />
                    </div>

                    {/* Tautulli Warning */}
                    {tautulliEnabled === false && (
                        <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-amber-200 font-medium">Tautulli Required</p>
                                <p className="text-amber-300/70 text-sm mt-1">
                                    This tool requires Tautulli integration to access watch history.
                                    Please enable Tautulli in your integrations settings.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Configuration Panel */}
                    {tautulliEnabled !== false && (
                        <div className="w-full space-y-4">
                            {/* Library + Mode Row */}
                            <div className="flex flex-wrap gap-3 items-center">
                                {/* Library Dropdown */}
                                <Listbox value={selectedLibrary} onChange={setSelectedLibrary}>
                                    <div className="relative">
                                        <Listbox.Button className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/70 transition-colors min-w-[180px]">
                                            <span className="flex-1 text-left">
                                                {selectedLibrary || "Select Library"}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-slate-400" />
                                        </Listbox.Button>
                                        <Listbox.Options className="absolute left-0 z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg focus:outline-none">
                                            {libraries.map((lib) => (
                                                <Listbox.Option
                                                    key={lib.title}
                                                    value={lib.title}
                                                    className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                                >
                                                    {({ selected }) => (
                                                        <>
                                                            <span>{lib.title}</span>
                                                            {selected && <Check className="h-4 w-4 text-white" />}
                                                        </>
                                                    )}
                                                </Listbox.Option>
                                            ))}
                                        </Listbox.Options>
                                    </div>
                                </Listbox>

                                {/* Mode Toggle */}
                                <div className="inline-flex rounded-lg bg-slate-800/80 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setUnwatchedMode("never_watched")}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                            unwatchedMode === "never_watched"
                                                ? "bg-primary text-white shadow-sm"
                                                : "text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        Never Watched
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUnwatchedMode("not_watched_since")}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                            unwatchedMode === "not_watched_since"
                                                ? "bg-primary text-white shadow-sm"
                                                : "text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        Not Watched Since
                                    </button>
                                </div>
                            </div>

                            {/* Time Period Row (only for not_watched_since mode) */}
                            {unwatchedMode === "not_watched_since" && (
                                <div className="flex flex-wrap gap-3 items-center">
                                    <span className="text-sm text-slate-400">Time period:</span>
                                    <div className="inline-flex rounded-lg bg-slate-800/80 p-1">
                                        {timePeriods.map((period) => (
                                            <button
                                                key={period.value}
                                                type="button"
                                                onClick={() => setTimePeriod(period.value as TimePeriod)}
                                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                                    timePeriod === period.value
                                                        ? "bg-primary text-white shadow-sm"
                                                        : "text-slate-400 hover:text-white"
                                                }`}
                                            >
                                                {period.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Date Picker */}
                                    {timePeriod === "custom" && (
                                        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="min-w-[180px] justify-start text-left font-normal"
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {format(customDate, "PPP")}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={customDate}
                                                    captionLayout="dropdown"
                                                    month={calendarMonth}
                                                    onMonthChange={setCalendarMonth}
                                                    onSelect={(date) => {
                                                        if (date) {
                                                            setCustomDate(date);
                                                            setCalendarOpen(false);
                                                        }
                                                    }}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                </div>
                            )}

                            {/* Generate Button */}
                            <Button
                                onClick={() => handleGenerate(1)}
                                disabled={!selectedLibrary || loading || tautulliEnabled === null}
                                className="w-full sm:w-auto"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <FileSearch className="h-4 w-4 mr-2" />
                                        Generate Report
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </DialogHeader>

                {/* Results */}
                <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hover-only min-h-[300px]">
                    {hasGenerated && items.length > 0 ? (
                        <div className={`space-y-3 transition-opacity duration-150 ${loading ? "opacity-50" : ""}`}>
                            {/* Summary */}
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-400">
                                    Found <span className="text-white font-medium">{totalCount}</span> unwatched item{totalCount !== 1 ? "s" : ""}
                                    {loading && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}
                                </p>
                                <p className="text-xs text-slate-500">{timeDescription}</p>
                            </div>

                            {/* Results Grid */}
                            <div className="grid gap-2">
                                {items.map((item) => (
                                    <div
                                        key={item.rating_key}
                                        className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-800/60 bg-slate-900/50"
                                    >
                                        {/* Poster */}
                                        {item.thumb ? (
                                            <img
                                                src={item.thumb}
                                                alt={item.title}
                                                className="w-10 h-14 object-cover rounded flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-10 h-14 bg-slate-800 rounded flex items-center justify-center flex-shrink-0">
                                                <Film className="h-4 w-4 text-slate-600" />
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-white truncate text-sm">
                                                {item.title}
                                                {item.year && (
                                                    <span className="text-slate-400 font-normal ml-1.5">
                                                        ({item.year})
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {item.library} · {item.type}
                                            </p>
                                        </div>

                                        {/* Added date */}
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">Added</p>
                                            <p className="text-sm text-slate-300">{formatDate(item.added_at)}</p>
                                        </div>

                                        {/* Last watched */}
                                        <div className="text-right flex-shrink-0 min-w-[100px]">
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">Last Watched</p>
                                            <p className={`text-sm ${item.last_watched_at ? "text-slate-300" : "text-slate-500"}`}>
                                                {item.last_watched_at ? formatDate(item.last_watched_at) : "Never"}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(page - 1)}
                                        disabled={page <= 1 || loading}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm text-slate-400">
                                        Page {page} of {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(page + 1)}
                                        disabled={page >= totalPages || loading}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : hasGenerated && !loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Check className="h-12 w-12 mb-3 text-green-500" />
                            <p className="text-lg font-medium text-white">All caught up!</p>
                            <p className="text-sm text-slate-500 mt-1">
                                No unwatched items found in {selectedLibrary}
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Loader2 className="h-10 w-10 mb-3 text-slate-600 animate-spin" />
                            <p>Analyzing watch history...</p>
                            <p className="text-sm text-slate-500 mt-1">This may take a moment for large libraries</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <FileSearch className="h-12 w-12 mb-3 text-slate-600" />
                            <p className="text-lg font-medium">Generate a report</p>
                            <p className="text-sm text-slate-500 mt-1">
                                Select a library and click Generate Report to find unwatched content
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="bg-slate-950/50">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        {hasGenerated && totalCount > 0 && (
                            <span>{totalCount} unwatched item{totalCount !== 1 ? "s" : ""}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {hasGenerated && totalCount > 0 && (
                            <Button
                                variant="outline"
                                onClick={handleExport}
                                disabled={exporting}
                            >
                                {exporting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Exporting...
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4 mr-2" />
                                        Export CSV
                                    </>
                                )}
                            </Button>
                        )}
                        <Button variant="ghost" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </Dialog>
    );
}
