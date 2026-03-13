import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpDown, Check, ChevronDown, Compass, Eye, Home, LayoutGrid, List, Loader2, Minus, Plus, Search, Share2, SlidersHorizontal, Trash2, X } from "lucide-react";
import { InfoTooltip } from "../components/ui/info-tooltip";
import { Listbox } from "@headlessui/react";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetBody,
    SheetCloseButton,
} from "../components/ui/sheet";
import { Slider } from "../components/ui/slider";
import { getGroupStatus } from "../utils/dates";


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
    visibility_home: boolean;
    visibility_shared: boolean;
    visibility_recommended: boolean;
    collection_selection?: "random" | "lru";
    collection_order?: "random" | "alpha" | null;
    collection_sort?: "release" | "alpha" | null;
    date_range?: DateRange | null;
    collections: string[];
};

type CollectionSource = {
    name: string;
    source: "plex" | "trakt" | "letterboxd" | "mdblist" | "tmdb" | "anilist" | "mal";
    detail?: string | null;
    poster_url?: string | null;
};

type CollectionSourcesResponse = {
    plex: CollectionSource[];
    trakt: CollectionSource[];
    letterboxd: CollectionSource[];
    mdblist: CollectionSource[];
    tmdb: CollectionSource[];
    anilist: CollectionSource[];
    mal: CollectionSource[];
};

type ConfigSaveResponse = { ok: boolean; path: string; message: string; env_override: boolean };

const sourceMeta: Record<string, { color: string; label: string }> = {
    plex: { color: "#e5a00d", label: "Plex" },
    trakt: { color: "#af35a3", label: "Trakt" },
    letterboxd: { color: "#00a63d", label: "Letterboxd" },
    mdblist: { color: "#4284c9", label: "MDBList" },
    tmdb: { color: "#01b4e4", label: "TMDb" },
    anilist: { color: "#2b2d42", label: "AniList" },
    mal: { color: "#2e51a2", label: "MAL" },
};

const sourceFilterButtons: { value: "all" | "plex" | "trakt" | "letterboxd" | "mdblist" | "tmdb"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "plex", label: "Plex" },
    { value: "trakt", label: "Trakt" },
    { value: "letterboxd", label: "Letterboxd" },
    { value: "mdblist", label: "MDBList" },
    { value: "tmdb", label: "TMDb" },
];

const emptyGroup: CollectionGroup = {
    name: "",
    enabled: true,
    min_picks: 0,
    max_picks: 1,
    weight: 1,
    min_gap_rotations: 0,
    display_order: 0,
    visibility_home: true,
    visibility_shared: false,
    visibility_recommended: false,
    collection_selection: "random",
    collection_order: null,
    collection_sort: null,
    date_range: null,
    collections: [],
};

export default function GroupDetailPage() {
    const navigate = useNavigate();
    const { groupId } = useParams();
    const [groups, setGroups] = useState<CollectionGroup[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | "new">("new");
    const [form, setForm] = useState<CollectionGroup>(emptyGroup);
    const [loading, setLoading] = useState(true);
    const [showPageSkeleton, setShowPageSkeleton] = useState(false);
    const pageSkeletonTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [messageVisible, setMessageVisible] = useState(false);
    const [sources, setSources] = useState<CollectionSource[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [sourceFilter, setSourceFilter] = useState<"all" | "plex" | "trakt" | "letterboxd" | "mdblist" | "tmdb" | "anilist" | "mal">("all");

    const [showSourcesSkeleton, setShowSourcesSkeleton] = useState(false);
    const sourcesSkeletonTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
    const [renaming, setRenaming] = useState(false);
    const [viewMode, setViewMode] = useState<"poster" | "card">("poster");
    const [exitingGrid, setExitingGrid] = useState<Set<string>>(new Set());
    const [exitingSidebar, setExitingSidebar] = useState<Set<string>>(new Set());
    const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
    const [initialLoad, setInitialLoad] = useState(true);
    const savedFormRef = useRef<string>("");
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const itemsPerPage = 24; // 4 columns × 6 rows

    useEffect(() => {
        setLoading(true);
        pageSkeletonTimer.current = setTimeout(() => setShowPageSkeleton(true), 300);
        fetchWithAuth("/api/admin/config/groups")
            .then((r) => r.json())
            .then((data: CollectionGroup[]) => {
                setGroups(data);
            })
            .catch((e) => setError(String(e)))
            .finally(() => {
                clearTimeout(pageSkeletonTimer.current);
                setLoading(false);
                setShowPageSkeleton(false);
            });
        return () => clearTimeout(pageSkeletonTimer.current);
    }, []);

    useEffect(() => {
        if (groupId === "new") {
            navigate("/groups", { replace: true });
            return;
        }

        const parsedIndex = groupId !== undefined ? Number(groupId) : groups.length ? 0 : NaN;

        if (!Number.isNaN(parsedIndex) && groups[parsedIndex]) {
            setSelectedIndex(parsedIndex);
            setForm({ ...groups[parsedIndex] });
            savedFormRef.current = JSON.stringify(groups[parsedIndex]);
        } else if (groups.length) {
            setSelectedIndex(0);
            setForm({ ...groups[0] });
            savedFormRef.current = JSON.stringify(groups[0]);
        } else {
            setSelectedIndex("new");
            setForm(emptyGroup);
            savedFormRef.current = "";
        }
    }, [groupId, groups]);

    useEffect(() => {
        // Only show skeleton if loading takes longer than 300ms
        sourcesSkeletonTimer.current = setTimeout(() => setShowSourcesSkeleton(true), 300);
        fetchWithAuth("/api/admin/config/group-sources")
            .then((r) => r.json())
            .then((data: CollectionSourcesResponse) => {
                const combined = [...(data.plex || []), ...(data.trakt || []), ...(data.letterboxd || []), ...(data.mdblist || []), ...(data.tmdb || []), ...(data.anilist || []), ...(data.mal || [])];
                setSources(combined);
            })
            .catch(() => {
                // Non-fatal for UI; users can still type manual names
            })
            .finally(() => {
                clearTimeout(sourcesSkeletonTimer.current);
                setShowSourcesSkeleton(false);
                // Clear initial load flag after stagger animations complete (~600ms)
                setTimeout(() => setInitialLoad(false), 600);
            });
        return () => clearTimeout(sourcesSkeletonTimer.current);
    }, []);

    // Auto-dismiss toast
    useEffect(() => {
        if (!message) return;
        setMessageVisible(true);
        const fadeTimer = setTimeout(() => setMessageVisible(false), 2500);
        const clearTimer = setTimeout(() => setMessage(null), 3000);
        return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
    }, [message]);

    // Auto-save for existing groups
    const autoSave = useCallback(async (formToSave: CollectionGroup, index: number) => {
        try {
            setAutoSaveError(null);
            const payload: CollectionGroup = {
                ...formToSave,
                date_range: formToSave.date_range?.start && formToSave.date_range?.end
                    ? formToSave.date_range : null,
            };
            const r = await fetchWithAuth(`/api/admin/config/groups/${index}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!r.ok) {
                const text = await r.text();
                throw new Error(text || "Failed to save group");
            }
            savedFormRef.current = JSON.stringify(formToSave);
        } catch (e) {
            setAutoSaveError(String(e));
        }
    }, []);

    const flushAutoSave = () => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = undefined;
        }
        if (selectedIndex !== "new") {
            const currentJson = JSON.stringify(form);
            if (currentJson !== savedFormRef.current) {
                autoSave(form, selectedIndex as number);
            }
        }
    };

    useEffect(() => {
        if (selectedIndex === "new") return;
        const currentJson = JSON.stringify(form);
        if (currentJson === savedFormRef.current) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        const formSnapshot = form;
        const indexSnapshot = selectedIndex as number;
        debounceRef.current = setTimeout(() => {
            autoSave(formSnapshot, indexSnapshot);
        }, 800);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [form, selectedIndex, autoSave]);

    const goToGroupsList = () => {
        flushAutoSave();
        setMessage(null);
        setError(null);
        navigate("/groups", { replace: true });
    };

    const onSelectGroup = (index: number) => {
        const selected = groups[index];
        if (!selected) return;
        flushAutoSave();
        setMessage(null);
        setError(null);
        navigate(`/groups/${index}`);
    };

    const handleNumberChange = (key: keyof CollectionGroup, value: string) => {
        // Allow empty string temporarily during editing (coerce to 0 on blur)
        if (value === "") {
            setForm((prev) => ({ ...prev, [key]: "" as unknown as number }));
            return;
        }
        const num = Number(value);
        setForm((prev) => ({ ...prev, [key]: Number.isNaN(num) ? 0 : num } as CollectionGroup));
    };

    const handleDateChange = (key: keyof DateRange, value: string) => {
        setForm((prev) => {
            const nextRange: DateRange = {
                start: prev.date_range?.start ?? "",
                end: prev.date_range?.end ?? "",
                [key]: value,
            } as DateRange;

            if (!nextRange.start && !nextRange.end) {
                return { ...prev, date_range: null };
            }

            return { ...prev, date_range: nextRange };
        });
    };

    const addCollection = (name: string) => {
        if (!name.trim() || form.collections.includes(name)) return;
        // Animate out from grid, then add to sidebar
        setExitingGrid((prev) => new Set(prev).add(name));
        setTimeout(() => {
            setExitingGrid((prev) => { const next = new Set(prev); next.delete(name); return next; });
            setRecentlyAdded((prev) => new Set(prev).add(name));
            setForm((prev) => {
                if (prev.collections.includes(name)) return prev;
                return { ...prev, collections: [...prev.collections, name] };
            });
            // Clear "recently added" flag after animation completes
            setTimeout(() => {
                setRecentlyAdded((prev) => { const next = new Set(prev); next.delete(name); return next; });
            }, 350);
        }, 200);
    };

    const removeCollection = (name: string) => {
        // Animate out from sidebar, then remove
        setExitingSidebar((prev) => new Set(prev).add(name));
        setTimeout(() => {
            setExitingSidebar((prev) => { const next = new Set(prev); next.delete(name); return next; });
            setForm((prev) => ({
                ...prev,
                collections: prev.collections.filter((c) => c !== name),
            }));
        }, 200);
    };

    const availableSources = useMemo(() => {
        let filtered = sources.filter((s) => !form.collections.includes(s.name));

        // Apply source filter
        if (sourceFilter !== "all") {
            filtered = filtered.filter((s) => s.source === sourceFilter);
        }

        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((s) =>
                s.name.toLowerCase().includes(query) ||
                s.detail?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [sources, form.collections, sourceFilter, searchQuery]);

    const paginatedSources = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return availableSources.slice(startIndex, endIndex);
    }, [availableSources, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(availableSources.length / itemsPerPage);

    // Reset to page 1 when filter or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [sourceFilter, searchQuery]);

    const deleteGroup = async () => {
        if (selectedIndex === "new") return;
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = undefined;
        }
        try {
            setDeleting(true);
            setError(null);
            setMessage(null);

            const r = await fetchWithAuth(`/api/admin/config/groups/${selectedIndex}`, { method: "DELETE" });
            const text = await r.text();
            if (!r.ok) throw new Error(text || "Failed to delete group");

            const resp = JSON.parse(text) as ConfigSaveResponse;
            setMessage(resp.message);

            const nextGroups = await fetchWithAuth("/api/admin/config/groups").then((res) => res.json());
            setGroups(nextGroups);
            if (nextGroups.length) {
                navigate(`/groups/0`, { replace: true });
            } else {
                goToGroupsList();
            }
        } catch (e) {
            setError(String(e));
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        if (!showPageSkeleton) return null;
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                {/* Header skeleton */}
                <div className="flex flex-col gap-4">
                    <div className="h-5 w-32 rounded bg-slate-800 animate-pulse" />
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-48 rounded-lg bg-slate-800 animate-pulse" />
                            <div className="h-7 w-20 rounded-full bg-slate-800 animate-pulse" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-9 w-32 rounded-lg bg-slate-800 animate-pulse" />
                            <div className="h-9 w-9 rounded-lg bg-slate-800 animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Two-column layout skeleton */}
                <div className="flex gap-5">
                    {/* Left column */}
                    <div className="flex-[2] min-w-0 space-y-4">
                        {/* Search bar */}
                        <div className="h-10 rounded-lg bg-slate-800/60 animate-pulse" />
                        {/* Filter pills */}
                        <div className="flex gap-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-8 w-20 rounded-lg bg-slate-800/40 animate-pulse" />
                            ))}
                        </div>
                        {/* Poster grid */}
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {Array.from({ length: 15 }).map((_, i) => (
                                <div key={i} className="rounded-xl overflow-hidden border border-slate-800/40">
                                    <div className="aspect-[2/3] bg-slate-800/60 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Right column */}
                    <div className="flex-1 min-w-[260px] max-w-[340px]">
                        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/40">
                                <div className="h-5 w-28 rounded bg-slate-700 animate-pulse" />
                            </div>
                            <div className="px-4 py-10 flex justify-center">
                                <div className="h-4 w-44 rounded bg-slate-800/60 animate-pulse" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <button
                    onClick={() => { flushAutoSave(); navigate("/groups"); }}
                    className="flex items-center gap-2 text-slate-400 hover:text-white w-fit transition-colors"
                >
                    <ArrowLeft size={20} />
                    Back to Groups
                </button>

                <div className="flex items-start justify-between gap-4">
                    <div>
                        {renaming ? (
                            <input
                                autoFocus
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                onBlur={() => setRenaming(false)}
                                onKeyDown={(e) => { if (e.key === "Enter") setRenaming(false); }}
                                className="text-3xl font-black tracking-tight text-white bg-transparent border-b-2 border-primary/50 outline-none w-full"
                                placeholder="Group name"
                            />
                        ) : (
                            <div className="relative flex items-center gap-3">
                                <span
                                    onClick={() => setRenaming(true)}
                                    className="text-3xl font-black tracking-tight text-white hover:text-slate-200 cursor-text transition-colors"
                                >
                                    {form.name || "Untitled Group"}
                                </span>
                                {groups.length > 0 && (
                                    <Listbox
                                        value={selectedIndex}
                                        onChange={(val: number | "new") => {
                                            if (typeof val === "number") onSelectGroup(val);
                                        }}
                                    >
                                        <div>
                                            <Listbox.Button className="flex items-center justify-center p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                                                <ChevronDown className="h-6 w-6" />
                                            </Listbox.Button>
                                            <Listbox.Options className="absolute left-0 z-50 mt-2 w-80 max-h-72 overflow-y-auto scrollbar-thin rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-xl focus:outline-none">
                                                {groups.map((group, idx) => {
                                                    const status = getGroupStatus(group);
                                                    const statusStyles = {
                                                        active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                                                        scheduled: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                                                        disabled: "bg-slate-800/60 text-slate-400 border-slate-700/50",
                                                    };
                                                    const statusLabels = {
                                                        active: "Enabled",
                                                        scheduled: "Scheduled",
                                                        disabled: "Disabled",
                                                    };
                                                    return (
                                                        <Listbox.Option
                                                            key={group.name + idx}
                                                            value={idx}
                                                            className="cursor-pointer px-4 py-2.5 hover:bg-slate-700 data-[selected]:bg-primary/15 flex items-center justify-between gap-3"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-white truncate">{group.name || `Group ${idx + 1}`}</p>
                                                                <p className="text-xs text-slate-400">{group.collections.length} collections</p>
                                                            </div>
                                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border shrink-0 ${statusStyles[status]}`}>
                                                                {statusLabels[status]}
                                                            </span>
                                                        </Listbox.Option>
                                                    );
                                                })}
                                            </Listbox.Options>
                                        </div>
                                    </Listbox>
                                )}
                                {(() => {
                                    const status = getGroupStatus(form);
                                    const pillStyles = {
                                        active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25",
                                        scheduled: "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25",
                                        disabled: "bg-slate-700/40 text-slate-400 border border-slate-600/50 hover:bg-slate-700/60",
                                    };
                                    const dotStyles = {
                                        active: "bg-emerald-400",
                                        scheduled: "bg-amber-400",
                                        disabled: "bg-slate-500",
                                    };
                                    const labels = {
                                        active: "Active",
                                        scheduled: "Scheduled",
                                        disabled: "Disabled",
                                    };
                                    return (
                                        <button
                                            type="button"
                                            onClick={() => setForm((p) => ({ ...p, enabled: !p.enabled }))}
                                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition-all duration-200 cursor-pointer ${pillStyles[status]}`}
                                        >
                                            <span className={`h-2 w-2 rounded-full ${dotStyles[status]}`} />
                                            {labels[status]}
                                        </button>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSettingsOpen(true)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:border-primary/50 hover:bg-slate-800 hover:text-white transition-all duration-200"
                        >
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                            Group Settings
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={deleting}
                            className="flex items-center justify-center p-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:border-red-500/50 hover:text-red-400 transition-all duration-200 disabled:opacity-50"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {error ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-900/60 bg-red-900/40 px-4 py-3 text-red-100">
                    <span className="text-lg">!</span>
                    <p className="text-sm whitespace-pre-wrap">{error}</p>
                </div>
            ) : null}

            {/* Content Sources - Two Column Layout */}
            <div className="flex gap-5">
                {/* Left column: collection browser */}
                <div className="flex-[2] min-w-0 space-y-4">
                    {/* Toolbar: search, filters, view toggle */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search collections..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </div>
                        <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setViewMode("poster")}
                                className={`p-2 transition-colors ${viewMode === "poster" ? "bg-primary/20 text-primary" : "bg-slate-800/60 text-slate-400 hover:text-slate-200"}`}
                                title="Poster view"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("card")}
                                className={`p-2 border-l border-slate-700 transition-colors ${viewMode === "card" ? "bg-primary/20 text-primary" : "bg-slate-800/60 text-slate-400 hover:text-slate-200"}`}
                                title="Card view"
                            >
                                <List className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {sourceFilterButtons.map(({ value, label }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setSourceFilter(value)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                    sourceFilter === value
                                        ? `text-white ${value === "all" ? "bg-primary" : ""}`
                                        : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                }`}
                                style={sourceFilter === value && value !== "all"
                                    ? { backgroundColor: sourceMeta[value]?.color }
                                    : undefined
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Collection grid */}
                    {showSourcesSkeleton ? (
                        <div className={viewMode === "poster"
                            ? "grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                            : "grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                        }>
                            {Array.from({ length: viewMode === "poster" ? 15 : 12 }).map((_, i) => (
                                viewMode === "poster" ? (
                                    <div key={i} className="rounded-xl overflow-hidden border border-slate-800/40">
                                        <div className="aspect-[2/3] bg-slate-800/60 animate-pulse" />
                                    </div>
                                ) : (
                                    <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-800/60 bg-slate-900/50 p-3">
                                        <div className="h-5 w-5 rounded-full bg-slate-700 animate-pulse shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-4 w-3/4 rounded bg-slate-800/60 animate-pulse" />
                                            <div className="h-3 w-1/2 rounded bg-slate-800/40 animate-pulse" />
                                        </div>
                                        <div className="h-4 w-12 rounded-full bg-slate-800/40 animate-pulse shrink-0" />
                                    </div>
                                )
                            ))}
                        </div>
                    ) : viewMode === "poster" ? (
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {paginatedSources.map((source, i) => {
                                const meta = sourceMeta[source.source] ?? { color: "#4284c9", label: source.source };
                                const isSelected = form.collections.includes(source.name);
                                const isExiting = exitingGrid.has(source.name);
                                return (
                                    <button
                                        key={`${source.source}-${source.name}`}
                                        type="button"
                                        onClick={() => isSelected ? removeCollection(source.name) : addCollection(source.name)}
                                        className={`group relative rounded-xl overflow-hidden border transition-all duration-200 ${
                                            isExiting ? "grid-item-exit" : initialLoad ? "grid-item-enter" : ""
                                        } ${
                                            isSelected
                                                ? "border-primary ring-2 ring-primary/30"
                                                : "border-slate-800/60 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10"
                                        }`}
                                        style={initialLoad && !isExiting ? { animationDelay: `${Math.min(i * 30, 400)}ms` } : undefined}
                                    >
                                        {/* Poster image or placeholder */}
                                        <div className="aspect-[2/3] bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
                                            {source.poster_url ? (
                                                <img
                                                    src={source.poster_url}
                                                    alt={source.name}
                                                    className="absolute inset-0 h-full w-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center p-3">
                                                    <span className="text-sm font-bold text-slate-500 text-center leading-tight">{source.name}</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Bottom overlay */}
                                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 pt-8">
                                            <p className="text-xs font-semibold text-white leading-tight truncate">{source.name}</p>
                                            {source.detail && <p className="text-[10px] text-slate-400 truncate mt-0.5">{source.detail}</p>}
                                        </div>
                                        {/* Source badge */}
                                        <span
                                            className="absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
                                            style={{ backgroundColor: meta.color }}
                                        >
                                            {meta.label}
                                        </span>
                                        {/* Selected checkmark */}
                                        {isSelected && (
                                            <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                                <Check className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            {paginatedSources.map((source, i) => {
                                const meta = sourceMeta[source.source] ?? { color: "#4284c9", label: source.source };
                                const isSelected = form.collections.includes(source.name);
                                const isExiting = exitingGrid.has(source.name);
                                return (
                                    <button
                                        key={`${source.source}-${source.name}`}
                                        type="button"
                                        onClick={() => isSelected ? removeCollection(source.name) : addCollection(source.name)}
                                        className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200 ${
                                            isExiting ? "grid-item-exit" : initialLoad ? "grid-item-enter" : ""
                                        } ${
                                            isSelected
                                                ? "border-primary/50 bg-primary/10"
                                                : "border-slate-800/60 bg-slate-900/50 hover:border-primary/30 hover:bg-slate-800/50"
                                        }`}
                                        style={initialLoad && !isExiting ? { animationDelay: `${Math.min(i * 25, 300)}ms` } : undefined}
                                    >
                                        {isSelected ? (
                                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                                <Check className="h-3 w-3 text-white" />
                                            </div>
                                        ) : (
                                            <div className="h-5 w-5 rounded-full border-2 border-slate-600 shrink-0" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-white truncate">{source.name}</p>
                                            {source.detail && <p className="text-xs text-slate-400 truncate">{source.detail}</p>}
                                        </div>
                                        <span
                                            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shrink-0"
                                            style={{ backgroundColor: meta.color }}
                                        >
                                            {meta.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-xs text-slate-500">
                                {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, availableSources.length)} of {availableSources.length}
                            </p>
                            <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    Prev
                                </button>
                                {(() => {
                                    const pages: (number | "ellipsis")[] = [];
                                    if (totalPages <= 7) {
                                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                                    } else {
                                        pages.push(1);
                                        if (currentPage > 3) pages.push("ellipsis");
                                        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                                        if (currentPage < totalPages - 2) pages.push("ellipsis");
                                        if (!pages.includes(totalPages)) pages.push(totalPages);
                                    }
                                    return pages.map((page, idx) =>
                                        page === "ellipsis" ? (
                                            <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-500">…</span>
                                        ) : (
                                            <button
                                                key={page}
                                                type="button"
                                                onClick={() => setCurrentPage(page)}
                                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                                                    currentPage === page ? "bg-primary text-white" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        )
                                    );
                                })()}
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column: selected collections sidebar */}
                <div className="flex-1 min-w-[260px] max-w-[340px]">
                    <div className="sticky top-4 rounded-2xl border border-slate-700/60 bg-slate-900/70 overflow-hidden">
                        {/* Sidebar header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/40">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-white">In This Group</h3>
                                <span className="rounded-full bg-primary/20 text-primary text-[11px] font-bold px-2 py-0.5">
                                    {form.collections.length}
                                </span>
                            </div>
                            {form.collections.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setForm((prev) => ({ ...prev, collections: [] }))}
                                    className="text-[11px] font-medium text-slate-500 hover:text-red-400 transition-colors"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        {/* Selected list */}
                        <div className="max-h-[480px] overflow-y-auto scrollbar-thin">
                            {form.collections.length ? (
                                <div className="divide-y divide-slate-800/60">
                                    {form.collections.map((name) => {
                                        const matchedSource = sources.find((s) => s.name === name);
                                        const meta = matchedSource ? (sourceMeta[matchedSource.source] ?? { color: "#4284c9", label: matchedSource.source }) : null;
                                        const isExiting = exitingSidebar.has(name);
                                        const isNew = recentlyAdded.has(name);
                                        return (
                                            <div
                                                key={name}
                                                className={`group flex items-center gap-2 px-4 py-2.5 hover:bg-slate-800/40 transition-colors ${
                                                    isExiting ? "sidebar-item-exit" : isNew ? "sidebar-item-enter" : ""
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-slate-200 truncate">{name}</p>
                                                </div>
                                                {meta && (
                                                    <span
                                                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shrink-0"
                                                        style={{ backgroundColor: meta.color }}
                                                    >
                                                        {meta.label}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeCollection(name)}
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 hover:text-red-400 transition-all"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="px-4 py-10 text-center">
                                    <p className="text-xs text-slate-500">Click collections to add them</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Group Settings Sheet */}
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetContent>
                    <SheetHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                                <SlidersHorizontal className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <SheetTitle>Group Settings</SheetTitle>
                                <SheetDescription>Rotation rules, visibility, and scheduling</SheetDescription>
                            </div>
                        </div>
                        <SheetCloseButton />
                    </SheetHeader>
                    <SheetBody>
                        {/* Rotation Rules */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-primary" />
                                <label className="text-base font-medium text-white">Rotation Rules</label>
                            </div>

                            {/* Pick range slider */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-slate-400">Collections to select</label>
                                    <span className="text-xs font-medium text-slate-300 tabular-nums">
                                        Min: {form.min_picks} / Max: {form.max_picks}
                                    </span>
                                </div>
                                <Slider
                                    min={0}
                                    max={10}
                                    step={1}
                                    value={[Number(form.min_picks), Number(form.max_picks)]}
                                    onValueChange={([min, max]) => {
                                        setForm((p) => ({ ...p, min_picks: min, max_picks: max }));
                                    }}
                                />
                                <div className="flex justify-between text-[10px] text-slate-600">
                                    <span>0</span>
                                    <span>5</span>
                                    <span>10</span>
                                </div>
                            </div>

                            {/* Weight & Min gap */}
                            <div className="flex items-end justify-between">
                                {([
                                    { key: "weight" as const, label: "Weight", min: 1 },
                                    { key: "min_gap_rotations" as const, label: "Min gap", min: 0 },
                                ]).map(({ key, label, min }) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <label className="text-xs text-slate-400 whitespace-nowrap">{label}</label>
                                        <div className="flex items-center rounded-md border border-slate-700 bg-slate-900 overflow-hidden">
                                            <button type="button" disabled={Number(form[key]) <= min} onClick={() => handleNumberChange(key, String(Math.max(min, Number(form[key]) - 1)))} className="flex items-center justify-center h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                                <Minus className="h-3 w-3" />
                                            </button>
                                            <span className="w-6 text-center text-xs font-semibold text-white tabular-nums">{form[key]}</span>
                                            <button type="button" onClick={() => handleNumberChange(key, String(Number(form[key]) + 1))} className="flex items-center justify-center h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <hr className="border-slate-700/50" />

                        {/* Visibility */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-primary" />
                                <label className="text-base font-medium text-white">Visibility</label>
                            </div>
                            <p className="text-xs text-slate-400">Control where collections from this group appear on Plex.</p>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { key: "visibility_home" as const, label: "Home", icon: Home },
                                    { key: "visibility_shared" as const, label: "Shared", icon: Share2 },
                                    { key: "visibility_recommended" as const, label: "Library", icon: Compass },
                                ]).map(({ key, label, icon: Icon }) => {
                                    const isSelected = form[key];
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setForm((p) => ({ ...p, [key]: !p[key] }))}
                                            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 transition-all duration-200 ${
                                                isSelected
                                                    ? "border-primary bg-primary/15"
                                                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                                            }`}
                                        >
                                            <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-slate-500"}`} />
                                            <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-slate-300"}`}>{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <label className="text-xs text-slate-400 whitespace-nowrap">Active <span className="text-slate-600">(optional)</span></label>
                                <input
                                    type="text"
                                    value={form.date_range?.start ?? ""}
                                    onChange={(e) => handleDateChange("start", e.target.value)}
                                    placeholder="MM-DD"
                                    className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-center text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                />
                                <span className="text-xs text-slate-500">–</span>
                                <input
                                    type="text"
                                    value={form.date_range?.end ?? ""}
                                    onChange={(e) => handleDateChange("end", e.target.value)}
                                    placeholder="MM-DD"
                                    className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-center text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                />
                            </div>
                        </div>

                        <hr className="border-slate-700/50" />

                        {/* Collection Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4 text-primary" />
                                <label className="text-base font-medium text-white">Collection Settings</label>
                            </div>

                            <div className="space-y-3">
                                {/* Selection */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm text-slate-300">Selection</span>
                                        <InfoTooltip text="How collections are picked from this group during rotation." />
                                    </div>
                                    <div className="inline-flex w-56 rounded-lg border border-slate-700 overflow-hidden">
                                        {([
                                            { value: "random" as const, label: "Random" },
                                            { value: "lru" as const, label: "Least Recent" },
                                        ]).map(({ value, label }, i, arr) => {
                                            const isSelected = form.collection_selection === value;
                                            return (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => setForm((p) => ({ ...p, collection_selection: value }))}
                                                    className={`flex-1 px-3 py-1.5 text-xs font-medium text-center transition-all duration-200 ${
                                                        i < arr.length - 1 ? "border-r border-slate-700" : ""
                                                    } ${
                                                        isSelected
                                                            ? "bg-primary/15 text-white"
                                                            : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Order */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm text-slate-300">Order</span>
                                        <InfoTooltip text="Display order of picked collections on the homescreen within this group." />
                                    </div>
                                    <div className="inline-flex w-56 rounded-lg border border-slate-700 overflow-hidden">
                                        {([
                                            { value: null, label: "Random" },
                                            { value: "alpha" as const, label: "Alpha" },
                                        ]).map(({ value, label }, i, arr) => {
                                            const isSelected = form.collection_order === value;
                                            return (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => setForm((p) => ({ ...p, collection_order: value }))}
                                                    className={`flex-1 px-3 py-1.5 text-xs font-medium text-center transition-all duration-200 ${
                                                        i < arr.length - 1 ? "border-r border-slate-700" : ""
                                                    } ${
                                                        isSelected
                                                            ? "bg-primary/15 text-white"
                                                            : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Sort */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm text-slate-300">Item Sort</span>
                                        <InfoTooltip text="Sort order for items within a collection when it gets selected." />
                                    </div>
                                    <div className="inline-flex w-56 rounded-lg border border-slate-700 overflow-hidden">
                                        {([
                                            { value: null, label: "Default" },
                                            { value: "release" as const, label: "Release" },
                                            { value: "alpha" as const, label: "Alpha" },
                                        ]).map(({ value, label }, i, arr) => {
                                            const isSelected = form.collection_sort === value;
                                            return (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => setForm((p) => ({ ...p, collection_sort: value }))}
                                                    className={`flex-1 px-3 py-1.5 text-xs font-medium text-center transition-all duration-200 ${
                                                        i < arr.length - 1 ? "border-r border-slate-700" : ""
                                                    } ${
                                                        isSelected
                                                            ? "bg-primary/15 text-white"
                                                            : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SheetBody>
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Group"
                description={`Are you sure you want to delete "${form.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    deleteGroup();
                }}
            />

            {/* Auto-save error toast */}
            {autoSaveError && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-950/90 px-4 py-3 text-red-100 shadow-lg backdrop-blur-sm">
                    <span className="text-lg leading-none">!</span>
                    <p className="text-sm font-medium">{autoSaveError}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setAutoSaveError(null);
                            if (selectedIndex !== "new") autoSave(form, selectedIndex as number);
                        }}
                        className="text-xs font-semibold text-red-200 hover:text-white underline"
                    >
                        Retry
                    </button>
                    <button
                        type="button"
                        onClick={() => setAutoSaveError(null)}
                        className="text-red-400 hover:text-white transition-colors text-lg leading-none"
                    >
                        ×
                    </button>
                </div>
            )}

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