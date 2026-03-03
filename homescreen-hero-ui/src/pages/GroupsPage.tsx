import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { fetchWithAuth } from "../utils/api";
import { useNavigate } from "react-router-dom";
import {
    Check,
    CheckCircle2,
    ChevronDown,
    Compass,
    GripVertical,
    Home,
    Layers,
    LayoutGrid,
    Lightbulb,
    List,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Share2,
    Shuffle,
    SlidersHorizontal,
    Trash2,
} from "lucide-react";
import { Listbox, Switch } from "@headlessui/react";
import { Slider } from "../components/ui/slider";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    arrayMove,
    rectSortingStrategy,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import GroupCoverMosaic from "../components/GroupCoverMosaic";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogCloseButton,
} from "../components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetBody,
    SheetCloseButton,
} from "../components/ui/sheet";
import { getGroupStatus } from "../utils/dates";
import { Sparkles } from "lucide-react";

type DateRange = {
    start: string;
    end: string;
};

type CollectionGroup = {
    name: string;
    enabled: boolean;
    min_picks: number;
    max_picks: number;
    weight: number;
    min_gap_rotations: number;
    display_order: number;
    date_range?: DateRange | null;
    smart?: boolean;
    rules?: unknown[];
    collections: string[];
};

type DisplaySettings = {
    group_display_mode: "grouped" | "merged";
};

type PlexLibrary = {
    name: string;
    enabled: boolean;
};

type AutoRotateSettings = {
    enabled: boolean;
    libraries: string[];
    visibility_home: boolean;
    visibility_shared: boolean;
    visibility_recommended: boolean;
};

type RotationSettings = {
    enabled: boolean;
    interval_hours: number;
    max_collections: number;
    strategy: string;
    allow_repeats: boolean;
    sync_all_on_rotation: boolean;
    blacklisted_collections: string[];
    auto_rotate: AutoRotateSettings;
    randomize_group_order: boolean;
};

const defaultAutoRotate: AutoRotateSettings = {
    enabled: false,
    libraries: [],
    visibility_home: true,
    visibility_shared: false,
    visibility_recommended: false,
};

type RenameState = { index: number; value: string } | null;

type ViewMode = "cards" | "list";

const coverGradients = [
    "from-indigo-900 via-slate-900 to-slate-950",
    "from-blue-900 via-slate-900 to-slate-950",
    "from-purple-900 via-slate-900 to-slate-950",
    "from-cyan-900 via-slate-900 to-slate-950",
    "from-amber-900 via-slate-900 to-slate-950",
    "from-emerald-900 via-slate-900 to-slate-950",
];

function SortableGroupCard({ id, viewMode, children }: { id: string; viewMode: ViewMode; children: React.ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : "auto",
    };

    if (viewMode === "list") {
        return (
            <div ref={setNodeRef} style={style} className="flex items-center">
                <div
                    {...attributes}
                    {...listeners}
                    className="flex items-center justify-center p-2 cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                    title="Drag to reorder"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
                {children}
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} className="relative">
            <div
                {...attributes}
                {...listeners}
                className="absolute right-3 top-3 z-10 p-1.5 rounded-lg bg-slate-900/80 border border-slate-700/50 cursor-grab active:cursor-grabbing backdrop-blur-sm hover:bg-slate-800 hover:border-slate-600 transition-colors"
                title="Drag to reorder"
            >
                <GripVertical className="w-3.5 h-3.5 text-slate-400" />
            </div>
            {children}
        </div>
    );
}

export default function GroupsPage() {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<CollectionGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [renaming, setRenaming] = useState<RenameState>(null);
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>(
        () => (localStorage.getItem("groupsViewMode") as ViewMode) || "cards"
    );
    const [message, setMessage] = useState<string | null>(null);
    const [messageVisible, setMessageVisible] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    // Auto-rotate state
    const [autoRotate, setAutoRotate] = useState<AutoRotateSettings>(defaultAutoRotate);
    const [autoRotateExpanded, setAutoRotateExpanded] = useState(false);
    const [libraries, setLibraries] = useState<PlexLibrary[]>([]);
    const [savingAutoRotate, setSavingAutoRotate] = useState(false);
    const [rotationSettings, setRotationSettings] = useState<RotationSettings | null>(null);

    // Group type picker dialog
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [newGroupType, setNewGroupType] = useState<"basic" | "smart" | null>(null);
    const [newGroupName, setNewGroupName] = useState("");
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Display settings state
    const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({ group_display_mode: "grouped" });
    const [layoutModalOpen, setLayoutModalOpen] = useState(false);
    const [savingDisplay, setSavingDisplay] = useState(false);
    const [maxCollectionsInput, setMaxCollectionsInput] = useState("");

    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem("groupsViewMode", mode);
    };

    const refreshGroups = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchWithAuth("/api/admin/config/groups").then((r) => r.json());
            setGroups(data);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const fetchRotationSettings = async () => {
        try {
            const data = await fetchWithAuth("/api/admin/config/rotation").then((r) => r.json());
            setRotationSettings(data);
            setMaxCollectionsInput(String(data.max_collections));
            setAutoRotate(data.auto_rotate ?? defaultAutoRotate);
            // Auto-expand if enabled
            if (data.auto_rotate?.enabled) {
                setAutoRotateExpanded(true);
            }
        } catch (e) {
            console.error("Failed to fetch rotation settings:", e);
        }
    };

    const fetchLibraries = async () => {
        try {
            const data = await fetchWithAuth("/api/admin/config/plex").then((r) => r.json());
            setLibraries(data.libraries ?? []);
        } catch (e) {
            console.error("Failed to fetch libraries:", e);
        }
    };

    const fetchDisplaySettings = async () => {
        try {
            const data = await fetchWithAuth("/api/admin/config/display").then((r) => r.json());
            setDisplaySettings(data);
        } catch (e) {
            console.error("Failed to fetch display settings:", e);
        }
    };

    const saveDisplaySettings = async (newSettings: DisplaySettings) => {
        setSavingDisplay(true);
        try {
            const r = await fetchWithAuth("/api/admin/config/display", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSettings),
            });
            if (!r.ok) {
                const text = await r.text();
                throw new Error(text || "Failed to save display settings");
            }
            setDisplaySettings(newSettings);
        } catch (e) {
            setError(String(e));
        } finally {
            setSavingDisplay(false);
        }
    };

    const rotationSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRotationPayload = useRef<RotationSettings | null>(null);

    const flushRotationSave = async (payload: RotationSettings, prev: RotationSettings) => {
        try {
            const r = await fetchWithAuth("/api/admin/config/rotation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!r.ok) {
                const text = await r.text();
                throw new Error(text || "Failed to save rotation settings");
            }
        } catch (e) {
            setError(String(e));
            setRotationSettings(prev);
            setMaxCollectionsInput(String(prev.max_collections));
        }
    };

    const saveRotationField = (updates: Partial<RotationSettings>) => {
        setRotationSettings((prev) => {
            if (!prev) return prev;
            const payload = { ...prev, ...updates };
            pendingRotationPayload.current = payload;

            if (rotationSaveTimer.current) clearTimeout(rotationSaveTimer.current);
            rotationSaveTimer.current = setTimeout(() => {
                if (pendingRotationPayload.current) {
                    flushRotationSave(pendingRotationPayload.current, prev);
                    pendingRotationPayload.current = null;
                }
            }, 300);

            return payload;
        });
    };

    const saveGroupOrder = async (orderedNames: string[]) => {
        try {
            const r = await fetchWithAuth("/api/admin/config/groups/reorder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ordered_group_names: orderedNames }),
            });
            if (!r.ok) {
                const text = await r.text();
                throw new Error(text || "Failed to save group order");
            }
        } catch (e) {
            setError(String(e));
            // Revert optimistic update on error
            await refreshGroups();
        }
    };

    // Drag-and-drop sensors with activation distance to avoid conflicts with clicks
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    // Sort groups by display_order for rendering
    const sortedGroups = useMemo(() => {
        return [...groups].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    }, [groups]);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const oldIndex = sortedGroups.findIndex((g) => g.name === active.id);
            const newIndex = sortedGroups.findIndex((g) => g.name === over.id);
            if (oldIndex === -1 || newIndex === -1) return;

            const reordered = arrayMove(sortedGroups, oldIndex, newIndex);
            // Optimistically update display_order locally
            const updated = groups.map((g) => {
                const newOrder = reordered.findIndex((r) => r.name === g.name);
                return { ...g, display_order: newOrder >= 0 ? newOrder : g.display_order };
            });
            setGroups(updated);

            // Persist to backend
            saveGroupOrder(reordered.map((g) => g.name));
        },
        [sortedGroups, groups]
    );

    const saveAutoRotateSettings = async (newSettings: AutoRotateSettings) => {
        if (!rotationSettings) return;
        setSavingAutoRotate(true);
        try {
            const payload = {
                ...rotationSettings,
                auto_rotate: newSettings,
            };
            const r = await fetchWithAuth("/api/admin/config/rotation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!r.ok) {
                const text = await r.text();
                throw new Error(text || "Failed to save auto-rotate settings");
            }
            setRotationSettings(payload);
            setAutoRotate(newSettings);
        } catch (e) {
            setError(String(e));
        } finally {
            setSavingAutoRotate(false);
        }
    };

    const handleAutoRotateToggle = async (enabled: boolean) => {
        const newSettings = { ...autoRotate, enabled };
        setAutoRotate(newSettings);
        if (enabled) {
            setAutoRotateExpanded(true);
        }
        await saveAutoRotateSettings(newSettings);
    };

    const handleLibraryToggle = async (libraryName: string) => {
        const currentLibraries = autoRotate.libraries;
        const newLibraries = currentLibraries.includes(libraryName)
            ? currentLibraries.filter((l) => l !== libraryName)
            : [...currentLibraries, libraryName];
        const newSettings = { ...autoRotate, libraries: newLibraries };
        setAutoRotate(newSettings);
        await saveAutoRotateSettings(newSettings);
    };

    const handleVisibilityChange = async (field: "visibility_home" | "visibility_shared" | "visibility_recommended", value: boolean) => {
        const newSettings = { ...autoRotate, [field]: value };
        setAutoRotate(newSettings);
        await saveAutoRotateSettings(newSettings);
    };

    useEffect(() => {
        refreshGroups();
        fetchRotationSettings();
        fetchLibraries();
        fetchDisplaySettings();
    }, []);

    // Auto-dismiss toast
    useEffect(() => {
        if (!message) return;
        setMessageVisible(true);
        const fadeTimer = setTimeout(() => setMessageVisible(false), 2500);
        const clearTimer = setTimeout(() => setMessage(null), 3000);
        return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
    }, [message]);

    const filteredGroups = useMemo(() => {
        return sortedGroups.filter((group) =>
            group.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
        );
    }, [sortedGroups, searchTerm]);

    const handleRename = async () => {
        if (!renaming) return;
        const target = groups[renaming.index];
        if (!target) return;
        try {
            setProcessingIndex(renaming.index);
            setMessage(null);
            const payload = { ...target, name: renaming.value.trim() || target.name };
            const r = await fetchWithAuth(`/api/admin/config/groups/${renaming.index}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const text = await r.text();
            if (!r.ok) throw new Error(text || "Failed to rename group");
            setRenaming(null);
            setMessage("Group updated");
            await refreshGroups();
        } catch (e) {
            setError(String(e));
        } finally {
            setProcessingIndex(null);
        }
    };

    const toggleEnabled = async (index: number) => {
        const target = groups[index];
        if (!target) return;

        // Optimistic update — flip locally first to avoid full re-render flash
        setGroups((prev) => prev.map((g, i) => i === index ? { ...g, enabled: !g.enabled } : g));

        try {
            const payload = { ...target, enabled: !target.enabled };
            const r = await fetchWithAuth(`/api/admin/config/groups/${index}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!r.ok) {
                // Revert on failure
                setGroups((prev) => prev.map((g, i) => i === index ? { ...g, enabled: target.enabled } : g));
                throw new Error(await r.text() || "Failed to update group");
            }
        } catch (e) {
            setError(String(e));
        }
    };

    const handleDelete = async (index: number) => {
        const target = groups[index];
        if (!target) return;
        try {
            setProcessingIndex(index);
            setMessage(null);
            const r = await fetchWithAuth(`/api/admin/config/groups/${index}`, { method: "DELETE" });
            const text = await r.text();
            if (!r.ok) throw new Error(text || "Failed to delete group");
            setMessage("Group deleted");
            await refreshGroups();
        } catch (e) {
            setError(String(e));
        } finally {
            setProcessingIndex(null);
        }
    };

    const renderCover = (group: CollectionGroup, index: number) => {
        const gradient = coverGradients[index % coverGradients.length];

        // If the group has collections, show the mosaic; otherwise show gradient
        if (group.collections && group.collections.length > 0) {
            return (
                <div className={`relative h-28 w-full rounded-2xl bg-gradient-to-r ${gradient}`}>
                    <GroupCoverMosaic collections={group.collections} />
                </div>
            );
        }

        return <div className={`h-28 w-full rounded-2xl bg-gradient-to-r ${gradient}`} />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-300">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading groups…
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tight text-white">Collection Groups</h1>
                        <p className="text-slate-400 text-sm max-w-2xl">
                            Browse and manage how your collections are organized into individual groups.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setLayoutModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-primary/50 hover:bg-slate-800 hover:text-white transition-all duration-200 self-start mt-1"
                    >
                        <LayoutGrid className="h-4 w-4 text-primary" />
                        Configure Layout
                    </button>
                </div>
            </div>

            {error ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-900/60 bg-red-900/40 px-4 py-3 text-red-100">
                    <span className="text-lg">!</span>
                    <p className="text-sm whitespace-pre-wrap">{error}</p>
                </div>
            ) : null}

            {/* Auto-rotate toggle section */}
            <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-amber-500/5">
                {/* Header - always visible */}
                <button
                    type="button"
                    onClick={() => setAutoRotateExpanded(!autoRotateExpanded)}
                    className="w-full p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left"
                >
                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                            <RefreshCw className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-white">Auto-rotate all collections</h3>
                            <p className="text-sm text-slate-400 max-w-lg">
                                Skip groups and rotate through all collections from your libraries automatically.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-shrink-0">
                        <Switch
                            checked={autoRotate.enabled}
                            onChange={handleAutoRotateToggle}
                            disabled={savingAutoRotate}
                            onClick={(e) => e.stopPropagation()}
                            className={`${
                                autoRotate.enabled ? "bg-amber-500" : "bg-slate-700"
                            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/70 disabled:opacity-60`}
                        >
                            <span
                                className={`${
                                    autoRotate.enabled ? "translate-x-6" : "translate-x-1"
                                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </Switch>
                        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${autoRotateExpanded ? "rotate-180" : ""}`} />
                    </div>
                </button>

                {/* Collapsible config panel with smooth animation */}
                <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                        autoRotateExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                >
                    <div className="overflow-hidden">
                        <div className="border-t border-amber-500/20 px-6 pb-6 space-y-6">
                            {/* Libraries selection */}
                            <div className="pt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-white">Libraries</label>
                                    <span className="text-xs text-slate-500">
                                        {autoRotate.libraries.length === 0 ? "All enabled libraries" : `${autoRotate.libraries.length} selected`}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400">
                                    Select which libraries to include. Leave empty to use all enabled libraries.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {libraries.filter(lib => lib.enabled).map((lib) => {
                                        const isSelected = autoRotate.libraries.includes(lib.name);
                                        return (
                                            <button
                                                key={lib.name}
                                                type="button"
                                                onClick={() => handleLibraryToggle(lib.name)}
                                                disabled={savingAutoRotate}
                                                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 disabled:opacity-60 ${
                                                    isSelected
                                                        ? "border-amber-500 bg-amber-500/20 text-amber-100"
                                                        : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
                                                }`}
                                            >
                                                {isSelected && <Check className="h-3.5 w-3.5" />}
                                                {lib.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Visibility settings */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-white">Visibility</label>
                                <p className="text-xs text-slate-400">
                                    Control where rotated collections appear on Plex.
                                </p>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {([
                                        { key: "visibility_home" as const, label: "Home", desc: "Admin's home page", icon: Home },
                                        { key: "visibility_shared" as const, label: "Shared", desc: "Other users' home", icon: Share2 },
                                        { key: "visibility_recommended" as const, label: "Recommended", desc: "Library recommended", icon: Compass },
                                    ]).map(({ key, label, desc, icon: Icon }) => {
                                        const isSelected = autoRotate[key];
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => handleVisibilityChange(key, !isSelected)}
                                                disabled={savingAutoRotate}
                                                className={`relative flex flex-col gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-200 disabled:opacity-60 ${
                                                    isSelected
                                                        ? "border-amber-500 bg-amber-500/20"
                                                        : "border-slate-700 bg-slate-900 hover:border-slate-600"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Icon className={`h-4.5 w-4.5 shrink-0 ${isSelected ? "text-amber-400" : "text-slate-500"}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-slate-300"}`}>{label}</span>
                                                        <p className="text-xs text-slate-500">{desc}</p>
                                                    </div>
                                                    <div className={`h-4 w-4 shrink-0 rounded-full border-2 transition-all duration-200 ${
                                                        isSelected
                                                            ? "border-amber-500 bg-amber-500"
                                                            : "border-slate-600 bg-transparent"
                                                    }`} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Status banner when enabled - animated */}
                <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                        autoRotate.enabled ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                >
                    <div className="overflow-hidden">
                        <div className="border-t border-amber-500/20 px-6 py-4 bg-amber-500/5">
                            <p className="text-sm text-amber-200">
                                Auto-rotate is enabled. The groups below are currently being ignored.
                                Rotations will cycle through collections from{" "}
                                <span className="font-semibold">
                                    {autoRotate.libraries.length === 0
                                        ? "all enabled libraries"
                                        : autoRotate.libraries.join(", ")}
                                </span>.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className={`rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 p-6 space-y-6 transition-opacity duration-300 ${autoRotate.enabled ? "opacity-50 pointer-events-none" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-white">Groups</h3>
                        <p className="text-sm text-slate-400">Drag to reorder, edit names, or jump into detailed configuration.</p>
                    </div>
                    <div className="shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => handleViewModeChange("cards")}
                                    className={`inline-flex items-center justify-center rounded-md p-1.5 transition-all duration-200 ${
                                        viewMode === "cards"
                                            ? "bg-primary/20 text-primary"
                                            : "text-slate-400 hover:text-slate-200"
                                    }`}
                                    title="Card view"
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleViewModeChange("list")}
                                    className={`inline-flex items-center justify-center rounded-md p-1.5 transition-all duration-200 ${
                                        viewMode === "list"
                                            ? "bg-primary/20 text-primary"
                                            : "text-slate-400 hover:text-slate-200"
                                    }`}
                                    title="List view"
                                >
                                    <List className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search groups"
                                    className="w-56 rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                {filteredGroups.length ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={filteredGroups.map((g) => g.name)} strategy={viewMode === "list" ? verticalListSortingStrategy : rectSortingStrategy}>
                            {viewMode === "list" ? (
                                <div className="flex flex-col gap-2">
                                    {filteredGroups.map((group) => {
                                        const originalIndex = groups.indexOf(group);
                                        const isRenaming = renaming?.index === originalIndex;
                                        const status = getGroupStatus(group);
                                        const statusStyles = {
                                            active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                                            scheduled: "bg-amber-500/20 text-amber-400 border-amber-500/30",
                                            disabled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
                                        };
                                        const statusLabels = {
                                            active: "Active",
                                            scheduled: "Scheduled",
                                            disabled: "Disabled",
                                        };
                                        return (
                                            <SortableGroupCard key={group.name} id={group.name} viewMode="list">
                                                {isRenaming ? (
                                                    <div className="flex flex-1 items-center gap-4 rounded-xl border border-primary/40 bg-slate-900/50 px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={renaming?.value ?? ""}
                                                            onChange={(e) => setRenaming({ index: originalIndex, value: e.target.value })}
                                                            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(null); }}
                                                            autoFocus
                                                            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleRename}
                                                            disabled={processingIndex === originalIndex}
                                                            className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                                                        >
                                                            {processingIndex === originalIndex ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => navigate(group.smart ? `/groups/smart/${originalIndex}` : `/groups/${originalIndex}`)}
                                                        className="group flex flex-1 items-center gap-4 rounded-xl border border-slate-800/60 bg-slate-900/50 px-4 py-3 hover:border-slate-700 hover:bg-slate-900/80 transition-all duration-200 cursor-pointer"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); toggleEnabled(originalIndex); }}
                                                            disabled={processingIndex === originalIndex}
                                                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 hover:brightness-125 disabled:opacity-60 ${statusStyles[status]}`}
                                                        >
                                                            {statusLabels[status]}
                                                        </button>
                                                        {group.smart && (
                                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30">
                                                                <Sparkles className="h-3 w-3" />
                                                            </span>
                                                        )}

                                                        <span className="text-sm font-semibold text-white truncate">
                                                            {group.name || "Untitled group"}
                                                        </span>
                                                        <span className="text-xs text-slate-500 shrink-0">
                                                            {group.smart ? `${group.rules?.length || 0} rules` : `${group.collections.length} collections`}
                                                        </span>

                                                        {(group.date_range?.start || group.date_range?.end) && (
                                                            <span className="hidden sm:inline-flex rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300 border border-slate-700/50 shrink-0">
                                                                {group.date_range?.start ? new Date(group.date_range.start).toLocaleDateString('en', { month: '2-digit', day: '2-digit' }) : '??/??'}
                                                                {' - '}
                                                                {group.date_range?.end ? new Date(group.date_range.end).toLocaleDateString('en', { month: '2-digit', day: '2-digit' }) : '??/??'}
                                                            </span>
                                                        )}

                                                        <div className="flex items-center gap-2 ml-auto shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setRenaming({ index: originalIndex, value: group.name }); }}
                                                                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:border-slate-600 hover:text-white transition-all duration-200 active:scale-95"
                                                                aria-label={`Rename ${group.name}`}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(originalIndex); }}
                                                                disabled={processingIndex === originalIndex}
                                                                className="rounded-lg border border-red-900/60 bg-red-900/40 p-1.5 text-red-100 hover:border-red-700 hover:bg-red-900/60 transition-all duration-200 active:scale-95 disabled:opacity-60"
                                                                aria-label={`Delete ${group.name}`}
                                                            >
                                                                {processingIndex === originalIndex ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </SortableGroupCard>
                                        );
                                    })}
                                    {!searchTerm && (
                                        <div
                                            onClick={() => setShowTypePicker(true)}
                                            className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-700/50 hover:border-primary/40 hover:bg-slate-800/30 px-4 py-3 ml-8 transition-all duration-300 cursor-pointer"
                                        >
                                            <Plus className="h-4 w-4 text-slate-500 group-hover:text-primary transition-colors shrink-0" />
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-medium text-slate-500 group-hover:text-slate-300 transition-colors">Create New Group</span>
                                                <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">And start adding collections</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {filteredGroups.map((group, index) => {
                                        const originalIndex = groups.indexOf(group);
                                        const isRenaming = renaming?.index === originalIndex;
                                        return (
                                            <SortableGroupCard key={group.name} id={group.name} viewMode="cards">
                                                <div
                                                    onClick={() => navigate(group.smart ? `/groups/smart/${originalIndex}` : `/groups/${originalIndex}`)}
                                                    className="group relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/50 shadow-md hover:shadow-xl hover:border-slate-700 transition-all duration-300 cursor-pointer"
                                                >
                                                    <div className="relative">
                                                        {renderCover(group, index)}
                                                        <div className="absolute left-3 top-3 flex items-center gap-1.5">
                                                            {(() => {
                                                                const status = getGroupStatus(group);
                                                                const statusStyles = {
                                                                    active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/20',
                                                                    scheduled: 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/20',
                                                                    disabled: 'bg-slate-500/20 text-slate-400 border border-slate-500/30 shadow-lg shadow-slate-500/20',
                                                                };
                                                                const statusLabels = {
                                                                    active: 'Active',
                                                                    scheduled: 'Scheduled',
                                                                    disabled: 'Disabled',
                                                                };
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); toggleEnabled(originalIndex); }}
                                                                        disabled={processingIndex === originalIndex}
                                                                        className={`rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm transition-all duration-200 hover:brightness-125 disabled:opacity-60 ${statusStyles[status]}`}
                                                                    >
                                                                        {statusLabels[status]}
                                                                    </button>
                                                                );
                                                            })()}
                                                            {group.smart && (
                                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30 backdrop-blur-sm">
                                                                    <Sparkles className="h-3 w-3" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        {(group.date_range?.start || group.date_range?.end) && (
                                                            <div className="absolute right-12 top-3 rounded-full bg-slate-900/80 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-slate-100 border border-slate-700/50">
                                                                {group.date_range?.start ? new Date(group.date_range.start).toLocaleDateString('en', { month: '2-digit', day: '2-digit' }) : '??/??'}
                                                                {' - '}
                                                                {group.date_range?.end ? new Date(group.date_range.end).toLocaleDateString('en', { month: '2-digit', day: '2-digit' }) : '??/??'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-4">
                                                        {isRenaming ? (
                                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="text"
                                                                    value={renaming?.value ?? ""}
                                                                    onChange={(e) => setRenaming({ index: originalIndex, value: e.target.value })}
                                                                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(null); }}
                                                                    autoFocus
                                                                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={handleRename}
                                                                    disabled={processingIndex === originalIndex}
                                                                    className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                                                                >
                                                                    {processingIndex === originalIndex ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="text-lg font-bold text-white truncate" title={group.name}>{group.name || "Untitled group"}</p>
                                                                    <p className="text-xs text-slate-400">{group.collections.length} collections</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); setRenaming({ index: originalIndex, value: group.name }); }}
                                                                        className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:border-slate-600 hover:text-white transition-all duration-200 active:scale-95"
                                                                        aria-label={`Rename ${group.name}`}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(originalIndex); }}
                                                                        disabled={processingIndex === originalIndex}
                                                                        className="rounded-lg border border-red-900/60 bg-red-900/40 p-2 text-red-100 hover:border-red-700 hover:bg-red-900/60 transition-all duration-200 active:scale-95 disabled:opacity-60"
                                                                        aria-label={`Delete ${group.name}`}
                                                                    >
                                                                        {processingIndex === originalIndex ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </SortableGroupCard>
                                        );
                                    })}
                                    {!searchTerm && (
                                        <div
                                            onClick={() => setShowTypePicker(true)}
                                            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-700/50 hover:border-primary/40 hover:bg-slate-800/30 transition-all duration-300 cursor-pointer"
                                            style={{ minHeight: '190px' }}
                                        >
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-all duration-200">
                                                <Plus className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className="text-sm font-medium text-slate-500 group-hover:text-slate-300 transition-colors">Create New Group</span>
                                                <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">And start adding collections</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </SortableContext>
                    </DndContext>
                ) : !searchTerm ? (
                    viewMode === "list" ? (
                        <div
                            onClick={() => setShowTypePicker(true)}
                            className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-700/50 hover:border-primary/40 hover:bg-slate-800/30 px-4 py-3 ml-8 transition-all duration-300 cursor-pointer"
                        >
                            <Plus className="h-4 w-4 text-slate-500 group-hover:text-primary transition-colors shrink-0" />
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-slate-500 group-hover:text-slate-300 transition-colors">Create New Group</span>
                                <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">And start adding collections</span>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            <div
                                onClick={() => setShowTypePicker(true)}
                                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-700/50 hover:border-primary/40 hover:bg-slate-800/30 transition-all duration-300 cursor-pointer"
                                style={{ minHeight: '190px' }}
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-all duration-200">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-center gap-1.5">
                                    <span className="text-sm font-medium text-slate-500 group-hover:text-slate-300 transition-colors">Create New Group</span>
                                    <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">And start adding collections</span>
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/50 p-6 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-900">
                            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                        </div>
                        <p className="mt-3 text-sm text-slate-300">No groups match your search.</p>
                    </div>
                )}
                </div>
            </section>

            {/* Homescreen Layout sheet */}
            <Sheet open={layoutModalOpen} onOpenChange={setLayoutModalOpen}>
                <SheetContent>
                    <SheetHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                                <LayoutGrid className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <SheetTitle>Layout Settings</SheetTitle>
                                <SheetDescription>Global display configuration</SheetDescription>
                            </div>
                        </div>
                        <SheetCloseButton />
                    </SheetHeader>
                    <SheetBody>
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-white">Display Mode</label>
                            <p className="text-xs text-slate-400">
                                Choose how collections from different groups are arranged on the Plex homescreen.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => saveDisplaySettings({ group_display_mode: "grouped" })}
                                    disabled={savingDisplay}
                                    className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all duration-200 ${
                                        displaySettings.group_display_mode === "grouped"
                                            ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                                            : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
                                    }`}
                                >
                                    {displaySettings.group_display_mode === "grouped" && (
                                        <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-primary" />
                                    )}
                                    <LayoutGrid className={`h-7 w-7 ${displaySettings.group_display_mode === "grouped" ? "text-primary" : "text-slate-500"}`} />
                                    <div className="text-center">
                                        <p className={`text-sm font-semibold ${displaySettings.group_display_mode === "grouped" ? "text-white" : "text-slate-300"}`}>Grouped</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Clustered by group</p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => saveDisplaySettings({ group_display_mode: "merged" })}
                                    disabled={savingDisplay}
                                    className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all duration-200 ${
                                        displaySettings.group_display_mode === "merged"
                                            ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                                            : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
                                    }`}
                                >
                                    {displaySettings.group_display_mode === "merged" && (
                                        <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-primary" />
                                    )}
                                    <Layers className={`h-7 w-7 ${displaySettings.group_display_mode === "merged" ? "text-primary" : "text-slate-500"}`} />
                                    <div className="text-center">
                                        <p className={`text-sm font-semibold ${displaySettings.group_display_mode === "merged" ? "text-white" : "text-slate-300"}`}>Merged</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Mixed throughout</p>
                                    </div>
                                </button>
                            </div>
                            {displaySettings.group_display_mode === "grouped" && (
                                <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
                                    <Lightbulb className="h-4 w-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                                    <p className="text-xs text-blue-200">Collections from each group are clustered together on the Plex homescreen.</p>
                                </div>
                            )}
                            {displaySettings.group_display_mode === "merged" && (
                                <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
                                    <Lightbulb className="h-4 w-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                                    <p className="text-xs text-blue-200">Collections from each group are dispersed throughout the Plex homescreen.</p>
                                </div>
                            )}
                        </div>

                        <hr className="border-slate-700/50" />

                        {/* Max Collections */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-white">Max Collections</label>
                                <span className="text-xs font-medium text-slate-300 tabular-nums">
                                    {rotationSettings?.max_collections ?? 1}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Limit the number of collections displayed.
                            </p>
                            <Slider
                                min={1}
                                max={20}
                                step={1}
                                value={[rotationSettings?.max_collections ?? 1]}
                                onValueChange={([val]) => {
                                    setMaxCollectionsInput(String(val));
                                    saveRotationField({ max_collections: val });
                                }}
                            />
                            <div className="flex justify-between text-[10px] text-slate-600">
                                <span>1</span>
                                <span>10</span>
                                <span>20</span>
                            </div>
                        </div>

                        <hr className="border-slate-700/50" />

                        {/* Selection Strategy */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white">Selection Strategy</label>
                            <p className="text-xs text-slate-400">
                                Determine how groups are ordered and how collections are picked within each group.
                            </p>
                            <Listbox
                                value={rotationSettings?.strategy ?? "random"}
                                onChange={(val) => saveRotationField({ strategy: val })}
                                disabled={!rotationSettings}
                            >
                                <div className="relative mt-2">
                                    <Listbox.Button className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/70 transition-colors">
                                        <span className="flex-1 text-left">
                                            {rotationSettings?.strategy === "weighted" ? "Weighted" :
                                             rotationSettings?.strategy === "lru" ? "Least Recently Used" :
                                             "Random"}
                                        </span>
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                    </Listbox.Button>
                                    <Listbox.Options className="absolute left-0 z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg focus:outline-none">
                                        <Listbox.Option
                                            value="random"
                                            className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <span>Random</span>
                                                    {selected && <Check className="h-4 w-4 text-white" />}
                                                </>
                                            )}
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="weighted"
                                            className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <span>Weighted</span>
                                                    {selected && <Check className="h-4 w-4 text-white" />}
                                                </>
                                            )}
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="lru"
                                            className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <span>Least Recently Used</span>
                                                    {selected && <Check className="h-4 w-4 text-white" />}
                                                </>
                                            )}
                                        </Listbox.Option>
                                    </Listbox.Options>
                                </div>
                            </Listbox>
                            {rotationSettings?.strategy === "random" && (
                                <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
                                    <Lightbulb className="h-4 w-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                                    <p className="text-xs text-blue-200">Groups are processed in display order. Collections are picked randomly within each group.</p>
                                </div>
                            )}
                            {rotationSettings?.strategy === "weighted" && (
                                <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
                                    <Lightbulb className="h-4 w-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                                    <p className="text-xs text-blue-200">Groups with higher weight are prioritized first. Collections are picked randomly within each group.</p>
                                </div>
                            )}
                            {rotationSettings?.strategy === "lru" && (
                                <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
                                    <Lightbulb className="h-4 w-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                                    <p className="text-xs text-blue-200">Groups are processed in display order. Collections that haven't been featured recently are picked first.</p>
                                </div>
                            )}
                        </div>

                        <hr className="border-slate-700/50" />

                        {/* Randomize Group Order */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-white">Randomize Group Order</label>
                                    <p className="text-xs text-slate-400">
                                        Shuffle which groups get priority each rotation so no single group always dominates.
                                    </p>
                                </div>
                                <Switch
                                    checked={rotationSettings?.randomize_group_order ?? false}
                                    onChange={(val) => saveRotationField({ randomize_group_order: val })}
                                    disabled={!rotationSettings}
                                    className={`${
                                        rotationSettings?.randomize_group_order ? "bg-primary" : "bg-slate-700"
                                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:opacity-60 shrink-0 ml-4`}
                                >
                                    <span
                                        className={`${
                                            rotationSettings?.randomize_group_order ? "translate-x-6" : "translate-x-1"
                                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                    />
                                </Switch>
                            </div>
                            {rotationSettings?.randomize_group_order && (
                                <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
                                    <Shuffle className="h-4 w-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                                    <p className="text-xs text-blue-200">Group processing order will be shuffled each rotation, overriding display order and weight-based sorting.</p>
                                </div>
                            )}
                        </div>
                    </SheetBody>
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={confirmDelete !== null}
                onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
                title="Delete Group"
                description={`Are you sure you want to delete "${confirmDelete !== null ? groups[confirmDelete]?.name : ""}"? This action cannot be undone.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={() => {
                    if (confirmDelete !== null) {
                        handleDelete(confirmDelete);
                    }
                    setConfirmDelete(null);
                }}
            />

            {/* Group type picker dialog */}
            <Dialog open={showTypePicker} onOpenChange={(open) => {
                setShowTypePicker(open);
                if (!open) { setNewGroupType(null); setNewGroupName(""); setCreateError(null); }
            }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <div>
                            <DialogTitle>{newGroupType ? "Name Your Group" : "Create New Group"}</DialogTitle>
                            <DialogDescription>{newGroupType ? "Give your group a name to get started." : "Choose how this group will manage its collections."}</DialogDescription>
                        </div>
                        <DialogCloseButton />
                    </DialogHeader>
                    {!newGroupType ? (
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setNewGroupType("basic")}
                                className="group flex flex-col items-center gap-3 rounded-xl border-2 border-slate-700/50 bg-slate-800/30 p-6 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 group-hover:bg-primary/20 group-hover:text-primary transition-all duration-200">
                                    <Layers className="h-6 w-6" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-white">Basic Group</p>
                                    <p className="text-xs text-slate-400 mt-1">Manually select which collections to include</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewGroupType("smart")}
                                className="group flex flex-col items-center gap-3 rounded-xl border-2 border-slate-700/50 bg-slate-800/30 p-6 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 group-hover:bg-primary/20 group-hover:text-primary transition-all duration-200">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-white">Smart Group</p>
                                    <p className="text-xs text-slate-400 mt-1">Automatically include collections matching your rules</p>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                {newGroupType === "smart" ? <Sparkles className="h-4 w-4 text-primary" /> : <Layers className="h-4 w-4 text-primary" />}
                                <span className="capitalize">{newGroupType} Group</span>
                                <button type="button" onClick={() => { setNewGroupType(null); setNewGroupName(""); setCreateError(null); }} className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors">Change</button>
                            </div>
                            <input
                                autoFocus
                                type="text"
                                value={newGroupName}
                                onChange={(e) => { setNewGroupName(e.target.value); setCreateError(null); }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && newGroupName.trim() && !creatingGroup) {
                                        e.preventDefault();
                                        document.getElementById("create-group-btn")?.click();
                                    }
                                }}
                                placeholder="e.g. Horror Collections, Trakt Lists..."
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70 text-sm"
                            />
                            {createError && (
                                <p className="text-sm text-red-400">{createError}</p>
                            )}
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowTypePicker(false); setNewGroupType(null); setNewGroupName(""); setCreateError(null); }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    id="create-group-btn"
                                    type="button"
                                    disabled={!newGroupName.trim() || creatingGroup}
                                    onClick={async () => {
                                        try {
                                            setCreatingGroup(true);
                                            setCreateError(null);
                                            const isSmart = newGroupType === "smart";
                                            const payload = isSmart
                                                ? { name: newGroupName.trim(), enabled: true, smart: true, rules: [{ field: "library", operator: "is", values: [] }], min_picks: 0, max_picks: 1, weight: 1, min_gap_rotations: 0, display_order: 0, visibility_home: true, visibility_shared: false, visibility_recommended: false, date_range: null, collections: [] }
                                                : { name: newGroupName.trim(), enabled: true, min_picks: 0, max_picks: 1, weight: 1, min_gap_rotations: 0, display_order: 0, visibility_home: true, visibility_shared: false, visibility_recommended: false, date_range: null, collections: [] };
                                            const r = await fetchWithAuth("/api/admin/config/groups", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify(payload),
                                            });
                                            if (!r.ok) {
                                                const text = await r.text();
                                                throw new Error(text || "Failed to create group");
                                            }
                                            const nextGroups = await fetchWithAuth("/api/admin/config/groups").then((res) => res.json());
                                            const targetIndex = nextGroups.length - 1;
                                            setShowTypePicker(false);
                                            setNewGroupType(null);
                                            setNewGroupName("");
                                            if (targetIndex >= 0) {
                                                navigate(isSmart ? `/groups/smart/${targetIndex}` : `/groups/${targetIndex}`);
                                            }
                                        } catch (e) {
                                            setCreateError(String(e));
                                        } finally {
                                            setCreatingGroup(false);
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {creatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Create Group
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Success toast */}
            {message && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/90 px-4 py-3 text-emerald-100 shadow-lg backdrop-blur-sm transition-all duration-500 ${messageVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <p className="text-sm font-medium">{message}</p>
                </div>
            )}
        </div>
    );
}
