import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, Check, ChevronDown, Tv, Eye, EyeOff } from "lucide-react";
import { Listbox } from "@headlessui/react";
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

type TVShow = {
    rating_key: string;
    title: string;
    year: number | null;
    thumb: string | null;
    library: string;
    episode_count: number;
    watched_count: number;
};

type Library = {
    title: string;
    type: string;
};

type WatchHistoryCleanerProps = {
    onClose: () => void;
};

export default function WatchHistoryCleaner({ onClose }: WatchHistoryCleanerProps) {
    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<TVShow[]>([]);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Library filter
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [selectedLibrary, setSelectedLibrary] = useState<string>("all");

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Map<string, TVShow>>(new Map());

    // Update state
    const [updating, setUpdating] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Fetch libraries on mount (only show libraries)
    useEffect(() => {
        fetchWithAuth("/api/collections/libraries")
            .then((r) => r.json())
            .then((data) => {
                const showLibraries = (data.libraries || []).filter(
                    (lib: Library) => lib.type === "show"
                );
                setLibraries(showLibraries);
            })
            .catch((e) => console.error("Failed to fetch libraries:", e));
    }, []);

    // Debounced search
    const performSearch = useCallback(async (query: string, library: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setHasSearched(false);
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

            const response = await fetchWithAuth(`/api/tools/search-shows?${params}`);
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
        const timeoutId = setTimeout(() => {
            performSearch(searchQuery, selectedLibrary);
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, selectedLibrary, performSearch]);

    // Selection handlers
    const toggleSelection = (item: TVShow) => {
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
        const newMap = new Map<string, TVShow>();
        searchResults.forEach((item) => newMap.set(item.rating_key, item));
        setSelectedItems(newMap);
    };

    const clearSelection = () => {
        setSelectedItems(new Map());
    };

    // Mark unwatched handler
    const handleMarkUnwatched = async () => {
        if (selectedItems.size === 0) return;

        setUpdating(true);

        try {
            const items = Array.from(selectedItems.values()).map((item) => ({
                rating_key: item.rating_key,
                library: item.library,
            }));

            const response = await fetchWithAuth("/api/tools/mark-unwatched", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            });

            const data = await response.json();

            if (data.success) {
                setToast({
                    message: `Marked ${data.episodes_updated} episode${data.episodes_updated !== 1 ? "s" : ""} from ${data.shows_updated} show${data.shows_updated !== 1 ? "s" : ""} as unwatched`,
                    type: "success",
                });
                setSelectedItems(new Map());
                // Refresh search results to show updated watch counts
                performSearch(searchQuery, selectedLibrary);
            } else {
                setToast({
                    message: `Updated ${data.shows_updated} show(s), ${data.errors.length} failed`,
                    type: data.shows_updated > 0 ? "success" : "error",
                });
            }
        } catch (e) {
            setToast({ message: `Update failed: ${String(e)}`, type: "error" });
        } finally {
            setUpdating(false);
        }
    };

    // Calculate total watched episodes in selection
    const totalWatchedInSelection = Array.from(selectedItems.values()).reduce(
        (sum, item) => sum + item.watched_count,
        0
    );

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                {/* Header */}
                <DialogHeader>
                    <div>
                        <DialogTitle>Watch History Cleaner</DialogTitle>
                        <DialogDescription>
                            Mark shows as Unwatched to allow them to show up in 'Continue Watching'
                        </DialogDescription>
                    </div>
                    <DialogCloseButton />
                </DialogHeader>

                {/* Search Bar + Library Filter */}
                <div className="p-6 border-b border-slate-800/80 space-y-4">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search TV shows..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </div>
                        <Listbox value={selectedLibrary} onChange={setSelectedLibrary}>
                            <div className="relative">
                                <Listbox.Button className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/70 transition-colors min-w-[160px]">
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
                </div>

                {/* Results Grid */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hover-only">
                    {searching ? (
                        <div className="flex items-center justify-center py-12 text-slate-400">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Searching...
                        </div>
                    ) : searchResults.length > 0 ? (
                        <div className="space-y-4">
                            {/* Selection controls */}
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-400">
                                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        className="text-xs text-primary hover:text-primary/80 transition-colors"
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
                            <div className="grid gap-3">
                                {searchResults.map((item) => {
                                    const isSelected = selectedItems.has(item.rating_key);
                                    const watchProgress = item.episode_count > 0
                                        ? Math.round((item.watched_count / item.episode_count) * 100)
                                        : 0;
                                    return (
                                        <button
                                            key={item.rating_key}
                                            type="button"
                                            onClick={() => toggleSelection(item)}
                                            className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 text-left ${
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
                                                    className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-12 h-16 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <Tv className="h-5 w-5 text-slate-600" />
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-white truncate">
                                                    {item.title}
                                                    {item.year && (
                                                        <span className="text-slate-400 font-normal ml-2">
                                                            ({item.year})
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {item.library}
                                                </p>
                                            </div>

                                            {/* Watch progress */}
                                            <div className="text-right flex-shrink-0">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    {item.watched_count === item.episode_count ? (
                                                        <Eye className="h-3.5 w-3.5 text-green-400" />
                                                    ) : item.watched_count > 0 ? (
                                                        <Eye className="h-3.5 w-3.5 text-amber-400" />
                                                    ) : (
                                                        <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                                                    )}
                                                    <span className={`text-sm font-medium ${
                                                        item.watched_count === item.episode_count
                                                            ? "text-green-400"
                                                            : item.watched_count > 0
                                                                ? "text-amber-400"
                                                                : "text-slate-500"
                                                    }`}>
                                                        {item.watched_count}/{item.episode_count}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {watchProgress}% watched
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : hasSearched ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Search className="h-8 w-8 mb-3 text-slate-600" />
                            <p>No results found</p>
                            <p className="text-sm text-slate-500 mt-1">Try a different search term</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Tv className="h-8 w-8 mb-3 text-slate-600" />
                            <p>Search for TV shows</p>
                            <p className="text-sm text-slate-500 mt-1">
                                Find shows to mark as unwatched for rewatching
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter>
                    <div className="text-sm text-slate-400">
                        <span>{selectedItems.size} show{selectedItems.size !== 1 ? "s" : ""} selected</span>
                        {totalWatchedInSelection > 0 && (
                            <span className="text-slate-500 ml-2">
                                ({totalWatchedInSelection} watched episode{totalWatchedInSelection !== 1 ? "s" : ""})
                            </span>
                        )}
                    </div>
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
                            onClick={handleMarkUnwatched}
                            disabled={selectedItems.size === 0 || updating}
                            className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {updating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <EyeOff className="h-4 w-4" />
                                    Mark as Unwatched
                                </>
                            )}
                        </button>
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
