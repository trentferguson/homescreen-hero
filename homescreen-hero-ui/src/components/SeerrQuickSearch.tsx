import { useState, useEffect } from "react";
import { fetchWithAuth } from "../utils/api";
import { Search, X, Film, Tv, Loader2 } from "lucide-react";
import type { SeerrSearchResult, SeerrSearchResponse, SeerrMediaStatus } from "../types/seerr";
import { SEERR_MEDIA_STATUS_COLORS, SEERR_MEDIA_STATUS_LABELS } from "../types/seerr";
import SeerrNewRequestModal from "./SeerrNewRequestModal";

type Props = {
    onRequestCreated: () => void;
    seerrBaseUrl: string;
};

function MediaStatusPill({ status }: { status: SeerrMediaStatus }) {
    const colors = SEERR_MEDIA_STATUS_COLORS[status] || {
        bg: "bg-slate-500/15",
        text: "text-slate-300",
        border: "ring-slate-500/30",
    };
    const label = SEERR_MEDIA_STATUS_LABELS[status] || "Unknown";
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${colors.bg} ${colors.text} ${colors.border}`}
        >
            {label}
        </span>
    );
}

function SkeletonItem() {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-800/30 p-2.5 animate-pulse">
            <div className="h-14 w-10 rounded bg-slate-700 flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-slate-800" />
                <div className="h-2.5 w-1/3 rounded bg-slate-800" />
            </div>
        </div>
    );
}

export default function SeerrQuickSearch({ onRequestCreated, seerrBaseUrl }: Props) {
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [results, setResults] = useState<SeerrSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedResult, setSelectedResult] = useState<SeerrSearchResult | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Perform search when debounced query changes
    useEffect(() => {
        if (debouncedQuery.length >= 2) {
            performSearch(debouncedQuery);
        } else {
            setResults([]);
            setError(null);
        }
    }, [debouncedQuery]);

    const performSearch = async (searchQuery: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetchWithAuth(
                `/api/admin/seerr/search?query=${encodeURIComponent(searchQuery)}`
            );
            if (!response.ok) {
                throw new Error("Search failed");
            }
            const data: SeerrSearchResponse = await response.json();
            setResults(data.results);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Search failed");
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleResultClick = (result: SeerrSearchResult) => {
        setSelectedResult(result);
        setModalOpen(true);
    };

    const handleModalClose = () => {
        setModalOpen(false);
        setSelectedResult(null);
    };

    const handleRequestCreated = () => {
        // Refresh search to update status indicators
        if (debouncedQuery.length >= 2) {
            performSearch(debouncedQuery);
        }
        onRequestCreated();
    };

    const clearSearch = () => {
        setQuery("");
        setDebouncedQuery("");
        setResults([]);
        setError(null);
    };

    const getYear = (dateStr: string | null): string => {
        if (!dateStr) return "";
        const year = new Date(dateStr).getFullYear();
        return isNaN(year) ? "" : String(year);
    };

    return (
        <div className="flex flex-col h-full gap-3">
            {/* Search Input */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {loading ? (
                        <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                    ) : (
                        <Search className="h-4 w-4 text-slate-400" />
                    )}
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search movies & TV shows..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50 focus:border-primary/30 transition-[border-color]"
                />
                {query && (
                    <button
                        onClick={clearSearch}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Results */}
            {loading && results.length === 0 ? (
                <div className="flex-1 min-h-0 space-y-2 overflow-y-auto scrollbar-hover-only pr-1">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <SkeletonItem key={idx} />
                    ))}
                </div>
            ) : error ? (
                <div className="flex-1 min-h-0 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-center text-sm text-red-400">
                    {error}
                </div>
            ) : results.length === 0 && debouncedQuery.length >= 2 ? (
                <div className="flex-1 min-h-0 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-400">
                    No results found for "{debouncedQuery}"
                </div>
            ) : results.length === 0 ? (
                <div className="flex-1 min-h-0 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-8 flex flex-col items-center justify-center">
                    <Search className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">
                        Search for movies or TV shows to request
                    </p>
                </div>
            ) : (
                <ul className="flex-1 min-h-0 space-y-2 overflow-y-auto scrollbar-hover-only pr-1">
                    {results.map((result) => (
                        <li
                            key={`${result.mediaType}-${result.tmdbId}`}
                            onClick={() => handleResultClick(result)}
                            className="group flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-800/30 p-2.5 hover:border-slate-700 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer"
                        >
                            {/* Poster thumbnail */}
                            <div className="flex-shrink-0 w-10 h-14 rounded overflow-hidden bg-slate-700">
                                {result.posterPath ? (
                                    <img
                                        src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        {result.mediaType === "movie" ? (
                                            <Film className="h-5 w-5 text-slate-500" />
                                        ) : (
                                            <Tv className="h-5 w-5 text-slate-500" />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <p
                                        className="text-sm font-semibold text-white truncate"
                                        title={result.title}
                                    >
                                        {result.title}
                                    </p>
                                    {result.mediaStatus && (
                                        <MediaStatusPill status={result.mediaStatus} />
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                    <span className="inline-flex items-center gap-1">
                                        {result.mediaType === "movie" ? (
                                            <Film className="h-3 w-3" />
                                        ) : (
                                            <Tv className="h-3 w-3" />
                                        )}
                                        {result.mediaType === "movie" ? "Movie" : "TV"}
                                    </span>
                                    {result.releaseDate && (
                                        <>
                                            <span className="text-slate-600">·</span>
                                            <span>{getYear(result.releaseDate)}</span>
                                        </>
                                    )}
                                    {result.voteAverage != null && result.voteAverage > 0 && (
                                        <>
                                            <span className="text-slate-600">·</span>
                                            <span>{result.voteAverage.toFixed(1)}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* Request Modal */}
            <SeerrNewRequestModal
                result={selectedResult}
                open={modalOpen}
                onClose={handleModalClose}
                onRequestCreated={handleRequestCreated}
                seerrBaseUrl={seerrBaseUrl}
            />
        </div>
    );
}
