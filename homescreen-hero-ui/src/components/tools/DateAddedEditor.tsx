import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, Check, ChevronDown, ChevronLeft, ChevronRight, Film, CalendarDays } from "lucide-react";
import { Listbox } from "@headlessui/react";
import { format, getMonth, getYear } from "date-fns";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
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

type MediaItem = {
    rating_key: string;
    title: string;
    year: number | null;
    thumb: string | null;
    type: string;
    library: string;
    added_at: string;
    originally_available_at: string | null;
};

type Library = {
    title: string;
    type: string;
};

type DateOption = "specific" | "30-days-ago" | "match-release";

type DateAddedEditorProps = {
    onClose: () => void;
};

export default function DateAddedEditor({ onClose }: DateAddedEditorProps) {
    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Library filter
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [selectedLibrary, setSelectedLibrary] = useState<string>("all");

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Map<string, MediaItem>>(new Map());

    // Date option state
    const [dateOption, setDateOption] = useState<DateOption>("specific");
    const [specificDate, setSpecificDate] = useState<Date | null>(null);

    // Update state
    const [updating, setUpdating] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Fetch recent media (for initial display)
    const fetchRecentMedia = useCallback(async (library: string) => {
        try {
            const params = new URLSearchParams({
                library: library,
                limit: "50",
            });
            const response = await fetchWithAuth(`/api/tools/recent-media?${params}`);
            const data = await response.json();
            return data.items || [];
        } catch (e) {
            console.error("Failed to fetch recent media:", e);
            return [];
        }
    }, []);

    // Fetch libraries and recent media on mount
    useEffect(() => {
        const init = async () => {
            try {
                const libResponse = await fetchWithAuth("/api/collections/libraries");
                const libData = await libResponse.json();
                setLibraries(libData.libraries || []);
            } catch (e) {
                console.error("Failed to fetch libraries:", e);
            }

            // Load recently added items
            const recentItems = await fetchRecentMedia("all");
            setSearchResults(recentItems);
            setInitialLoading(false);
        };

        init();
    }, [fetchRecentMedia]);

    // Debounced search or recent fetch
    const performSearch = useCallback(async (query: string, library: string) => {
        setSearching(true);

        try {
            if (!query.trim()) {
                // No query - fetch recent items
                const recentItems = await fetchRecentMedia(library);
                setSearchResults(recentItems);
            } else {
                // Search with query
                const params = new URLSearchParams({
                    query: query.trim(),
                    library: library,
                    limit: "50",
                });

                const response = await fetchWithAuth(`/api/tools/search-media?${params}`);
                const data = await response.json();
                setSearchResults(data.items || []);
            }
        } catch (e) {
            console.error("Search failed:", e);
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, [fetchRecentMedia]);

    // Re-fetch when search query or library changes (debounced)
    useEffect(() => {
        // Skip during initial load
        if (initialLoading) return;

        const timeoutId = setTimeout(() => {
            performSearch(searchQuery, selectedLibrary);
        }, 400);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, selectedLibrary, performSearch, initialLoading]);

    // Selection handlers
    const toggleSelection = (item: MediaItem) => {
        setSelectedItems((prev) => {
            const newMap = new Map(prev);
            if (newMap.has(item.rating_key)) {
                newMap.delete(item.rating_key);
            } else {
                newMap.set(item.rating_key, item);
            }
            return newMap;
        });
    };

    const selectAll = () => {
        const newMap = new Map<string, MediaItem>();
        searchResults.forEach((item) => newMap.set(item.rating_key, item));
        setSelectedItems(newMap);
    };

    const clearSelection = () => {
        setSelectedItems(new Map());
    };

    // Calculate new date based on option
    const getNewDate = (item: MediaItem): string | null => {
        switch (dateOption) {
            case "specific":
                return specificDate ? format(specificDate, "yyyy-MM-dd") : null;
            case "30-days-ago": {
                const date = new Date();
                date.setDate(date.getDate() - 30);
                return format(date, "yyyy-MM-dd");
            }
            case "match-release":
                if (item.originally_available_at) {
                    return item.originally_available_at.split("T")[0];
                }
                return null;
            default:
                return specificDate ? format(specificDate, "yyyy-MM-dd") : null;
        }
    };

    // Update handler
    const handleUpdate = async () => {
        if (selectedItems.size === 0) return;

        setUpdating(true);

        try {
            const items = Array.from(selectedItems.values())
                .map((item) => {
                    const newDate = getNewDate(item);
                    if (!newDate) return null;
                    return {
                        rating_key: item.rating_key,
                        library: item.library,
                        new_date: newDate,
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            if (items.length === 0) {
                setToast({ message: "No valid dates to update (some items may not have release dates)", type: "error" });
                setUpdating(false);
                return;
            }

            const response = await fetchWithAuth("/api/tools/update-added-at", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            });

            const data = await response.json();

            if (data.success) {
                setToast({ message: `Updated ${data.updated_count} item(s)`, type: "success" });
                setSelectedItems(new Map());
                // Refresh results
                if (searchQuery.trim()) {
                    performSearch(searchQuery, selectedLibrary);
                } else {
                    const recentItems = await fetchRecentMedia(selectedLibrary);
                    setSearchResults(recentItems);
                }
            } else {
                setToast({
                    message: `Updated ${data.updated_count} item(s), ${data.errors.length} failed`,
                    type: data.updated_count > 0 ? "success" : "error",
                });
            }
        } catch (e) {
            setToast({ message: `Update failed: ${String(e)}`, type: "error" });
        } finally {
            setUpdating(false);
        }
    };

    // Format date for display
    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return "Unknown";
        try {
            return new Date(dateStr).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
            });
        } catch {
            return "Unknown";
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent size="wide" className="max-h-[75vh]">
                {/* Header with integrated search */}
                <DialogHeader className="flex-col items-start gap-4 pb-4">
                    <div className="flex items-center justify-between w-full">
                        <div>
                            <DialogTitle>Date Added Editor</DialogTitle>
                            <DialogDescription>
                                Fix 'Date Added' on Movies/Shows that were redownloaded to your Library
                            </DialogDescription>
                        </div>
                        <DialogCloseButton />
                    </div>

                    {/* Search Bar + Library Filter - integrated in header */}
                    <div className="flex gap-3 w-full">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search movies or shows..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70 text-base"
                            />
                        </div>
                        <Listbox value={selectedLibrary} onChange={setSelectedLibrary}>
                            <div className="relative">
                                <Listbox.Button className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/70 transition-colors min-w-[160px]">
                                    <span className="flex-1 text-left">
                                        {selectedLibrary === "all" ? "All Libraries" : selectedLibrary}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                </Listbox.Button>
                                <Listbox.Options className="absolute right-0 z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg focus:outline-none">
                                    <Listbox.Option
                                        value="all"
                                        className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                    >
                                        {({ selected }) => (
                                            <>
                                                <span>All Libraries</span>
                                                {selected && <Check className="h-4 w-4 text-white" />}
                                            </>
                                        )}
                                    </Listbox.Option>
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
                    </div>
                </DialogHeader>

                {/* Results Grid */}
                <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hover-only min-h-[200px] relative">
                    {searchResults.length > 0 ? (
                        <div className={`space-y-3 transition-opacity duration-150 ${searching ? "opacity-50" : ""}`}>
                            {/* Selection controls */}
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-400 flex items-center gap-2">
                                    {searchQuery.trim()
                                        ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`
                                        : `${searchResults.length} recently added`}
                                    {searching && <Loader2 className="h-3 w-3 animate-spin" />}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        className="text-xs text-primary hover:text-blue-400 transition-colors"
                                    >
                                        Select all
                                    </button>
                                    <span className="text-slate-600">|</span>
                                    <button
                                        type="button"
                                        onClick={clearSelection}
                                        className="text-xs text-slate-400 hover:text-white transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Results list */}
                            <div className="grid gap-2">
                                {searchResults.map((item) => {
                                    const isSelected = selectedItems.has(item.rating_key);
                                    return (
                                        <button
                                            key={item.rating_key}
                                            type="button"
                                            onClick={() => toggleSelection(item)}
                                            className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200 text-left ${
                                                isSelected
                                                    ? "border-primary/50 bg-primary/10"
                                                    : "border-slate-800/60 bg-slate-900/50 hover:border-slate-700"
                                            }`}
                                        >
                                            {/* Selection indicator */}
                                            <div
                                                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                    isSelected
                                                        ? "border-primary bg-primary"
                                                        : "border-slate-600"
                                                }`}
                                            >
                                                {isSelected && <Check className="h-3 w-3 text-white" />}
                                            </div>

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

                                            {/* Current date */}
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-xs text-slate-500 uppercase tracking-wide">Added</p>
                                                <p className="text-sm text-slate-300">{formatDate(item.added_at)}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : initialLoading || searching ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Loader2 className="h-10 w-10 mb-3 text-slate-600 animate-spin" />
                            <p>{initialLoading ? "Loading recent items..." : "Searching..."}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Search className="h-10 w-10 mb-3 text-slate-600" />
                            <p>No results found</p>
                            <p className="text-sm text-slate-500 mt-1">
                                {searchQuery.trim() ? "Try a different search term" : "No items found in your library"}
                            </p>
                        </div>
                    )}
                </div>

                {/* Combined Batch Actions + Footer */}
                <DialogFooter className="flex-col gap-4 sm:flex-row sm:items-center bg-slate-950/50">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-slate-400 font-medium shrink-0">Batch Actions</p>

                        {/* Segmented control */}
                        <div className="inline-flex rounded-lg bg-slate-800/80 p-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => setDateOption("specific")}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    dateOption === "specific"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                Custom
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateOption("30-days-ago")}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    dateOption === "30-days-ago"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                30 Days Ago
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateOption("match-release")}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    dateOption === "match-release"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                Release Date
                            </button>
                        </div>

                        {dateOption === "specific" && (
                            <div className="relative shrink-0">
                                <DatePicker
                                    selected={specificDate}
                                    onChange={(date: Date | null) => date && setSpecificDate(date)}
                                    dateFormat="MMMM d, yyyy"
                                    placeholderText="Pick a date"
                                    popperPlacement="top-end"
                                    className="w-[180px] pl-3 pr-8 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/70 placeholder-slate-500"
                                    calendarClassName="hsh-datepicker"
                                    renderCustomHeader={({
                                    date,
                                    changeYear,
                                    changeMonth,
                                    decreaseMonth,
                                    increaseMonth,
                                    prevMonthButtonDisabled,
                                    nextMonthButtonDisabled,
                                }) => {
                                    const months = [
                                        "January", "February", "March", "April", "May", "June",
                                        "July", "August", "September", "October", "November", "December"
                                    ];
                                    const years = Array.from({ length: 50 }, (_, i) => getYear(new Date()) - 40 + i);

                                    return (
                                        <div className="flex items-center justify-between px-2 py-2">
                                            <button
                                                type="button"
                                                onClick={decreaseMonth}
                                                disabled={prevMonthButtonDisabled}
                                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>

                                            <div className="flex items-center gap-2">
                                                <Listbox value={getMonth(date)} onChange={changeMonth}>
                                                    <div className="relative">
                                                        <Listbox.Button className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/70 transition-colors min-w-[100px]">
                                                            <span className="flex-1 text-left">{months[getMonth(date)]}</span>
                                                            <ChevronDown className="h-3 w-3 text-slate-400" />
                                                        </Listbox.Button>
                                                        <Listbox.Options className="absolute left-0 z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg focus:outline-none scrollbar-thin">
                                                            {months.map((month, idx) => (
                                                                <Listbox.Option
                                                                    key={month}
                                                                    value={idx}
                                                                    className="cursor-pointer px-3 py-1.5 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                                                >
                                                                    {({ selected }) => (
                                                                        <>
                                                                            <span>{month}</span>
                                                                            {selected && <Check className="h-3 w-3 text-white" />}
                                                                        </>
                                                                    )}
                                                                </Listbox.Option>
                                                            ))}
                                                        </Listbox.Options>
                                                    </div>
                                                </Listbox>

                                                <Listbox value={getYear(date)} onChange={changeYear}>
                                                    <div className="relative">
                                                        <Listbox.Button className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/70 transition-colors min-w-[70px]">
                                                            <span className="flex-1 text-left">{getYear(date)}</span>
                                                            <ChevronDown className="h-3 w-3 text-slate-400" />
                                                        </Listbox.Button>
                                                        <Listbox.Options className="absolute right-0 z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg focus:outline-none scrollbar-thin">
                                                            {years.map((year) => (
                                                                <Listbox.Option
                                                                    key={year}
                                                                    value={year}
                                                                    className="cursor-pointer px-3 py-1.5 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                                                >
                                                                    {({ selected }) => (
                                                                        <>
                                                                            <span>{year}</span>
                                                                            {selected && <Check className="h-3 w-3 text-white" />}
                                                                        </>
                                                                    )}
                                                                </Listbox.Option>
                                                            ))}
                                                        </Listbox.Options>
                                                    </div>
                                                </Listbox>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={increaseMonth}
                                                disabled={nextMonthButtonDisabled}
                                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    );
                                }}
                                />
                                <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 sm:ml-auto">
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleUpdate}
                                disabled={selectedItems.size === 0 || updating}
                                className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {updating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    "Update Date Added"
                                )}
                            </button>
                        </div>
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
