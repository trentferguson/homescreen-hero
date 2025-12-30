import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../utils/api";
import { ArrowLeft, Plus, Trash2, Search, Image, Edit, ChevronDown, Check } from "lucide-react";
import { Listbox } from "@headlessui/react";
import Toast from "../components/Toast";


type CollectionItem = {
    rating_key: string;
    title: string;
    year: number | null;
    thumb: string | null;
    type: string;
};

type CollectionDetail = {
    title: string;
    library: string;
    summary: string | null;
    poster_url: string | null;
    sort_title: string | null;
    content_rating: string | null;
    labels: string[];
    collection_mode: string | null;
    collection_order: string | null;
    item_count: number;
    items: CollectionItem[];
};

type LibraryItem = {
    rating_key: string;
    title: string;
    year: number | null;
    thumb: string | null;
    type: string;
    in_collection: boolean;
};

export default function CollectionDetailPage() {
    const { library, collectionTitle } = useParams<{ library: string; collectionTitle: string }>();
    const navigate = useNavigate();

    const [collection, setCollection] = useState<CollectionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Add items modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<LibraryItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [adding, setAdding] = useState(false);

    // Poster upload modal
    const [showPosterModal, setShowPosterModal] = useState(false);
    const [posterFile, setPosterFile] = useState<File | null>(null);
    const [posterUrl, setPosterUrl] = useState("");
    const [uploading, setUploading] = useState(false);

    // Edit collection modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editSummary, setEditSummary] = useState("");
    const [editSortTitle, setEditSortTitle] = useState("");
    const [editContentRating, setEditContentRating] = useState("");
    const [editLabels, setEditLabels] = useState<string[]>([]);
    const [editCollectionMode, setEditCollectionMode] = useState("");
    const [editCollectionOrder, setEditCollectionOrder] = useState("");
    const [labelInput, setLabelInput] = useState("");
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (library && collectionTitle) {
            loadCollectionDetails();
        }
    }, [library, collectionTitle]);

    // Debounce search for add items modal
    useEffect(() => {
        if (!showAddModal) return;

        const timeoutId = setTimeout(() => {
            searchLibrary(searchQuery);
        }, 300); // 300ms delay

        return () => clearTimeout(timeoutId);
    }, [searchQuery, showAddModal]);

    const loadCollectionDetails = async () => {
        try {
            setLoading(true);
            const response = await fetchWithAuth(
                `/api/collections/${encodeURIComponent(library!)}/${encodeURIComponent(collectionTitle!)}/details`
            );
            const data = await response.json();
            setCollection(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load collection");
        } finally {
            setLoading(false);
        }
    };

    const searchLibrary = async (query: string) => {
        try {
            setSearchLoading(true);
            const params = new URLSearchParams({
                collection_title: collectionTitle!,
                ...(query && { query }),
            });

            const response = await fetchWithAuth(
                `/api/collections/${encodeURIComponent(library!)}/search?${params}`
            );
            const data = await response.json();
            setSearchResults(data.items);
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setSearchLoading(false);
        }
    };

    const toggleItemSelection = (ratingKey: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(ratingKey)) {
            newSelected.delete(ratingKey);
        } else {
            newSelected.add(ratingKey);
        }
        setSelectedItems(newSelected);
    };

    const handleAddSelectedItems = async () => {
        if (selectedItems.size === 0) {
            setToast({ message: "Please select at least one item to add", type: "error" });
            return;
        }

        try {
            setAdding(true);

            // Add all selected items
            for (const ratingKey of Array.from(selectedItems)) {
                await fetchWithAuth(
                    `/api/collections/${encodeURIComponent(library!)}/${encodeURIComponent(collectionTitle!)}/add-item`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rating_key: ratingKey }),
                    }
                );
            }

            // Show success toast
            setToast({
                message: `Added ${selectedItems.size} item(s) to collection`,
                type: "success"
            });

            // Clear selection
            setSelectedItems(new Set());

            // Reload collection and search results
            await Promise.all([loadCollectionDetails(), searchLibrary(searchQuery)]);
        } catch (err) {
            setToast({ message: "Failed to add items", type: "error" });
        } finally {
            setAdding(false);
        }
    };


    const handleRemoveItem = async (ratingKey: string) => {
        if (!confirm("Remove this item from the collection?")) return;

        try {
            const response = await fetchWithAuth(
                `/api/collections/${encodeURIComponent(library!)}/${encodeURIComponent(collectionTitle!)}/remove-item`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rating_key: ratingKey }),
                }
            );

            const data = await response.json();

            // Show success toast
            setToast({ message: data.message || "Item removed successfully!", type: "success" });

            await loadCollectionDetails();
        } catch (err) {
            setToast({ message: "Failed to remove item", type: "error" });
        }
    };


    const openAddModal = () => {
        setShowAddModal(true);
        setSelectedItems(new Set()); // Clear any previous selections
        setSearchQuery(""); // Reset search query - the debounce effect will handle the initial load
        setSearchLoading(true); // Show loading immediately when modal opens
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        setSelectedItems(new Set());
        setSearchQuery("");
        setSearchResults([]);
    };

    const openPosterModal = () => {
        setShowPosterModal(true);
        setPosterFile(null);
        setPosterUrl("");
    };

    const closePosterModal = () => {
        setShowPosterModal(false);
        setPosterFile(null);
        setPosterUrl("");
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPosterFile(file);
            setPosterUrl(""); // Clear URL if file is selected
        }
    };

    const handleUploadPoster = async () => {
        if (!posterFile && !posterUrl) {
            setToast({ message: "Please select a file or enter a URL", type: "error" });
            return;
        }

        try {
            setUploading(true);

            const formData = new FormData();
            if (posterFile) {
                formData.append("file", posterFile);
            } else if (posterUrl) {
                formData.append("url", posterUrl);
            }

            const response = await fetchWithAuth(
                `/api/collections/${encodeURIComponent(library!)}/${encodeURIComponent(collectionTitle!)}/upload-poster`,
                {
                    method: "POST",
                    body: formData,
                }
            );

            const data = await response.json();

            setToast({ message: data.message || "Poster uploaded successfully!", type: "success" });
            closePosterModal();

            // Reload collection to show new poster
            await loadCollectionDetails();
        } catch (err) {
            setToast({ message: "Failed to upload poster", type: "error" });
        } finally {
            setUploading(false);
        }
    };

    const openEditModal = () => {
        setShowEditModal(true);
        setEditTitle(collection?.title || "");
        setEditSummary(collection?.summary || "");
        setEditSortTitle(collection?.sort_title || "");
        setEditContentRating(collection?.content_rating || "");
        setEditLabels(collection?.labels || []);
        setEditCollectionMode(collection?.collection_mode || "");
        setEditCollectionOrder(collection?.collection_order || "");
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setEditTitle("");
        setEditSummary("");
        setEditSortTitle("");
        setEditContentRating("");
        setEditLabels([]);
        setEditCollectionMode("");
        setEditCollectionOrder("");
        setLabelInput("");
    };

    const handleUpdateCollection = async () => {
        if (!editTitle.trim()) {
            setToast({ message: "Title cannot be empty", type: "error" });
            return;
        }

        try {
            setUpdating(true);

            const response = await fetchWithAuth(
                `/api/collections/${encodeURIComponent(library!)}/${encodeURIComponent(collectionTitle!)}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: editTitle.trim(),
                        summary: editSummary.trim() || null,
                        sort_title: editSortTitle.trim() || null,
                        content_rating: editContentRating.trim() || null,
                        labels: editLabels,
                        collection_mode: editCollectionMode || null,
                        collection_order: editCollectionOrder || null,
                    }),
                }
            );

            const data = await response.json();

            setToast({ message: data.message || "Collection updated successfully!", type: "success" });
            closeEditModal();

            // If title changed, navigate to new URL
            if (editTitle.trim() !== collectionTitle) {
                navigate(`/collections/${encodeURIComponent(library!)}/${encodeURIComponent(editTitle.trim())}`);
            } else {
                // Just reload if only summary changed
                await loadCollectionDetails();
            }
        } catch (err) {
            setToast({ message: "Failed to update collection", type: "error" });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="text-gray-400">Loading collection...</div>
            </div>
        );
    }

    if (error || !collection) {
        return (
            <div className="p-8">
                <div className="text-red-400">Error: {error || "Collection not found"}</div>
                <button
                    onClick={() => navigate("/collections")}
                    className="mt-4 text-blue-400 hover:text-blue-300"
                >
                    Back to Collections
                </button>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => navigate("/collections")}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
                >
                    <ArrowLeft size={20} />
                    Back to Collections
                </button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">{collection.title}</h1>
                        <p className="text-gray-400 mt-1">
                            {collection.library} • {collection.item_count} items
                        </p>
                        {collection.summary && (
                            <p className="text-gray-300 mt-2 max-w-2xl">{collection.summary}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={openEditModal}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                            <Edit size={20} />
                            Edit
                        </button>
                        <button
                            onClick={openPosterModal}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                            <Image size={20} />
                            Edit Poster
                        </button>
                        <button
                            onClick={openAddModal}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            <Plus size={20} />
                            Add Items
                        </button>
                    </div>
                </div>
            </div>

            {/* Items Grid */}
            {collection.items.length === 0 ? (
                <div className="text-center text-gray-400 mt-12">
                    <p>This collection is empty</p>
                    <button
                        onClick={openAddModal}
                        className="mt-4 text-blue-400 hover:text-blue-300"
                    >
                        Add your first item
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {collection.items.map((item, index) => (
                        <div
                            key={item.rating_key}
                            className="group relative bg-gray-800 rounded-lg overflow-hidden animate-slide-up"
                            style={{ animationDelay: `${index * 0.03}s` }}
                        >
                            {/* Poster */}
                            <div className="aspect-[2/3] bg-gray-900">
                                {item.thumb ? (
                                    <img
                                        src={item.thumb}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                                        No Poster
                                    </div>
                                )}
                            </div>

                            {/* Remove Button (shown on hover) */}
                            <button
                                onClick={() => handleRemoveItem(item.rating_key)}
                                className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove from collection"
                            >
                                <Trash2 size={16} />
                            </button>

                            {/* Info */}
                            <div className="p-3">
                                <h3 className="text-white font-medium text-sm truncate">{item.title}</h3>
                                {item.year && <p className="text-gray-400 text-xs">{item.year}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Items Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-800">
                            <h2 className="text-2xl font-bold text-white mb-4">Add Items to Collection</h2>

                            {/* Search Bar */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search your library..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Search Results */}
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-hover-only">
                            {searchLoading ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                    {Array.from({ length: 10 }).map((_, i) => (
                                        <div key={i} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                                            {/* Poster skeleton */}
                                            <div className="aspect-[2/3] bg-gray-700"></div>
                                            {/* Info skeleton */}
                                            <div className="p-3 space-y-2">
                                                <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                                                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div>
                                    <p className="text-sm text-gray-400 mb-3">
                                        {selectedItems.size} item(s) selected
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                        {searchResults.map((item, index) => (
                                            <button
                                                key={item.rating_key}
                                                onClick={() => !item.in_collection && toggleItemSelection(item.rating_key)}
                                                disabled={item.in_collection}
                                                className={`bg-gray-800 rounded-lg overflow-hidden transition-all animate-slide-up ${
                                                    item.in_collection
                                                        ? "opacity-50 cursor-not-allowed"
                                                        : selectedItems.has(item.rating_key)
                                                        ? "ring-2 ring-blue-500"
                                                        : "hover:ring-2 hover:ring-gray-600"
                                                }`}
                                                style={{ animationDelay: `${index * 0.02}s` }}
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
                                                    {selectedItems.has(item.rating_key) && !item.in_collection && (
                                                        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="p-3">
                                                    <h3 className="text-white font-medium text-sm truncate">{item.title}</h3>
                                                    {item.year && <p className="text-gray-400 text-xs">{item.year}</p>}

                                                    {item.in_collection && (
                                                        <div className="mt-2 text-green-400 text-xs">Already in collection</div>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-400 text-center py-8">
                                    {searchQuery ? "No results found" : "Enter a search term to find items"}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-800 flex items-center justify-between gap-3">
                            <p className="text-sm text-gray-400">
                                {selectedItems.size === 0
                                    ? "Click items to select them"
                                    : `${selectedItems.size} item(s) selected`}
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={closeAddModal}
                                    disabled={adding}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleAddSelectedItems}
                                    disabled={adding || selectedItems.size === 0}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {adding ? "Adding..." : `Add Selected (${selectedItems.size})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Collection Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-lg max-w-2xl w-full">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-800">
                            <h2 className="text-2xl font-bold text-white">Edit Collection</h2>
                            <p className="text-gray-400 mt-2 text-sm">
                                Update collection metadata and settings
                            </p>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hover-only">
                            {/* Title Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Title <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter collection title"
                                    autoFocus
                                />
                            </div>

                            {/* Sort Title Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Sort Title
                                </label>
                                <input
                                    type="text"
                                    value={editSortTitle}
                                    onChange={(e) => setEditSortTitle(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="How this collection should be sorted (optional)"
                                />
                            </div>

                            {/* Summary Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Summary
                                </label>
                                <textarea
                                    value={editSummary}
                                    onChange={(e) => setEditSummary(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Enter collection summary (optional)"
                                />
                            </div>

                            {/* Content Rating Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Content Rating
                                </label>
                                <input
                                    type="text"
                                    value={editContentRating}
                                    onChange={(e) => setEditContentRating(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., PG-13, TV-MA, R (optional)"
                                />
                            </div>

                            {/* Labels Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Labels
                                </label>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={labelInput}
                                            onChange={(e) => setLabelInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && labelInput.trim()) {
                                                    e.preventDefault();
                                                    if (!editLabels.includes(labelInput.trim())) {
                                                        setEditLabels([...editLabels, labelInput.trim()]);
                                                    }
                                                    setLabelInput("");
                                                }
                                            }}
                                            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Type label and press Enter"
                                        />
                                    </div>
                                    {editLabels.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {editLabels.map((label, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-full text-sm"
                                                >
                                                    {label}
                                                    <button
                                                        onClick={() => setEditLabels(editLabels.filter((_, i) => i !== index))}
                                                        className="hover:text-red-300"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Collection Mode Select */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Collection Mode
                                </label>
                                <Listbox value={editCollectionMode} onChange={setEditCollectionMode}>
                                    <div className="relative">
                                        <Listbox.Button className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between">
                                            <span className={editCollectionMode ? "" : "text-gray-400"}>
                                                {editCollectionMode === "" && "Library Default"}
                                                {editCollectionMode === "hide" && "Hide Collection"}
                                                {editCollectionMode === "hideItems" && "Hide Items in this Collection"}
                                                {editCollectionMode === "showItems" && "Show this Collection and its Items"}
                                            </span>
                                            <ChevronDown size={16} className="text-gray-400" />
                                        </Listbox.Button>
                                        <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                            {[
                                                { value: "", label: "Library Default" },
                                                { value: "hide", label: "Hide Collection" },
                                                { value: "hideItems", label: "Hide Items in this Collection" },
                                                { value: "showItems", label: "Show this Collection and its Items" },
                                            ].map((option) => (
                                                <Listbox.Option
                                                    key={option.value}
                                                    value={option.value}
                                                    className="px-4 py-2 cursor-pointer transition-colors data-[focus]:bg-gray-700"
                                                >
                                                    {({ selected }) => (
                                                        <div className="flex items-center justify-between text-white">
                                                            <span className={selected ? "font-medium" : ""}>{option.label}</span>
                                                            {selected && <Check size={16} />}
                                                        </div>
                                                    )}
                                                </Listbox.Option>
                                            ))}
                                        </Listbox.Options>
                                    </div>
                                </Listbox>
                            </div>

                            {/* Collection Order Select */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Collection Order
                                </label>
                                <Listbox value={editCollectionOrder} onChange={setEditCollectionOrder}>
                                    <div className="relative">
                                        <Listbox.Button className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between">
                                            <span className={editCollectionOrder ? "" : "text-gray-400"}>
                                                {editCollectionOrder === "" && "Default"}
                                                {editCollectionOrder === "release" && "Release Date"}
                                                {editCollectionOrder === "alpha" && "Alphabetical"}
                                                {editCollectionOrder === "custom" && "Custom Order"}
                                            </span>
                                            <ChevronDown size={16} className="text-gray-400" />
                                        </Listbox.Button>
                                        <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                            {[
                                                { value: "", label: "Default" },
                                                { value: "release", label: "Release Date" },
                                                { value: "alpha", label: "Alphabetical" },
                                                { value: "custom", label: "Custom Order" },
                                            ].map((option) => (
                                                <Listbox.Option
                                                    key={option.value}
                                                    value={option.value}
                                                    className="px-4 py-2 cursor-pointer transition-colors data-[focus]:bg-gray-700"
                                                >
                                                    {({ selected }) => (
                                                        <div className="flex items-center justify-between text-white">
                                                            <span className={selected ? "font-medium" : ""}>{option.label}</span>
                                                            {selected && <Check size={16} />}
                                                        </div>
                                                    )}
                                                </Listbox.Option>
                                            ))}
                                        </Listbox.Options>
                                    </div>
                                </Listbox>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-800 flex items-center justify-end gap-3">
                            <button
                                onClick={closeEditModal}
                                disabled={updating}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateCollection}
                                disabled={updating || !editTitle.trim()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {updating ? "Updating..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Poster Upload Modal */}
            {showPosterModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-lg max-w-2xl w-full">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-800">
                            <h2 className="text-2xl font-bold text-white">Upload Collection Poster</h2>
                            <p className="text-gray-400 mt-2 text-sm">
                                Upload a custom poster image for this collection
                            </p>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-4">
                            {/* Current Poster Preview */}
                            {collection?.poster_url && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Current Poster
                                    </label>
                                    <div className="flex justify-center bg-gray-800 rounded-lg p-4">
                                        <img
                                            src={collection.poster_url}
                                            alt="Current poster"
                                            className="max-h-64 rounded-lg shadow-lg"
                                        />
                                    </div>
                                </div>
                            )}
                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Upload Image File
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                                />
                                {posterFile && (
                                    <p className="mt-2 text-sm text-green-400">
                                        Selected: {posterFile.name}
                                    </p>
                                )}
                            </div>

                            {/* OR Divider */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 border-t border-gray-700"></div>
                                <span className="text-gray-500 text-sm">OR</span>
                                <div className="flex-1 border-t border-gray-700"></div>
                            </div>

                            {/* URL Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Poster URL
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://example.com/poster.jpg"
                                    value={posterUrl}
                                    onChange={(e) => {
                                        setPosterUrl(e.target.value);
                                        setPosterFile(null); // Clear file if URL is entered
                                    }}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={!!posterFile}
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    Example: Paste a URL from ThePosterDB.com
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-800 flex items-center justify-end gap-3">
                            <button
                                onClick={closePosterModal}
                                disabled={uploading}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadPoster}
                                disabled={uploading || (!posterFile && !posterUrl)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading ? "Uploading..." : "Upload Poster"}
                            </button>
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

