import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../utils/api";
import { RefreshCw, Plus, X, Search, Trash2, Check, ChevronDown, ArrowUpAZ, ArrowDownAZ, Edit, Image } from "lucide-react";
import { Listbox } from "@headlessui/react";
import Toast from "../components/Toast";

type Collection = {
    title: string;
    library: string;
    poster_url: string | null;
    item_count: number;
    is_active: boolean;
};

type LibraryItem = {
    rating_key: string;
    title: string;
    year: number | null;
    thumb: string | null;
    type: string;
};

type Library = {
    title: string;
    type: string;
};

// Cache configuration
const COLLECTIONS_CACHE_KEY = "homescreen-hero-collections-cache";
const COLLECTIONS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CollectionsCache = {
    data: Collection[];
    timestamp: number;
    version: number;
};

export default function CollectionsPage() {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [selectedLibraryFilter, setSelectedLibraryFilter] = useState<string>("all");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [lastCacheCheck, setLastCacheCheck] = useState<number | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Create collection modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCollectionTitle, setNewCollectionTitle] = useState("");
    const [newCollectionLibrary, setNewCollectionLibrary] = useState("");
    const [newCollectionSummary, setNewCollectionSummary] = useState("");
    const [creating, setCreating] = useState(false);

    // Available libraries
    const [availableLibraries, setAvailableLibraries] = useState<Library[]>([]);
    const [loadingLibraries, setLoadingLibraries] = useState(false);

    // Movie search for create modal
    const [movieSearchQuery, setMovieSearchQuery] = useState("");
    const [movieSearchResults, setMovieSearchResults] = useState<LibraryItem[]>([]);
    const [selectedMovies, setSelectedMovies] = useState<Set<string>>(new Set());
    const [searchLoading, setSearchLoading] = useState(false);

    // Quick edit modal
    const [showQuickEditModal, setShowQuickEditModal] = useState(false);
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
    const [quickEditTitle, setQuickEditTitle] = useState("");
    const [quickEditSummary, setQuickEditSummary] = useState("");
    const [quickEditPosterFile, setQuickEditPosterFile] = useState<File | null>(null);
    const [quickEditPosterUrl, setQuickEditPosterUrl] = useState("");
    const [quickEditCurrentPosterUrl, setQuickEditCurrentPosterUrl] = useState<string | null>(null);
    const [quickEditPosterMode, setQuickEditPosterMode] = useState<"upload" | "url">("upload");
    const [quickEditing, setQuickEditing] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        loadCollections();
    }, []);

    // Debounce collections search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300); // 300ms delay

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    // Debounce movie search
    useEffect(() => {
        if (!newCollectionLibrary) return;

        const timeoutId = setTimeout(() => {
            searchMovies(movieSearchQuery);
        }, 300); // 300ms delay

        return () => clearTimeout(timeoutId);
    }, [movieSearchQuery, newCollectionLibrary]);

    // Load available libraries when modal opens
    useEffect(() => {
        if (showCreateModal && availableLibraries.length === 0) {
            loadAvailableLibraries();
        }
    }, [showCreateModal]);

    const loadAvailableLibraries = async () => {
        try {
            setLoadingLibraries(true);
            const response = await fetchWithAuth("/api/collections/libraries");
            const data = await response.json();
            setAvailableLibraries(data.libraries);
        } catch (err) {
            console.error("Failed to load libraries:", err);
            setToast({ message: "Failed to load available libraries", type: "error" });
        } finally {
            setLoadingLibraries(false);
        }
    };

    const loadFromCache = async (): Promise<CollectionsCache | null> => {
        try {
            const cached = localStorage.getItem(COLLECTIONS_CACHE_KEY);
            if (!cached) return null;

            const parsedCache: CollectionsCache = JSON.parse(cached);
            const age = Date.now() - parsedCache.timestamp;

            // Check if cache has expired
            if (age > COLLECTIONS_CACHE_TTL_MS) {
                localStorage.removeItem(COLLECTIONS_CACHE_KEY);
                return null;
            }

            // Check if cache version is still valid
            try {
                const versionResponse = await fetchWithAuth("/api/collections/cache-version");
                const versionData = await versionResponse.json();
                if (parsedCache.version !== versionData.version) {
                    console.log("Cache invalidated by server (version mismatch)");
                    localStorage.removeItem(COLLECTIONS_CACHE_KEY);
                    return null;
                }
            } catch (err) {
                console.warn("Failed to check cache version, using cached data anyway:", err);
            }

            return parsedCache;
        } catch (err) {
            console.error("Failed to load from cache:", err);
            return null;
        }
    };

    const saveToCache = async (data: Collection[]) => {
        try {
            // Get current cache version from server
            const versionResponse = await fetchWithAuth("/api/collections/cache-version");
            const versionData = await versionResponse.json();

            const cache: CollectionsCache = {
                data,
                timestamp: Date.now(),
                version: versionData.version,
            };
            localStorage.setItem(COLLECTIONS_CACHE_KEY, JSON.stringify(cache));
            setLastCacheCheck(Date.now());
        } catch (err) {
            console.error("Failed to save to cache:", err);
        }
    };

    const loadCollections = async (forceRefresh = false) => {
        try {
            // Try to load from cache first
            if (!forceRefresh) {
                const cached = await loadFromCache();
                if (cached) {
                    console.log("Loading collections from cache");
                    setCollections(cached.data);
                    setLastCacheCheck(cached.timestamp);
                    setLoading(false);
                    return;
                }
            }

            console.log("Fetching collections from API");
            setLoading(true);
            const response = await fetchWithAuth("/api/collections/all");
            const data = await response.json();
            setCollections(data.collections);
            await saveToCache(data.collections);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load collections");
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        loadCollections(true);
    };

    const searchMovies = async (query: string, libraryName?: string) => {
        // Use provided library name or fall back to state
        const library = libraryName || newCollectionLibrary;

        if (!library.trim()) {
            return;
        }

        try {
            setSearchLoading(true);
            // Clear previous results immediately
            setMovieSearchResults([]);

            const params = new URLSearchParams({
                ...(query && { query }),
            });

            console.log(`Searching library: "${library}" with query: "${query}"`);
            const response = await fetchWithAuth(
                `/api/collections/${encodeURIComponent(library)}/search?${params}`
            );

            if (!response.ok) {
                // Handle library not found or other errors
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || `Library "${newCollectionLibrary}" not found`;
                setToast({ message: errorMessage, type: "error" });
                setMovieSearchResults([]);
                return;
            }

            const data = await response.json();
            console.log(`Received ${data.items.length} items from library "${library}"`);
            if (data.items.length > 0) {
                console.log(`First item: ${data.items[0].title} (type: ${data.items[0].type})`);
            }
            setMovieSearchResults(data.items);
        } catch (err) {
            console.error("Search failed:", err);
            setToast({ message: `Failed to search library "${library}"`, type: "error" });
            setMovieSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    const toggleMovieSelection = (ratingKey: string) => {
        const newSelected = new Set(selectedMovies);
        if (newSelected.has(ratingKey)) {
            newSelected.delete(ratingKey);
        } else {
            newSelected.add(ratingKey);
        }
        setSelectedMovies(newSelected);
    };

    const handleCreateCollection = async () => {
        if (!newCollectionTitle.trim() || !newCollectionLibrary.trim()) {
            setToast({ message: "Title and Library are required", type: "error" });
            return;
        }

        if (selectedMovies.size === 0) {
            setToast({ message: "Please select at least one item for the collection", type: "error" });
            return;
        }

        try {
            setCreating(true);

            // First, create the collection by adding the first selected movie
            const firstMovieKey = Array.from(selectedMovies)[0];
            const firstMovie = movieSearchResults.find(m => m.rating_key === firstMovieKey);

            if (!firstMovie) {
                throw new Error("Selected movie not found");
            }

            // Add the first movie to create the collection
            await fetchWithAuth(
                `/api/collections/${encodeURIComponent(newCollectionLibrary)}/${encodeURIComponent(newCollectionTitle)}/add-item`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rating_key: firstMovieKey }),
                }
            );

            // Add remaining movies if any
            const remainingMovies = Array.from(selectedMovies).slice(1);
            for (const ratingKey of remainingMovies) {
                await fetchWithAuth(
                    `/api/collections/${encodeURIComponent(newCollectionLibrary)}/${encodeURIComponent(newCollectionTitle)}/add-item`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rating_key: ratingKey }),
                    }
                );
            }

            // Set summary if provided
            if (newCollectionSummary.trim()) {
                await fetchWithAuth(
                    `/api/collections/${encodeURIComponent(newCollectionLibrary)}/${encodeURIComponent(newCollectionTitle)}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ summary: newCollectionSummary.trim() }),
                    }
                );
            }

            // Show success toast
            setToast({ message: `Created collection '${newCollectionTitle}' with ${selectedMovies.size} item(s)`, type: "success" });

            // Reset form
            setNewCollectionTitle("");
            setNewCollectionLibrary("");
            setNewCollectionSummary("");
            setMovieSearchQuery("");
            setMovieSearchResults([]);
            setSelectedMovies(new Set());
            setShowCreateModal(false);

            // Refresh collections list and invalidate cache
            await loadCollections(true);
        } catch (err) {
            setToast({
                message: err instanceof Error ? err.message : "Failed to create collection",
                type: "error"
            });
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteCollection = async (library: string, title: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to collection detail

        if (!confirm(`Delete collection "${title}"? This cannot be undone.`)) return;

        try {
            const response = await fetchWithAuth(
                `/api/collections/${encodeURIComponent(library)}/${encodeURIComponent(title)}`,
                {
                    method: "DELETE",
                }
            );

            const data = await response.json();

            // Show success toast
            setToast({ message: data.message || `Deleted collection "${title}"`, type: "success" });

            // Refresh collections list and invalidate cache
            await loadCollections(true);
        } catch (err) {
            setToast({
                message: err instanceof Error ? err.message : "Failed to delete collection",
                type: "error"
            });
        }
    };

    const openQuickEditModal = async (collection: Collection, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to collection detail

        setEditingCollection(collection);
        setQuickEditTitle(collection.title);
        setQuickEditSummary("");
        setQuickEditPosterFile(null);
        setQuickEditPosterUrl("");
        setQuickEditCurrentPosterUrl(collection.poster_url);

        // Fetch full collection details to get summary
        try {
            const response = await fetchWithAuth(
                `/api/collections/${encodeURIComponent(collection.library)}/${encodeURIComponent(collection.title)}`
            );
            const data = await response.json();
            setQuickEditSummary(data.summary || "");
        } catch (err) {
            console.error("Failed to load collection details:", err);
        }

        setShowQuickEditModal(true);
    };

    const closeQuickEditModal = () => {
        setShowQuickEditModal(false);
        setEditingCollection(null);
        setQuickEditTitle("");
        setQuickEditSummary("");
        setQuickEditPosterFile(null);
        setQuickEditPosterUrl("");
        setQuickEditCurrentPosterUrl(null);
        setQuickEditPosterMode("upload");
    };

    const handleQuickEditSubmit = async () => {
        if (!editingCollection) return;

        try {
            setQuickEditing(true);

            // Update title and summary if changed
            if (quickEditTitle.trim() !== editingCollection.title || quickEditSummary.trim() !== "") {
                await fetchWithAuth(
                    `/api/collections/${encodeURIComponent(editingCollection.library)}/${encodeURIComponent(editingCollection.title)}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: quickEditTitle.trim(),
                            summary: quickEditSummary.trim() || null,
                        }),
                    }
                );
            }

            // Upload poster if provided
            if (quickEditPosterFile || quickEditPosterUrl) {
                const formData = new FormData();
                if (quickEditPosterFile) {
                    formData.append("file", quickEditPosterFile);
                } else if (quickEditPosterUrl) {
                    formData.append("url", quickEditPosterUrl);
                }

                const titleForPosterUpload = quickEditTitle.trim() || editingCollection.title;
                await fetchWithAuth(
                    `/api/collections/${encodeURIComponent(editingCollection.library)}/${encodeURIComponent(titleForPosterUpload)}/upload-poster`,
                    {
                        method: "POST",
                        body: formData,
                    }
                );
            }

            setToast({ message: "Collection updated successfully", type: "success" });
            closeQuickEditModal();
            await loadCollections(true);
        } catch (err) {
            setToast({
                message: err instanceof Error ? err.message : "Failed to update collection",
                type: "error"
            });
        } finally {
            setQuickEditing(false);
        }
    };

    const handleQuickEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setQuickEditPosterFile(file);
            setQuickEditPosterUrl("");
        }
    };

    // Get unique libraries from collections
    const uniqueLibraries = Array.from(new Set(collections.map((col) => col.library))).sort();

    const filteredCollections = collections
        .filter((col) => {
            const matchesSearch = col.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
            const matchesLibrary = selectedLibraryFilter === "all" || col.library === selectedLibraryFilter;
            return matchesSearch && matchesLibrary;
        })
        .sort((a, b) => {
            const comparison = a.title.localeCompare(b.title);
            return sortOrder === "asc" ? comparison : -comparison;
        });

    const handleCollectionClick = (collection: Collection) => {
        navigate(
            `/collections/${encodeURIComponent(collection.library)}/${encodeURIComponent(collection.title)}`
        );
    };

    const cacheAge = lastCacheCheck ? Math.floor((Date.now() - lastCacheCheck) / 1000) : null;
    const cacheAgeText =
        cacheAge !== null
            ? cacheAge < 60
                ? `${cacheAge}s ago`
                : `${Math.floor(cacheAge / 60)}m ago`
            : "";

    if (loading && collections.length === 0) {
        return (
            <div className="p-8">
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="h-9 w-48 bg-gray-800 rounded animate-pulse"></div>
                        <div className="h-10 w-40 bg-gray-800 rounded animate-pulse"></div>
                    </div>
                    <div className="h-10 w-full max-w-md bg-gray-800 rounded animate-pulse"></div>
                </div>

                {/* Loading Skeleton Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {Array.from({ length: 15 }).map((_, i) => (
                        <div key={i} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                            {/* Poster skeleton */}
                            <div className="aspect-[2/3] bg-gray-700"></div>
                            {/* Info skeleton */}
                            <div className="p-3 space-y-2">
                                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }


    if (error) {
        return (
            <div className="p-8">
                <div className="text-red-400">Error: {error}</div>
                <button
                    onClick={handleRefresh}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-3xl font-bold text-white">Collections</h1>

                    <div className="flex items-center gap-3">
                        {/* Create Collection Button */}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            <Plus size={18} />
                            Create Collection
                        </button>

                        {/* Refresh Button */}
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Refresh collections"
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            <span className="text-sm">
                                {loading ? "Refreshing..." : cacheAgeText ? `Updated ${cacheAgeText}` : "Refresh"}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Search and Filter Bar */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search collections..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Library Filter Dropdown */}
                    <Listbox value={selectedLibraryFilter} onChange={setSelectedLibraryFilter}>
                        <div className="relative">
                            <Listbox.Button className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors min-w-[140px]">
                                <span className="flex-1 text-left text-sm">
                                    {selectedLibraryFilter === "all" ? "All Libraries" : selectedLibraryFilter}
                                </span>
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                            </Listbox.Button>
                            <Listbox.Options className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-lg focus:outline-none max-h-60 overflow-auto">
                                <Listbox.Option
                                    value="all"
                                    className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-gray-700 data-[selected]:bg-blue-600 data-[selected]:font-semibold flex items-center justify-between"
                                >
                                    {({ selected }) => (
                                        <>
                                            <span>All Libraries</span>
                                            {selected && <Check className="h-4 w-4 text-white" />}
                                        </>
                                    )}
                                </Listbox.Option>
                                {uniqueLibraries.map((library) => (
                                    <Listbox.Option
                                        key={library}
                                        value={library}
                                        className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-gray-700 data-[selected]:bg-blue-600 data-[selected]:font-semibold flex items-center justify-between"
                                    >
                                        {({ selected }) => (
                                            <>
                                                <span>{library}</span>
                                                {selected && <Check className="h-4 w-4 text-white" />}
                                            </>
                                        )}
                                    </Listbox.Option>
                                ))}
                            </Listbox.Options>
                        </div>
                    </Listbox>

                    {/* Sort Order Toggle */}
                    <button
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        title={sortOrder === "asc" ? "Sort Z-A" : "Sort A-Z"}
                    >
                        {sortOrder === "asc" ? (
                            <ArrowUpAZ className="h-5 w-5" />
                        ) : (
                            <ArrowDownAZ className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Collections Grid */}
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 p-2">
                {filteredCollections.map((collection, index) => (
                    <button
                        key={`${collection.library}-${collection.title}`}
                        onClick={() => handleCollectionClick(collection)}
                        className="group relative bg-gray-800 rounded-lg overflow-visible hover:ring-2 hover:ring-blue-500 hover:-translate-y-1 hover:scale-105 hover:shadow-xl transition-all duration-200 animate-slide-up"
                        style={{ animationDelay: `${index * 0.03}s` }}
                    >
                        {/* Poster Image */}
                        <div className="aspect-[2/3] bg-gray-900 relative overflow-hidden rounded-t-lg">
                            {collection.poster_url ? (
                                <img
                                    src={collection.poster_url}
                                    alt={collection.title}
                                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600">
                                    No Poster
                                </div>
                            )}

                            {/* Edit Button (shown on hover, top-left) */}
                            <button
                                onClick={(e) => openQuickEditModal(collection, e)}
                                className="absolute top-2 left-2 p-2 bg-blue-600/70 hover:bg-blue-700/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title="Edit collection"
                            >
                                <Edit size={16} />
                            </button>

                            {/* Item Count Badge Overlay */}
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-900/60 text-gray-300 border border-gray-700/50 backdrop-blur-sm">
                                    {collection.item_count} items
                                </span>
                            </div>

                            {/* Active Badge Overlay */}
                            {collection.is_active && (
                                <div className="absolute bottom-2 left-2">
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-900/70 text-green-400 border border-green-800/50 backdrop-blur-sm">
                                        Active
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Delete Button (shown on hover, top-right) */}
                        <button
                            onClick={(e) => handleDeleteCollection(collection.library, collection.title, e)}
                            className="absolute top-2 right-2 p-2 bg-red-600/70 hover:bg-red-700/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            title="Delete collection"
                        >
                            <Trash2 size={16} />
                        </button>

                        {/* Collection Info */}
                        <div className="p-2">
                            <h3 className="text-white font-medium text-sm truncate text-center">
                                {collection.title}
                            </h3>
                            <p className="text-gray-400 text-xs text-center mt-1">
                                {collection.library}
                            </p>
                        </div>
                    </button>
                ))}
            </div>

            {filteredCollections.length === 0 && (
                <div className="text-center text-gray-400 mt-12">
                    {searchQuery ? "No collections found matching your search" : "No collections found"}
                </div>
            )}

            {/* Quick Edit Modal */}
            {showQuickEditModal && editingCollection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#1a1d29] rounded-lg max-w-3xl w-full">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h2 className="text-xl font-semibold text-white">Edit Collection Details</h2>
                            <button
                                onClick={closeQuickEditModal}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6">
                            <div className="grid grid-cols-[200px_1fr] gap-6">
                                {/* Left Column - Poster Preview */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                                        Cover Poster
                                    </label>

                                    {/* Poster Preview */}
                                    <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden border-2 border-dashed border-gray-700">
                                        {quickEditCurrentPosterUrl ? (
                                            <img
                                                src={quickEditCurrentPosterUrl}
                                                alt="Current poster"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                No Poster
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-xs text-gray-500 mt-2">
                                        Recommended: 600×900px (JPG/PNG)
                                    </p>
                                </div>

                                {/* Right Column - Text Fields & Poster Upload */}
                                <div className="space-y-4">
                                    {/* Title */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                                            Collection Name
                                        </label>
                                        <input
                                            type="text"
                                            value={quickEditTitle}
                                            onChange={(e) => setQuickEditTitle(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                        />
                                    </div>

                                    {/* Summary */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                                            Brief Summary
                                        </label>
                                        <textarea
                                            value={quickEditSummary}
                                            onChange={(e) => setQuickEditSummary(e.target.value)}
                                            rows={4}
                                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            placeholder="Enter a brief description of this collection..."
                                        />
                                    </div>

                                    {/* Poster Upload Options */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                                            Update Poster
                                        </label>

                                        {/* Tab Switcher */}
                                        <div className="flex gap-2 mb-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setQuickEditPosterMode("upload");
                                                    setQuickEditPosterUrl("");
                                                }}
                                                className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                                                    quickEditPosterMode === "upload"
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                                                }`}
                                            >
                                                Upload File
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setQuickEditPosterMode("url");
                                                    setQuickEditPosterFile(null);
                                                }}
                                                className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                                                    quickEditPosterMode === "url"
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                                                }`}
                                            >
                                                From URL
                                            </button>
                                        </div>

                                        {/* Upload Mode */}
                                        {quickEditPosterMode === "upload" && (
                                            <label className="block cursor-pointer">
                                                <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-gray-600 transition-colors">
                                                    <Image size={20} className="mx-auto mb-2 text-gray-400" />
                                                    <span className="text-xs text-gray-400">
                                                        {quickEditPosterFile ? quickEditPosterFile.name : "Click to select file"}
                                                    </span>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleQuickEditFileSelect}
                                                    className="hidden"
                                                />
                                            </label>
                                        )}

                                        {/* URL Mode */}
                                        {quickEditPosterMode === "url" && (
                                            <div>
                                                <input
                                                    type="url"
                                                    value={quickEditPosterUrl}
                                                    onChange={(e) => setQuickEditPosterUrl(e.target.value)}
                                                    placeholder="https://example.com/poster.jpg"
                                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <p className="text-xs text-gray-500 mt-2">
                                                    e.g., from ThePosterDB.com
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
                            <button
                                onClick={closeQuickEditModal}
                                disabled={quickEditing}
                                className="px-4 py-2 bg-transparent hover:bg-gray-800 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleQuickEditSubmit}
                                disabled={quickEditing || !quickEditTitle.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="text-lg">💾</span>
                                {quickEditing ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Collection Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col p-6">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">Create Collection</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="space-y-4 mb-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Collection Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={newCollectionTitle}
                                        onChange={(e) => setNewCollectionTitle(e.target.value)}
                                        placeholder="e.g., Best of 2024"
                                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Library Name *
                                    </label>
                                    <Listbox
                                        value={newCollectionLibrary}
                                        onChange={(newLibrary) => {
                                            setNewCollectionLibrary(newLibrary);
                                            // Clear search results and selections when library changes
                                            setMovieSearchResults([]);
                                            setSelectedMovies(new Set());
                                            setMovieSearchQuery("");
                                            // Auto-load items from the selected library
                                            if (newLibrary) {
                                                searchMovies("", newLibrary);
                                            }
                                        }}
                                        disabled={loadingLibraries}
                                    >
                                        <div className="relative">
                                            <Listbox.Button className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-left flex items-center justify-between data-[disabled]:opacity-50">
                                                <span className={newCollectionLibrary ? "" : "text-gray-400"}>
                                                    {loadingLibraries
                                                        ? "Loading libraries..."
                                                        : newCollectionLibrary || "Select a library..."}
                                                </span>
                                                <ChevronDown size={16} className="text-gray-400" />
                                            </Listbox.Button>

                                            <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                                {availableLibraries.map((library) => (
                                                    <Listbox.Option
                                                        key={library.title}
                                                        value={library.title}
                                                        className="px-4 py-2 cursor-pointer transition-colors data-[focus]:bg-gray-700"
                                                    >
                                                        <div className="flex items-center justify-between text-white">
                                                            <span className="data-[selected]:font-medium">{library.title}</span>
                                                            <Check size={16} className="text-blue-500 invisible data-[selected]:visible" />
                                                        </div>
                                                    </Listbox.Option>
                                                ))}
                                            </Listbox.Options>
                                        </div>
                                    </Listbox>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Summary (Optional)
                                </label>
                                <textarea
                                    value={newCollectionSummary}
                                    onChange={(e) => setNewCollectionSummary(e.target.value)}
                                    placeholder="Add a description for this collection..."
                                    rows={2}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            {/* Search for movies */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Add Items to Collection * (Select at least one)
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        placeholder={newCollectionLibrary ? "Search your library..." : "Enter a library name first..."}
                                        value={movieSearchQuery}
                                        onChange={(e) => setMovieSearchQuery(e.target.value)}
                                        disabled={!newCollectionLibrary}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Movie Selection Grid */}
                        <div className="flex-1 overflow-y-auto mb-4 scrollbar-hover-only">
                            {searchLoading ? (
                                <div className="text-gray-400 text-center py-8">Loading...</div>
                            ) : movieSearchResults.length > 0 ? (
                                <div>
                                    <p className="text-sm text-gray-400 mb-3">
                                        {selectedMovies.size} item(s) selected
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {movieSearchResults.map((item) => (
                                            <button
                                                key={item.rating_key}
                                                onClick={() => toggleMovieSelection(item.rating_key)}
                                                className={`bg-gray-800 rounded-lg overflow-hidden transition-all ${
                                                    selectedMovies.has(item.rating_key)
                                                        ? "ring-2 ring-blue-500"
                                                        : "hover:ring-2 hover:ring-gray-600"
                                                }`}
                                            >
                                                {/* Poster */}
                                                <div className="aspect-[2/3] bg-gray-900 relative">
                                                    {item.thumb ? (
                                                        <img
                                                            src={item.thumb}
                                                            alt={item.title}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                                                            No Poster
                                                        </div>
                                                    )}
                                                    {selectedMovies.has(item.rating_key) && (
                                                        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="p-2">
                                                    <h3 className="text-white font-medium text-xs truncate">{item.title}</h3>
                                                    {item.year && <p className="text-gray-400 text-xs">{item.year}</p>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : newCollectionLibrary.trim() ? (
                                <div className="text-gray-400 text-center py-8">
                                    {movieSearchQuery ? "No results found" : "No items found in this library"}
                                </div>
                            ) : (
                                <div className="text-gray-400 text-center py-8">
                                    Enter a library name to see available items
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between gap-3 border-t border-gray-800 pt-4">
                            <p className="text-sm text-gray-400">
                                {selectedMovies.size === 0
                                    ? "Select at least one item to create the collection"
                                    : `${selectedMovies.size} item(s) selected`}
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        // Reset form
                                        setNewCollectionTitle("");
                                        setNewCollectionLibrary("");
                                        setNewCollectionSummary("");
                                        setMovieSearchQuery("");
                                        setMovieSearchResults([]);
                                        setSelectedMovies(new Set());
                                    }}
                                    disabled={creating}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateCollection}
                                    disabled={creating || !newCollectionTitle.trim() || !newCollectionLibrary.trim() || selectedMovies.size === 0}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {creating ? "Creating..." : "Create Collection"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
