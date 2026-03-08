import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pin, Home, Users, Star } from "lucide-react";
import { fetchWithAuth } from "../utils/api";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";

export type ActiveCollection = {
    title: string;
    poster_url?: string | null;
    library?: string | null;
    promoted_to_own_home?: boolean;
    promoted_to_shared?: boolean;
    promoted_to_recommended?: boolean;
    is_pinned?: boolean;
    display_order?: number;
};

// Visibility options type for pin popover
type VisibilityOptions = {
    home: boolean;
    shared: boolean;
    recommended: boolean;
};

// Sortable collection card component
function SortableCollectionCard({
    collection,
    index,
    onClick,
    onPinWithVisibility,
    onUnpin,
    isPinning,
    animate,
}: {
    collection: ActiveCollection;
    index: number;
    onClick: () => void;
    onPinWithVisibility: (visibility: VisibilityOptions) => void;
    onUnpin: () => void;
    isPinning: boolean;
    animate: boolean;
}) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [visibility, setVisibility] = useState<VisibilityOptions>({
        home: collection.promoted_to_own_home ?? true,
        shared: collection.promoted_to_shared ?? false,
        recommended: collection.promoted_to_recommended ?? false,
    });

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: collection.title });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 200ms ease",
        animationDelay: animate ? `${index * 0.1}s` : undefined,
    };

    const handlePin = () => {
        onPinWithVisibility(visibility);
        setPopoverOpen(false);
    };

    const handleUnpin = () => {
        onUnpin();
        setPopoverOpen(false);
    };

    // Reset visibility state when popover opens
    const handleOpenChange = (open: boolean) => {
        if (open) {
            setVisibility({
                home: collection.promoted_to_own_home ?? true,
                shared: collection.promoted_to_shared ?? false,
                recommended: collection.promoted_to_recommended ?? false,
            });
        }
        setPopoverOpen(open);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`w-28 sm:w-32 shrink-0 text-left transition-opacity duration-200 ${animate ? "animate-fade-in" : ""} ${isDragging ? "opacity-50 z-50" : ""}`}
        >
            <div className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 shadow-md hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 ring-1 ring-slate-700/50 hover:ring-slate-600">
                {/* Drag handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="absolute top-1 left-1 z-20 p-1 rounded bg-black/60 text-white/70 hover:text-white hover:bg-black/80 cursor-grab active:cursor-grabbing transition-all opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={14} />
                </button>

                {/* Pin button with popover */}
                <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
                    <PopoverTrigger asChild>
                        <button
                            disabled={isPinning}
                            className={`absolute top-1 right-1 z-20 p-1 rounded transition-all ${
                                collection.is_pinned
                                    ? "bg-primary/80 text-white"
                                    : "bg-black/60 text-white/70 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100"
                            } ${isPinning ? "opacity-50 cursor-wait" : ""}`}
                            title={collection.is_pinned ? "Edit pin settings" : "Pin collection"}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Pin size={14} className={collection.is_pinned ? "fill-current" : ""} />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        className="w-44 p-2.5 bg-slate-900/90 backdrop-blur-md border-slate-700/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="space-y-1.5">
                            {/* My Home checkbox */}
                            <label className="flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer hover:bg-white/5 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={visibility.home}
                                    onChange={(e) => setVisibility(v => ({ ...v, home: e.target.checked }))}
                                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800/50 text-primary focus:ring-1 focus:ring-primary/50 focus:ring-offset-0"
                                />
                                <Home size={12} className="text-slate-500" />
                                <span className="text-xs text-slate-300">My Home</span>
                            </label>

                            {/* Shared checkbox */}
                            <label className="flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer hover:bg-white/5 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={visibility.shared}
                                    onChange={(e) => setVisibility(v => ({ ...v, shared: e.target.checked }))}
                                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800/50 text-primary focus:ring-1 focus:ring-primary/50 focus:ring-offset-0"
                                />
                                <Users size={12} className="text-slate-500" />
                                <span className="text-xs text-slate-300">Shared</span>
                            </label>

                            {/* Recommended checkbox */}
                            <label className="flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer hover:bg-white/5 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={visibility.recommended}
                                    onChange={(e) => setVisibility(v => ({ ...v, recommended: e.target.checked }))}
                                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800/50 text-primary focus:ring-1 focus:ring-primary/50 focus:ring-offset-0"
                                />
                                <Star size={12} className="text-slate-500" />
                                <span className="text-xs text-slate-300">Recommended</span>
                            </label>

                            <div className="pt-1.5 flex gap-1.5">
                                {collection.is_pinned ? (
                                    <>
                                        <button
                                            onClick={handleUnpin}
                                            disabled={isPinning}
                                            className="flex-1 px-2 py-1 text-[10px] font-medium rounded-md border border-slate-600/50 text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors disabled:opacity-50"
                                        >
                                            Unpin
                                        </button>
                                        <button
                                            onClick={handlePin}
                                            disabled={isPinning || (!visibility.home && !visibility.shared && !visibility.recommended)}
                                            className="flex-1 px-2 py-1 text-[10px] font-medium rounded-md bg-primary/90 hover:bg-primary text-white transition-colors disabled:opacity-50"
                                        >
                                            Update
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handlePin}
                                        disabled={isPinning || (!visibility.home && !visibility.shared && !visibility.recommended)}
                                        className="w-full px-2 py-1 text-[10px] font-medium rounded-md bg-primary/90 hover:bg-primary text-white transition-colors disabled:opacity-50"
                                    >
                                        Pin
                                    </button>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Clickable poster area */}
                <button
                    onClick={onClick}
                    disabled={!collection.library}
                    className="absolute inset-0 w-full h-full cursor-pointer disabled:cursor-default"
                >
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                        style={{
                            backgroundImage: collection.poster_url
                                ? `url('${collection.poster_url}')`
                                : "none",
                        }}
                    />
                    {!collection.poster_url && (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-medium">
                            No Poster
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-70 group-hover:opacity-50 transition-opacity duration-300" />
                </button>
            </div>

            <div className="mt-2.5">
                <div className="flex items-center gap-1">
                    {collection.is_pinned && (
                        <Pin size={10} className="text-primary fill-current shrink-0" />
                    )}
                    <div className="text-sm font-semibold truncate text-white group-hover:text-primary transition-colors">
                        {collection.title}
                    </div>
                </div>

                {collection.library && (
                    <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 font-medium">
                        {collection.library}
                    </span>
                )}
            </div>
        </div>
    );
}

export default function ActiveCollectionsCard({
    collections,
    loading,
}: {
    collections: ActiveCollection[];
    loading?: boolean;
}) {
    const navigate = useNavigate();
    const [visibilityFilter, setVisibilityFilter] = useState<"all" | "my_home" | "shared" | "recommended">("my_home");
    const [localCollections, setLocalCollections] = useState<ActiveCollection[]>([]);
    const [pinningCollection, setPinningCollection] = useState<string | null>(null);
    const hasAnimated = useRef(false);

    // Sync local state with props
    useMemo(() => {
        setLocalCollections(collections);
    }, [collections]);

    // Mark animation as complete after initial render
    useEffect(() => {
        if (collections.length > 0 && !hasAnimated.current) {
            const timer = setTimeout(() => {
                hasAnimated.current = true;
            }, collections.length * 100 + 300); // Wait for all animations to complete
            return () => clearTimeout(timer);
        }
    }, [collections.length]);

    // Sensors for drag and drop
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const filteredCollections = useMemo(() => {
        if (visibilityFilter === "all") {
            return localCollections;
        } else if (visibilityFilter === "my_home") {
            return localCollections.filter(c => c.promoted_to_own_home);
        } else if (visibilityFilter === "shared") {
            return localCollections.filter(c => c.promoted_to_shared);
        } else if (visibilityFilter === "recommended") {
            return localCollections.filter(c => c.promoted_to_recommended);
        }
        return localCollections;
    }, [localCollections, visibilityFilter]);

    const handleCollectionClick = (collection: ActiveCollection) => {
        if (collection.library) {
            navigate(
                `/collections/${encodeURIComponent(collection.library)}/${encodeURIComponent(collection.title)}`
            );
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        // Find items in the full list (not just filtered) to compute correct order
        const activeItem = localCollections.find(c => c.title === active.id);
        const overItem = localCollections.find(c => c.title === over.id);

        if (!activeItem || !overItem) return;

        const activeIdx = localCollections.indexOf(activeItem);
        const overIdx = localCollections.indexOf(overItem);

        // Compute the full reordered list
        const reorderedCollections = arrayMove([...localCollections], activeIdx, overIdx);

        // Optimistically update local state
        setLocalCollections(reorderedCollections);

        // Send full reordered list to backend (not just the filtered subset)
        try {
            const orderedNames = reorderedCollections.map(c => c.title);
            const response = await fetchWithAuth("/api/collections/reorder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ordered_collections: orderedNames }),
            });

            if (!response.ok) {
                throw new Error("Failed to reorder collections");
            }
        } catch (error) {
            console.error("Failed to reorder collections:", error);
            // Revert to original order on failure
            setLocalCollections(collections);
        }
    };

    const handlePinWithVisibility = async (collection: ActiveCollection, visibility: VisibilityOptions) => {
        if (!collection.library || pinningCollection) return;

        setPinningCollection(collection.title);

        try {
            const response = await fetchWithAuth("/api/collections/toggle-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    collection_name: collection.title,
                    library: collection.library,
                    home: visibility.home,
                    shared: visibility.shared,
                    recommended: visibility.recommended,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to pin collection");
            }

            // Optimistically update local state with new visibility
            // Don't re-sort - keep current position, backend will assign pin order
            setLocalCollections(prev =>
                prev.map(c =>
                    c.title === collection.title
                        ? {
                            ...c,
                            is_pinned: true,
                            promoted_to_own_home: visibility.home,
                            promoted_to_shared: visibility.shared,
                            promoted_to_recommended: visibility.recommended,
                        }
                        : c
                )
            );
        } catch (error) {
            console.error("Failed to pin collection:", error);
        } finally {
            setPinningCollection(null);
        }
    };

    const handleUnpin = async (collection: ActiveCollection) => {
        if (!collection.library || pinningCollection) return;

        setPinningCollection(collection.title);

        try {
            const response = await fetchWithAuth("/api/collections/toggle-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    collection_name: collection.title,
                    library: collection.library,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to unpin collection");
            }

            // Remove from local state since it's no longer on homescreen
            setLocalCollections(prev => prev.filter(c => c.title !== collection.title));
        } catch (error) {
            console.error("Failed to unpin collection:", error);
        } finally {
            setPinningCollection(null);
        }
    };
    return (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 px-5 py-4 transition-all duration-300 hover:bg-slate-800/30">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Active Collections</h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Currently featured on your Plex home screen
                    </p>
                </div>

                {/* Filter Tabs - Segmented Control */}
                <div className="flex p-1 rounded-lg border border-slate-700/50 bg-slate-800/30">
                    <button
                        type="button"
                        onClick={() => setVisibilityFilter("my_home")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                            visibilityFilter === "my_home"
                                ? "bg-primary/20 text-white shadow-sm"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        My Home {!loading && `(${localCollections.filter(c => c.promoted_to_own_home).length})`}
                    </button>
                    <button
                        type="button"
                        onClick={() => setVisibilityFilter("shared")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                            visibilityFilter === "shared"
                                ? "bg-primary/20 text-white shadow-sm"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Shared {!loading && `(${localCollections.filter(c => c.promoted_to_shared).length})`}
                    </button>
                    <button
                        type="button"
                        onClick={() => setVisibilityFilter("recommended")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                            visibilityFilter === "recommended"
                                ? "bg-primary/20 text-white shadow-sm"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Recommended {!loading && `(${localCollections.filter(c => c.promoted_to_recommended).length})`}
                    </button>
                    <button
                        type="button"
                        onClick={() => setVisibilityFilter("all")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                            visibilityFilter === "all"
                                ? "bg-primary/20 text-white shadow-sm"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        All {!loading && localCollections.length > 0 && `(${localCollections.length})`}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hover-only">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="w-28 sm:w-32 shrink-0">
                            <div className="aspect-[2/3] rounded-xl bg-slate-800/60 animate-pulse" />
                            <div className="h-3 mt-2 rounded bg-slate-800/60 animate-pulse" />
                        </div>
                    ))}
                </div>
            ) : filteredCollections.length === 0 ? (
                <div className="text-sm text-slate-400 py-4">
                    No active collections {visibilityFilter !== "all" ? "in this category" : "yet"}.
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={filteredCollections.map(c => c.title)}
                        strategy={horizontalListSortingStrategy}
                    >
                        <div className="flex gap-4 overflow-x-auto px-2 py-2 -mx-2 -my-2 scrollbar-hover-only">
                            {filteredCollections.map((c, index) => (
                                <SortableCollectionCard
                                    key={c.title}
                                    collection={c}
                                    index={index}
                                    onClick={() => handleCollectionClick(c)}
                                    onPinWithVisibility={(visibility) => handlePinWithVisibility(c, visibility)}
                                    onUnpin={() => handleUnpin(c)}
                                    isPinning={pinningCollection === c.title}
                                    animate={!hasAnimated.current}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}