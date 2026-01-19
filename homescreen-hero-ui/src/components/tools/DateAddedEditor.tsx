import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, Check, ChevronDown, Film, CalendarIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

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
    const [hasSearched, setHasSearched] = useState(false);

    // Library filter
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [selectedLibrary, setSelectedLibrary] = useState<string>("all");

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Map<string, MediaItem>>(new Map());

    // Date option state
    const [dateOption, setDateOption] = useState<DateOption>("specific");
    const [specificDate, setSpecificDate] = useState<Date>(() => {
        // Default to 30 days ago
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date;
    });
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState<Date>(specificDate);
    const [dateInputValue, setDateInputValue] = useState(() => format(specificDate, "MMMM dd, yyyy"));

    // Update state
    const [updating, setUpdating] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Fetch libraries on mount
    useEffect(() => {
        fetchWithAuth("/api/collections/libraries")
            .then((r) => r.json())
            .then((data) => setLibraries(data.libraries || []))
            .catch((e) => console.error("Failed to fetch libraries:", e));
    }, []);

    // Debounced search
    const performSearch = useCallback(async (query: string, library: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setHasSearched(false);
            setSearching(false);
            return;
        }

        setSearching(true);
        setHasSearched(true);

        try {
            const params = new URLSearchParams({
                query: query.trim(),
                library: library,
                limit: "50",
            });

            const response = await fetchWithAuth(`/api/tools/search-media?${params}`);
            const data = await response.json();
            setSearchResults(data.items || []);
        } catch (e) {
            console.error("Search failed:", e);
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        // Don't show loading immediately - wait for debounce
        const timeoutId = setTimeout(() => {
            performSearch(searchQuery, selectedLibrary);
        }, 400);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, selectedLibrary, performSearch]);

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
                return format(specificDate, "yyyy-MM-dd");
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
                return format(specificDate, "yyyy-MM-dd");
        }
    };

    // Handle date input change
    const handleDateInputChange = (value: string) => {
        setDateInputValue(value);
        const parsedDate = new Date(value);
        if (!isNaN(parsedDate.getTime())) {
            setSpecificDate(parsedDate);
            setCalendarMonth(parsedDate);
        }
    };

    // Handle calendar date selection
    const handleCalendarSelect = (date: Date | undefined) => {
        if (date) {
            setSpecificDate(date);
            setDateInputValue(format(date, "MMMM dd, yyyy"));
            setCalendarOpen(false);
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
                // Refresh search results
                performSearch(searchQuery, selectedLibrary);
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
            <DialogContent size="wide">
                {/* Header with integrated search */}
                <DialogHeader className="flex-col items-start gap-4 pb-4">
                    <div className="flex items-center justify-between w-full">
                        <div>
                            <DialogTitle>Date Added Editor</DialogTitle>
                            <DialogDescription>
                                Modify when items appear in Recently Added
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
                                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
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
                    ) : searching ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Loader2 className="h-10 w-10 mb-3 text-slate-600 animate-spin" />
                            <p>Searching...</p>
                        </div>
                    ) : hasSearched ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Search className="h-10 w-10 mb-3 text-slate-600" />
                            <p>No results found</p>
                            <p className="text-sm text-slate-500 mt-1">Try a different search term</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Search className="h-12 w-12 mb-3 text-slate-600" />
                            <p className="text-lg font-medium">Search for movies or shows</p>
                            <p className="text-sm text-slate-500 mt-1">
                                Type a title to find items and change their 'Date Added'.
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
                            <div className="relative flex items-center shrink-0">
                                <Input
                                    value={dateInputValue}
                                    placeholder="December 20, 2024"
                                    className="w-[180px] pr-10 bg-slate-800/80 h-8"
                                    onChange={(e) => handleDateInputChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setCalendarOpen(true);
                                        }
                                    }}
                                />
                                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="absolute right-1 h-6 w-6 p-0"
                                        >
                                            <CalendarIcon className="h-3.5 w-3.5" />
                                            <span className="sr-only">Select date</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-auto overflow-hidden p-0"
                                        align="end"
                                        alignOffset={-8}
                                        sideOffset={10}
                                    >
                                        <Calendar
                                            mode="single"
                                            selected={specificDate}
                                            captionLayout="dropdown"
                                            month={calendarMonth}
                                            onMonthChange={setCalendarMonth}
                                            onSelect={handleCalendarSelect}
                                        />
                                    </PopoverContent>
                                </Popover>
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
