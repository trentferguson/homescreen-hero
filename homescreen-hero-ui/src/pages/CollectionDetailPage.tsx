import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../utils/api";
import { ArrowLeft, Plus, Trash2, Search, Image, Edit, ChevronDown, Check } from "lucide-react";
import { Listbox } from "@headlessui/react";
import Toast from "../components/Toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogCloseButton,
    DialogFooter,
} from "../components/ui/dialog";


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

    // Edit collection modal (consolidated)
    const [showEditModal, setShowEditModal] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editSummary, setEditSummary] = useState("");
    const [editSortTitle, setEditSortTitle] = useState("");
    const [editContentRating, setEditContentRating] = useState("");
    const [editLabels, setEditLabels] = useState<string[]>([]);
    const [editCollectionMode, setEditCollectionMode] = useState("");
    const [editCollectionOrder, setEditCollectionOrder] = useState("");
    const [labelInput, setLabelInput] = useState("");
    const [editPosterFile, setEditPosterFile] = useState<File | null>(null);
    const [editPosterUrl, setEditPosterUrl] = useState("");
    const [editPosterMode, setEditPosterMode] = useState<"upload" | "url">("upload");
    const [updating, setUpdating] = useState(false);

    // Item poster edit modal
    const [showItemPosterModal, setShowItemPosterModal] = useState(false);
    const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
    const [itemPosterFile, setItemPosterFile] = useState<File | null>(null);
    const [itemPosterUrl, setItemPosterUrl] = useState("");
    const [itemPosterMode, setItemPosterMode] = useState<"upload" | "url">("upload");
    const [uploadingItemPoster, setUploadingItemPoster] = useState(false);

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

    const openEditModal = () => {
        setShowEditModal(true);
        setEditTitle(collection?.title || "");
        setEditSummary(collection?.summary || "");
        setEditSortTitle(collection?.sort_title || "");
        setEditContentRating(collection?.content_rating || "");
        setEditLabels(collection?.labels || []);
        setEditCollectionMode(collection?.collection_mode || "");
        setEditCollectionOrder(collection?.collection_order || "");
        setEditPosterFile(null);
        setEditPosterUrl("");
        setEditPosterMode("upload");
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
        setEditPosterFile(null);
        setEditPosterUrl("");
        setEditPosterMode("upload");
    };

    const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setEditPosterFile(file);
            setEditPosterUrl("");
        }
    };

    const handleUpdateCollection = async () => {
        if (!editTitle.trim()) {
            setToast({ message: "Title cannot be empty", type: "error" });
            return;
        }

        try {
            setUpdating(true);

            // Update collection metadata
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

            // Upload poster if provided
            if (editPosterFile || editPosterUrl) {
                const formData = new FormData();
                if (editPosterFile) {
                    formData.append("file", editPosterFile);
                } else if (editPosterUrl) {
                    formData.append("url", editPosterUrl);
                }

                const titleForPosterUpload = editTitle.trim() || collectionTitle!;
                await fetchWithAuth(
                    `/api/collections/${encodeURIComponent(library!)}/${encodeURIComponent(titleForPosterUpload)}/upload-poster`,
                    {
                        method: "POST",
                        body: formData,
                    }
                );
            }

            setToast({ message: data.message || "Collection updated successfully!", type: "success" });
            closeEditModal();

            // If title changed, navigate to new URL
            if (editTitle.trim() !== collectionTitle) {
                navigate(`/collections/${encodeURIComponent(library!)}/${encodeURIComponent(editTitle.trim())}`);
            } else {
                // Just reload to show changes
                await loadCollectionDetails();
            }
        } catch (err) {
            setToast({ message: "Failed to update collection", type: "error" });
        } finally {
            setUpdating(false);
        }
    };

    const openItemPosterModal = (item: CollectionItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingItem(item);
        setItemPosterFile(null);
        setItemPosterUrl("");
        setItemPosterMode("upload");
        setShowItemPosterModal(true);
    };

    const closeItemPosterModal = () => {
        setShowItemPosterModal(false);
        setEditingItem(null);
        setItemPosterFile(null);
        setItemPosterUrl("");
        setItemPosterMode("upload");
    };

    const handleItemPosterFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setItemPosterFile(file);
            setItemPosterUrl("");
        }
    };

    const handleUploadItemPoster = async () => {
        if (!editingItem) return;

        try {
            setUploadingItemPoster(true);

            const formData = new FormData();
            if (itemPosterFile) {
                formData.append("file", itemPosterFile);
            } else if (itemPosterUrl) {
                formData.append("url", itemPosterUrl);
            } else {
                setToast({ message: "Please select a file or enter a URL", type: "error" });
                return;
            }

            await fetchWithAuth(
                `/api/collections/${encodeURIComponent(library!)}/items/${encodeURIComponent(editingItem.rating_key)}/upload-poster`,
                {
                    method: "POST",
                    body: formData,
                }
            );

            setToast({ message: "Poster updated successfully!", type: "success" });
            closeItemPosterModal();
            await loadCollectionDetails();
        } catch (err) {
            setToast({ message: "Failed to upload poster", type: "error" });
        } finally {
            setUploadingItemPoster(false);
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <button
                    onClick={() => navigate("/collections")}
                    className="flex items-center gap-2 text-slate-400 hover:text-white w-fit transition-colors"
                >
                    <ArrowLeft size={20} />
                    Back to Collections
                </button>

                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tight text-white">{collection.title}</h1>
                        <p className="text-slate-400 text-sm">
                            {collection.library} • {collection.item_count} items
                        </p>
                        {collection.summary && (
                            <p className="text-slate-300 mt-2 max-w-2xl text-sm">{collection.summary}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={openEditModal}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 active:scale-95"
                        >
                            <Edit size={18} />
                            Edit Collection Details
                        </button>
                        <button
                            onClick={openAddModal}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95"
                        >
                            <Plus size={18} />
                            Add Items
                        </button>
                    </div>
                </div>
            </div>

            {/* Items Grid */}
            <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Collection Items</h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {collection.item_count} items in this collection
                        </p>
                    </div>
                </div>

                {collection.items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/50 p-8 text-center">
                        <p className="text-slate-400">This collection is empty</p>
                        <button
                            onClick={openAddModal}
                            className="mt-4 text-primary hover:text-blue-400 font-medium transition-colors"
                        >
                            Add your first item
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {collection.items.map((item, index) => (
                            <div
                                key={item.rating_key}
                                className="group relative rounded-xl overflow-hidden border border-slate-800/60 bg-slate-900/50 shadow-md hover:shadow-xl hover:border-slate-700 transition-all duration-300 animate-slide-up"
                                style={{ animationDelay: `${index * 0.03}s` }}
                            >
                                {/* Poster */}
                                <div className="aspect-[2/3] bg-slate-800">
                                    {item.thumb ? (
                                        <img
                                            src={item.thumb}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                            No Poster
                                        </div>
                                    )}
                                </div>

                                {/* Edit Poster Button (shown on hover, top-left) */}
                                <button
                                    onClick={(e) => openItemPosterModal(item, e)}
                                    className="absolute top-2 left-2 p-2 bg-primary/70 hover:bg-primary/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    title="Edit poster"
                                >
                                    <Image size={16} />
                                </button>

                                {/* Remove Button (shown on hover, top-right) */}
                                <button
                                    onClick={() => handleRemoveItem(item.rating_key)}
                                    className="absolute top-2 right-2 p-2 bg-red-600/70 hover:bg-red-600/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    title="Remove from collection"
                                >
                                    <Trash2 size={16} />
                                </button>

                                {/* Info */}
                                <div className="p-3">
                                    <h3 className="text-white font-medium text-sm truncate">{item.title}</h3>
                                    {item.year && <p className="text-slate-400 text-xs">{item.year}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Add Items Modal */}
            <Dialog open={showAddModal} onOpenChange={(isOpen) => !isOpen && closeAddModal()}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader className="flex-col items-stretch gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <DialogTitle>Add Items to Collection</DialogTitle>
                                <DialogDescription>
                                    Search and select items from your library to add
                                </DialogDescription>
                            </div>
                            <DialogCloseButton />
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
                            <input
                                type="text"
                                placeholder="Search your library..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                autoFocus
                            />
                        </div>
                    </DialogHeader>

                    {/* Search Results */}
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hover-only max-h-[50vh]">
                        {searchLoading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div key={i} className="bg-slate-800/60 rounded-xl overflow-hidden animate-pulse">
                                        {/* Poster skeleton */}
                                        <div className="aspect-[2/3] bg-slate-700/50"></div>
                                        {/* Info skeleton */}
                                        <div className="p-3 space-y-2">
                                            <div className="h-3 bg-slate-700/50 rounded w-3/4"></div>
                                            <div className="h-3 bg-slate-700/50 rounded w-1/2"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : searchResults.length > 0 ? (
                            <div>
                                <p className="text-sm text-slate-400 mb-3">
                                    {selectedItems.size} item(s) selected
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                    {searchResults.map((item, index) => (
                                        <button
                                            key={item.rating_key}
                                            onClick={() => !item.in_collection && toggleItemSelection(item.rating_key)}
                                            disabled={item.in_collection}
                                            className={`rounded-xl overflow-hidden transition-all animate-slide-up border ${
                                                item.in_collection
                                                    ? "opacity-50 cursor-not-allowed border-slate-800/60 bg-slate-900/50"
                                                    : selectedItems.has(item.rating_key)
                                                    ? "ring-2 ring-primary border-primary/50 bg-slate-900/50"
                                                    : "border-slate-800/60 bg-slate-900/50 hover:border-slate-700"
                                            }`}
                                            style={{ animationDelay: `${index * 0.02}s` }}
                                        >
                                            {/* Poster */}
                                            <div className="aspect-[2/3] bg-slate-800 relative">
                                                {item.thumb ? (
                                                    <img
                                                        src={item.thumb}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                                                        No Poster
                                                    </div>
                                                )}
                                                {selectedItems.has(item.rating_key) && !item.in_collection && (
                                                    <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="p-3">
                                                <h3 className="text-white font-medium text-sm truncate">{item.title}</h3>
                                                {item.year && <p className="text-slate-400 text-xs">{item.year}</p>}

                                                {item.in_collection && (
                                                    <div className="mt-2 text-emerald-400 text-xs">Already in collection</div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-400 text-center py-8">
                                {searchQuery ? "No results found" : "Enter a search term to find items"}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="bg-slate-950/50">
                        <p className="text-sm text-slate-400">
                            {selectedItems.size === 0
                                ? "Click items to select them"
                                : `${selectedItems.size} item(s) selected`}
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={closeAddModal}
                                disabled={adding}
                                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:border-slate-600 transition-all duration-200 active:scale-95 disabled:opacity-50"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleAddSelectedItems}
                                disabled={adding || selectedItems.size === 0}
                                className="px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {adding ? "Adding..." : `Add Selected (${selectedItems.size})`}
                            </button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Collection Modal */}
            <Dialog open={showEditModal} onOpenChange={(isOpen) => !isOpen && closeEditModal()}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto scrollbar-hover-only">
                    <DialogHeader>
                        <div className="flex flex-col gap-1">
                            <DialogTitle>Edit Collection Details (Advanced)</DialogTitle>
                            <DialogDescription>
                                Update metadata, poster, labels, and display settings
                            </DialogDescription>
                        </div>
                        <DialogCloseButton />
                    </DialogHeader>

                    {/* Modal Content */}
                    <div className="p-6">
                        <div className="grid grid-cols-[200px_1fr] gap-6">
                            {/* Left Column - Poster Preview */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                                    Cover Poster
                                </label>

                                {/* Poster Preview */}
                                <div className="relative aspect-[2/3] bg-slate-800 rounded-xl overflow-hidden border-2 border-dashed border-slate-700 mb-2">
                                    {collection?.poster_url ? (
                                        <img
                                            src={collection.poster_url}
                                            alt="Current poster"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                            No Poster
                                        </div>
                                    )}
                                </div>

                                <p className="text-xs text-slate-500 mb-4">
                                    Recommended: 600×900px (JPG/PNG)
                                </p>

                                {/* Tab Switcher */}
                                <div className="flex gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditPosterMode("upload");
                                            setEditPosterUrl("");
                                        }}
                                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                            editPosterMode === "upload"
                                                ? "bg-primary text-white"
                                                : "bg-slate-800/60 text-slate-400 hover:bg-slate-700"
                                        }`}
                                    >
                                        Upload File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditPosterMode("url");
                                            setEditPosterFile(null);
                                        }}
                                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                            editPosterMode === "url"
                                                ? "bg-primary text-white"
                                                : "bg-slate-800/60 text-slate-400 hover:bg-slate-700"
                                        }`}
                                    >
                                        From URL
                                    </button>
                                </div>

                                {/* Upload Mode */}
                                {editPosterMode === "upload" && (
                                    <label className="block cursor-pointer">
                                        <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-slate-600 transition-colors">
                                            <Image size={20} className="mx-auto mb-2 text-slate-400" />
                                            <span className="text-xs text-slate-400">
                                                {editPosterFile ? editPosterFile.name : "Click to select file"}
                                            </span>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleEditFileSelect}
                                            className="hidden"
                                        />
                                    </label>
                                )}

                                {/* URL Mode */}
                                {editPosterMode === "url" && (
                                    <div>
                                        <input
                                            type="url"
                                            value={editPosterUrl}
                                            onChange={(e) => setEditPosterUrl(e.target.value)}
                                            placeholder="https://example.com/poster.jpg"
                                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                        />
                                        <p className="text-xs text-slate-500 mt-2">
                                            e.g., from ThePosterDB.com
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Right Column - All Fields */}
                            <div className="space-y-4">
                                {/* Collection Name */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                        Collection Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                        placeholder="Enter collection title"
                                        autoFocus
                                    />
                                </div>

                                {/* Brief Summary */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                        Brief Summary
                                    </label>
                                    <textarea
                                        value={editSummary}
                                        onChange={(e) => setEditSummary(e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70 resize-none"
                                        placeholder="Enter collection summary (optional)"
                                    />
                                </div>

                                {/* Sort Title */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                        Sort Title
                                    </label>
                                    <input
                                        type="text"
                                        value={editSortTitle}
                                        onChange={(e) => setEditSortTitle(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                        placeholder="How this collection should be sorted (optional)"
                                    />
                                </div>

                                {/* Content Rating */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                        Content Rating
                                    </label>
                                    <input
                                        type="text"
                                        value={editContentRating}
                                        onChange={(e) => setEditContentRating(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                        placeholder="e.g., PG-13, TV-MA, R (optional)"
                                    />
                                </div>

                                {/* Labels */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                        Labels
                                    </label>
                                    <div className="space-y-2">
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
                                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                            placeholder="Type label and press Enter"
                                        />
                                        {editLabels.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {editLabels.map((label, index) => (
                                                    <span
                                                        key={index}
                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-full text-xs"
                                                    >
                                                        {label}
                                                        <button
                                                            type="button"
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

                                {/* Collection Mode */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                        Collection Mode
                                    </label>
                                    <Listbox value={editCollectionMode} onChange={setEditCollectionMode}>
                                        <div className="relative">
                                            <Listbox.Button className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/70 text-left flex items-center justify-between">
                                                <span className={editCollectionMode ? "" : "text-slate-500"}>
                                                    {editCollectionMode === "" && "Library Default"}
                                                    {editCollectionMode === "hide" && "Hide Collection"}
                                                    {editCollectionMode === "hideItems" && "Hide Items in this Collection"}
                                                    {editCollectionMode === "showItems" && "Show this Collection and its Items"}
                                                </span>
                                                <ChevronDown size={16} className="text-slate-400" />
                                            </Listbox.Button>
                                            <Listbox.Options className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                                {[
                                                    { value: "", label: "Library Default" },
                                                    { value: "hide", label: "Hide Collection" },
                                                    { value: "hideItems", label: "Hide Items in this Collection" },
                                                    { value: "showItems", label: "Show this Collection and its Items" },
                                                ].map((option) => (
                                                    <Listbox.Option
                                                        key={option.value}
                                                        value={option.value}
                                                        className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-700"
                                                    >
                                                        {({ selected }) => (
                                                            <div className="flex items-center justify-between text-white text-sm">
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

                                {/* Collection Order */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                        Collection Order
                                    </label>
                                    <Listbox value={editCollectionOrder} onChange={setEditCollectionOrder}>
                                        <div className="relative">
                                            <Listbox.Button className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/70 text-left flex items-center justify-between">
                                                <span className={editCollectionOrder ? "" : "text-slate-500"}>
                                                    {editCollectionOrder === "" && "Default"}
                                                    {editCollectionOrder === "release" && "Release Date"}
                                                    {editCollectionOrder === "alpha" && "Alphabetical"}
                                                    {editCollectionOrder === "custom" && "Custom Order"}
                                                </span>
                                                <ChevronDown size={16} className="text-slate-400" />
                                            </Listbox.Button>
                                            <Listbox.Options className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                                {[
                                                    { value: "", label: "Default" },
                                                    { value: "release", label: "Release Date" },
                                                    { value: "alpha", label: "Alphabetical" },
                                                    { value: "custom", label: "Custom Order" },
                                                ].map((option) => (
                                                    <Listbox.Option
                                                        key={option.value}
                                                        value={option.value}
                                                        className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-700"
                                                    >
                                                        {({ selected }) => (
                                                            <div className="flex items-center justify-between text-white text-sm">
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
                        </div>
                    </div>

                    <DialogFooter className="justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeEditModal}
                            disabled={updating}
                            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:border-slate-600 transition-all duration-200 active:scale-95 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleUpdateCollection}
                            disabled={updating || !editTitle.trim()}
                            className="px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {updating ? "Updating..." : "Save Changes"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Item Poster Edit Modal */}
            <Dialog open={showItemPosterModal && editingItem !== null} onOpenChange={(isOpen) => !isOpen && closeItemPosterModal()}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <div className="flex flex-col gap-1">
                            <DialogTitle>Edit Poster</DialogTitle>
                            <DialogDescription>
                                {editingItem?.title} {editingItem?.year && `(${editingItem.year})`}
                            </DialogDescription>
                        </div>
                        <DialogCloseButton />
                    </DialogHeader>

                    {/* Modal Content */}
                    <div className="p-6">
                        <div className="grid grid-cols-[200px_1fr] gap-6">
                            {/* Left Column - Poster Preview */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                                    Current Poster
                                </label>

                                {/* Poster Preview */}
                                <div className="relative aspect-[2/3] bg-slate-800 rounded-xl overflow-hidden border-2 border-dashed border-slate-700">
                                    {editingItem?.thumb ? (
                                        <img
                                            src={editingItem.thumb}
                                            alt="Current poster"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                            No Poster
                                        </div>
                                    )}
                                </div>

                                <p className="text-xs text-slate-500 mt-2">
                                    Recommended: 600×900px (JPG/PNG)
                                </p>
                            </div>

                            {/* Right Column - Upload Options */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                        Upload New Poster
                                    </label>

                                    {/* Tab Switcher */}
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setItemPosterMode("upload");
                                                setItemPosterUrl("");
                                            }}
                                            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                                itemPosterMode === "upload"
                                                    ? "bg-primary text-white"
                                                    : "bg-slate-800/60 text-slate-400 hover:bg-slate-700"
                                            }`}
                                        >
                                            Upload File
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setItemPosterMode("url");
                                                setItemPosterFile(null);
                                            }}
                                            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                                itemPosterMode === "url"
                                                    ? "bg-primary text-white"
                                                    : "bg-slate-800/60 text-slate-400 hover:bg-slate-700"
                                            }`}
                                        >
                                            From URL
                                        </button>
                                    </div>

                                    {/* Upload Mode */}
                                    {itemPosterMode === "upload" && (
                                        <label className="block cursor-pointer">
                                            <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-slate-600 transition-colors">
                                                <Image size={24} className="mx-auto mb-2 text-slate-400" />
                                                <span className="text-sm text-slate-400">
                                                    {itemPosterFile ? itemPosterFile.name : "Click to select file"}
                                                </span>
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleItemPosterFileSelect}
                                                className="hidden"
                                            />
                                        </label>
                                    )}

                                    {/* URL Mode */}
                                    {itemPosterMode === "url" && (
                                        <div>
                                            <input
                                                type="url"
                                                value={itemPosterUrl}
                                                onChange={(e) => setItemPosterUrl(e.target.value)}
                                                placeholder="https://example.com/poster.jpg"
                                                className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                            />
                                            <p className="text-xs text-slate-500 mt-2">
                                                e.g., from ThePosterDB.com or TMDB
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="justify-end gap-3 bg-slate-950/50">
                        <button
                            type="button"
                            onClick={closeItemPosterModal}
                            disabled={uploadingItemPoster}
                            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:border-slate-600 transition-all duration-200 active:scale-95 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleUploadItemPoster}
                            disabled={uploadingItemPoster || (!itemPosterFile && !itemPosterUrl)}
                            className="px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploadingItemPoster ? "Uploading..." : "Upload Poster"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

