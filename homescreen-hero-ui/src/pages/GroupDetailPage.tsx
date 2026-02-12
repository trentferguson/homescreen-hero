import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarRange, Check, ChevronDown, Compass, Home, Lightbulb, Loader2, Minus, Plus, RefreshCcw, Search, Share2, SlidersHorizontal, Trash2 } from "lucide-react";
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
    date_range?: DateRange | null;
    collections: string[];
};

type CollectionSource = {
    name: string;
    source: "plex" | "trakt" | "letterboxd" | "mdblist";
    detail?: string | null;
};

type CollectionSourcesResponse = {
    plex: CollectionSource[];
    trakt: CollectionSource[];
    letterboxd: CollectionSource[];
    mdblist: CollectionSource[];
};

type ConfigSaveResponse = { ok: boolean; path: string; message: string; env_override: boolean };

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
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [messageVisible, setMessageVisible] = useState(false);
    const [sources, setSources] = useState<CollectionSource[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [sourceFilter, setSourceFilter] = useState<"all" | "plex" | "trakt" | "letterboxd" | "mdblist">("all");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
    const [renaming, setRenaming] = useState(false);
    const savedFormRef = useRef<string>("");
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const itemsPerPage = 24; // 4 columns × 6 rows

    useEffect(() => {
        setLoading(true);
        fetchWithAuth("/api/admin/config/groups")
            .then((r) => r.json())
            .then((data: CollectionGroup[]) => {
                setGroups(data);
            })
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (groupId === "new") {
            setSelectedIndex("new");
            setForm(emptyGroup);
            savedFormRef.current = "";
            return;
        }

        const parsedIndex = groupId !== undefined ? Number(groupId) : groups.length ? 0 : NaN;

        if (!Number.isNaN(parsedIndex) && groups[parsedIndex]) {
            setSelectedIndex(parsedIndex);
            setForm(groups[parsedIndex]);
            savedFormRef.current = JSON.stringify(groups[parsedIndex]);
        } else if (groups.length) {
            setSelectedIndex(0);
            setForm(groups[0]);
            savedFormRef.current = JSON.stringify(groups[0]);
        } else {
            setSelectedIndex("new");
            setForm(emptyGroup);
            savedFormRef.current = "";
        }
    }, [groupId, groups]);

    useEffect(() => {
        fetchWithAuth("/api/admin/config/group-sources")
            .then((r) => r.json())
            .then((data: CollectionSourcesResponse) => {
                const combined = [...(data.plex || []), ...(data.trakt || []), ...(data.letterboxd || []), ...(data.mdblist || [])];
                setSources(combined);
            })
            .catch(() => {
                // Non-fatal for UI; users can still type manual names
            });
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

    const resetToNew = () => {
        flushAutoSave();
        setMessage(null);
        setError(null);
        navigate("/groups/new", { replace: true });
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

    const handleNumberBlur = (key: keyof CollectionGroup) => {
        const val = form[key];
        if (val === "" || val === undefined || val === null) {
            setForm((prev) => ({ ...prev, [key]: 0 } as CollectionGroup));
        }
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
        if (!name.trim()) return;
        setForm((prev) => {
            if (prev.collections.includes(name)) return prev;
            return { ...prev, collections: [...prev.collections, name] };
        });
    };

    const removeCollection = (name: string) => {
        setForm((prev) => ({
            ...prev,
            collections: prev.collections.filter((c) => c !== name),
        }));
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

    const createGroup = async () => {
        try {
            setSaving(true);
            setError(null);
            setMessage(null);

            const payload: CollectionGroup = {
                ...form,
                date_range:
                    form.date_range && form.date_range.start && form.date_range.end
                        ? form.date_range
                        : null,
            };

            const r = await fetchWithAuth("/api/admin/config/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const text = await r.text();
            if (!r.ok) throw new Error(text || "Failed to create group");

            const resp = JSON.parse(text) as ConfigSaveResponse;
            setMessage(resp.message);

            const nextGroups = await fetchWithAuth("/api/admin/config/groups").then((res) => res.json());
            setGroups(nextGroups);
            const targetIndex = nextGroups.length - 1;
            if (targetIndex >= 0) {
                navigate(`/groups/${targetIndex}`);
            }
        } catch (e) {
            setError(String(e));
        } finally {
            setSaving(false);
        }
    };

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
                resetToNew();
            }
        } catch (e) {
            setError(String(e));
        } finally {
            setDeleting(false);
        }
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
                        {renaming && selectedIndex !== "new" ? (
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
                                    onClick={selectedIndex !== "new" ? () => setRenaming(true) : undefined}
                                    className={`text-3xl font-black tracking-tight text-white ${selectedIndex !== "new" ? "hover:text-slate-200 cursor-text transition-colors" : ""}`}
                                >
                                    {selectedIndex === "new" ? "Create New Group" : form.name || "Untitled Group"}
                                </span>
                                {groups.length > 0 && (
                                    <Listbox
                                        value={selectedIndex}
                                        onChange={(val: number | "new") => {
                                            if (val === "new") resetToNew();
                                            else onSelectGroup(val);
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
                                                <div className="border-t border-slate-700/50 mt-1 pt-1">
                                                    <Listbox.Option
                                                        value="new"
                                                        className="cursor-pointer px-4 py-2.5 hover:bg-slate-700 data-[selected]:bg-primary/15 flex items-center gap-2 text-slate-300"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        <span className="text-sm font-semibold">Create new group</span>
                                                    </Listbox.Option>
                                                </div>
                                            </Listbox.Options>
                                        </div>
                                    </Listbox>
                                )}
                                {selectedIndex !== "new" && (() => {
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
                        {selectedIndex === "new" && (
                            <p className="text-slate-400 text-sm mt-1">
                                Configure content sources, rotation schedules, and display rules for your homescreen.
                            </p>
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
                        {selectedIndex !== "new" && (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={deleting}
                                className="flex items-center justify-center p-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:border-red-500/50 hover:text-red-400 transition-all duration-200 disabled:opacity-50"
                            >
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                        )}
                        {selectedIndex === "new" && (
                            <button
                                type="button"
                                onClick={createGroup}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Create Group
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {error ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-900/60 bg-red-900/40 px-4 py-3 text-red-100">
                    <span className="text-lg">!</span>
                    <p className="text-sm whitespace-pre-wrap">{error}</p>
                </div>
            ) : null}

            {/* Group Name (new groups only) */}
            {selectedIndex === "new" && (
                <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="px-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                    placeholder="Group Name (Required)"
                />
            )}

            {/* Content Sources Section */}
            <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 p-6 space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-white tracking-tight">Content Sources</h3>
                        <p className="text-sm text-slate-400">Pull collections from Plex or any enabled third-party sources. Use the quick-add buttons or type names manually.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setForm((prev) => ({ ...prev, collections: [] }));
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-xs font-semibold hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 active:scale-95"
                    >
                        <RefreshCcw className="h-3.5 w-3.5" /> Clear Selections
                    </button>
                </div>

                {/* Selected Collections */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                            Selected Collections
                        </label>
                    </div>
                    {form.collections.length ? (
                        <div className="flex flex-wrap gap-2">
                            {form.collections.map((collection) => (
                                <span
                                    key={collection}
                                    className="group/chip inline-flex items-center rounded-full border border-slate-700/60 bg-slate-900/50 text-xs font-semibold text-slate-100 hover:border-primary/50 transition-all duration-200 has-[button:hover]:border-red-500/70 has-[button:hover]:bg-red-500/10 has-[button:hover]:text-red-100"
                                >
                                    <span className="pl-3 py-1.5">{collection}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeCollection(collection)}
                                        className="flex items-center justify-center px-2 py-1.5 rounded-r-full text-slate-500 hover:text-red-400 transition-colors"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 p-4 text-center">
                            <p className="text-xs text-slate-500">No collections selected.</p>
                        </div>
                    )}
                </div>

                {/* Available Sources */}
                <div className="space-y-3 pt-4 border-t border-slate-800/60">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                            Add From Available Sources
                        </label>
                        <p className="text-xs text-slate-500 mb-3">Choose from discovered Plex collections, configured Trakt lists, or Letterboxd lists.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search collections..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setSourceFilter("all")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                    sourceFilter === "all"
                                        ? "bg-primary text-white"
                                        : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                }`}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => setSourceFilter("plex")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                    sourceFilter === "plex"
                                        ? "text-white"
                                        : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                }`}
                                style={sourceFilter === "plex" ? { backgroundColor: "#b8860b" } : undefined}
                            >
                                Plex
                            </button>
                            <button
                                type="button"
                                onClick={() => setSourceFilter("trakt")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                    sourceFilter === "trakt"
                                        ? "text-white"
                                        : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                }`}
                                style={sourceFilter === "trakt" ? { backgroundColor: "#8b2e82" } : undefined}
                            >
                                Trakt
                            </button>
                            <button
                                type="button"
                                onClick={() => setSourceFilter("letterboxd")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                    sourceFilter === "letterboxd"
                                        ? "text-white"
                                        : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                }`}
                                style={sourceFilter === "letterboxd" ? { backgroundColor: "#00a63d" } : undefined}
                            >
                                Letterboxd
                            </button>
                            <button
                                type="button"
                                onClick={() => setSourceFilter("mdblist")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                    sourceFilter === "mdblist"
                                        ? "text-white"
                                        : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                }`}
                                style={sourceFilter === "mdblist" ? { backgroundColor: "#4284c9" } : undefined}
                            >
                                MDBList
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {paginatedSources.map((source) => (
                            <button
                                key={`${source.source}-${source.name}`}
                                type="button"
                                onClick={() => addCollection(source.name)}
                                className="flex flex-col gap-2 rounded-xl border border-slate-800/60 bg-slate-900/50 p-3 text-left text-sm text-slate-100 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold text-sm leading-tight flex-1">{source.name}</p>
                                    <span
                                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 text-white"
                                        style={{
                                            backgroundColor: source.source === "plex"
                                                ? "#e5a00d"
                                                : source.source === "trakt"
                                                ? "#af35a3"
                                                : source.source === "letterboxd"
                                                ? "#00a63d"
                                                : "#4284c9"
                                        }}
                                    >
                                        {source.source === "plex" ? "Plex" : source.source === "trakt" ? "Trakt" : source.source === "letterboxd" ? "Letterboxd" : "MDBList"}
                                    </span>
                                </div>
                                {source.detail ? (
                                    <p className="text-xs text-slate-400 line-clamp-2">{source.detail}</p>
                                ) : null}
                            </button>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/60">
                            <p className="text-xs text-slate-400">
                                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, availableSources.length)} of {availableSources.length}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    Previous
                                </button>
                                <div className="flex items-center gap-1">
                                    {(() => {
                                        // Build smart page list: 1 ... (current-1) current (current+1) ... totalPages
                                        const pages: (number | "ellipsis")[] = [];
                                        const showEllipsisThreshold = 7;

                                        if (totalPages <= showEllipsisThreshold) {
                                            // Show all pages if there aren't many
                                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                                        } else {
                                            // Always show first page
                                            pages.push(1);

                                            // Left ellipsis if current page is far from start
                                            if (currentPage > 3) {
                                                pages.push("ellipsis");
                                            }

                                            // Pages around current
                                            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                                                pages.push(i);
                                            }

                                            // Right ellipsis if current page is far from end
                                            if (currentPage < totalPages - 2) {
                                                pages.push("ellipsis");
                                            }

                                            // Always show last page
                                            if (!pages.includes(totalPages)) {
                                                pages.push(totalPages);
                                            }
                                        }

                                        return pages.map((page, idx) =>
                                            page === "ellipsis" ? (
                                                <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-500">…</span>
                                            ) : (
                                                <button
                                                    key={page}
                                                    type="button"
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                                        currentPage === page
                                                            ? "bg-primary text-white"
                                                            : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        );
                                    })()}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

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
                        {/* Pick Limits */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-white">Pick Limits</label>
                            <p className="text-xs text-slate-400">Min and max collections to include per rotation.</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Min picks</label>
                                    <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
                                        <button type="button" disabled={Number(form.min_picks) <= 0} onClick={() => handleNumberChange("min_picks", String(Math.max(0, Number(form.min_picks) - 1)))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                            <Minus className="h-4 w-4" />
                                        </button>
                                        <input type="number" min={0} value={form.min_picks} onChange={(e) => handleNumberChange("min_picks", e.target.value)} onBlur={() => handleNumberBlur("min_picks")} className="w-12 text-center text-sm font-semibold text-white tabular-nums bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                        <button type="button" onClick={() => handleNumberChange("min_picks", String(Number(form.min_picks) + 1))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Max picks</label>
                                    <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
                                        <button type="button" disabled={Number(form.max_picks) <= 0} onClick={() => handleNumberChange("max_picks", String(Math.max(0, Number(form.max_picks) - 1)))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                            <Minus className="h-4 w-4" />
                                        </button>
                                        <input type="number" min={0} value={form.max_picks} onChange={(e) => handleNumberChange("max_picks", e.target.value)} onBlur={() => handleNumberBlur("max_picks")} className="w-12 text-center text-sm font-semibold text-white tabular-nums bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                        <button type="button" onClick={() => handleNumberChange("max_picks", String(Number(form.max_picks) + 1))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-700/50" />

                        {/* Priority & Spacing */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-white">Priority & Spacing</label>
                            <p className="text-xs text-slate-400">Higher weights are picked more often. Min gap prevents repeats.</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Weight</label>
                                    <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
                                        <button type="button" disabled={Number(form.weight) <= 1} onClick={() => handleNumberChange("weight", String(Math.max(1, Number(form.weight) - 1)))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                            <Minus className="h-4 w-4" />
                                        </button>
                                        <input type="number" min={1} value={form.weight} onChange={(e) => handleNumberChange("weight", e.target.value)} onBlur={() => handleNumberBlur("weight")} className="w-12 text-center text-sm font-semibold text-white tabular-nums bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                        <button type="button" onClick={() => handleNumberChange("weight", String(Number(form.weight) + 1))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Min gap (rotations)</label>
                                    <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
                                        <button type="button" disabled={Number(form.min_gap_rotations) <= 0} onClick={() => handleNumberChange("min_gap_rotations", String(Math.max(0, Number(form.min_gap_rotations) - 1)))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                            <Minus className="h-4 w-4" />
                                        </button>
                                        <input type="number" min={0} value={form.min_gap_rotations} onChange={(e) => handleNumberChange("min_gap_rotations", e.target.value)} onBlur={() => handleNumberBlur("min_gap_rotations")} className="w-12 text-center text-sm font-semibold text-white tabular-nums bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                        <button type="button" onClick={() => handleNumberChange("min_gap_rotations", String(Number(form.min_gap_rotations) + 1))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-700/50" />

                        {/* Visibility */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-white">Visibility</label>
                            <p className="text-xs text-slate-400">Control where collections from this group appear on Plex.</p>
                            <div className="grid gap-2">
                                {([
                                    { key: "visibility_home" as const, label: "Home", icon: Home },
                                    { key: "visibility_shared" as const, label: "Shared", icon: Share2 },
                                    { key: "visibility_recommended" as const, label: "Recommended", icon: Compass },
                                ]).map(({ key, label, icon: Icon }) => {
                                    const isSelected = form[key];
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setForm((p) => ({ ...p, [key]: !p[key] }))}
                                            className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 transition-all duration-200 ${
                                                isSelected
                                                    ? "border-primary bg-primary/15"
                                                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                                            }`}
                                        >
                                            <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-slate-500"}`} />
                                            <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-slate-300"}`}>{label}</span>
                                            <div className={`h-4 w-4 shrink-0 rounded-full border-2 transition-all duration-200 ml-auto ${
                                                isSelected
                                                    ? "border-primary bg-primary"
                                                    : "border-slate-600 bg-transparent"
                                            }`} />
                                        </button>
                                    );
                                })}
                            </div>
                            {(() => {
                                const active = [
                                    form.visibility_home && "your homescreen",
                                    form.visibility_shared && "shared users' homescreens",
                                    form.visibility_recommended && "the Library Recommended section",
                                ].filter(Boolean) as string[];
                                const joined = active.length <= 2
                                    ? active.join(" and ")
                                    : `${active.slice(0, -1).join(", ")}, and ${active[active.length - 1]}`;
                                return (
                                    <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
                                        <Lightbulb className="h-4 w-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                                        <p className="text-xs text-blue-200">
                                            {active.length === 0
                                                ? "No visibility options selected. Collections in this group won't appear on any homescreen."
                                                : `Collections will appear on ${joined}.`}
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>

                        <hr className="border-slate-700/50" />

                        {/* Date Range */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <CalendarRange className="h-4 w-4 text-primary" />
                                <label className="text-sm font-medium text-white">Date Range</label>
                            </div>
                            <p className="text-xs text-slate-400">Optional activation window (MM-DD). Leave empty for year-round.</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Start</label>
                                    <input
                                        type="text"
                                        value={form.date_range?.start ?? ""}
                                        onChange={(e) => handleDateChange("start", e.target.value)}
                                        placeholder="11-20"
                                        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">End</label>
                                    <input
                                        type="text"
                                        value={form.date_range?.end ?? ""}
                                        onChange={(e) => handleDateChange("end", e.target.value)}
                                        placeholder="12-26"
                                        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                    />
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