import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { useNavigate } from "react-router-dom";
import {
    ArrowRight,
    Check,
    ChevronDown,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    SlidersHorizontal,
    Trash2,
} from "lucide-react";
import { Listbox, Switch } from "@headlessui/react";

import GroupCoverMosaic from "../components/GroupCoverMosaic";
import { Checkbox } from "../components/ui/checkbox";
import { getGroupStatus, isGroupCurrentlyActive } from "../utils/dates";

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
    date_range?: DateRange | null;
    collections: string[];
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
};

const defaultAutoRotate: AutoRotateSettings = {
    enabled: false,
    libraries: [],
    visibility_home: true,
    visibility_shared: false,
    visibility_recommended: false,
};

const emptyGroup: CollectionGroup = {
    name: "",
    enabled: true,
    min_picks: 0,
    max_picks: 1,
    weight: 1,
    min_gap_rotations: 0,
    date_range: null,
    collections: [],
};

type RenameState = { index: number; value: string } | null;

type SortOption = "recent" | "name" | "size";

const coverGradients = [
    "from-indigo-900 via-slate-900 to-slate-950",
    "from-blue-900 via-slate-900 to-slate-950",
    "from-purple-900 via-slate-900 to-slate-950",
    "from-cyan-900 via-slate-900 to-slate-950",
    "from-amber-900 via-slate-900 to-slate-950",
    "from-emerald-900 via-slate-900 to-slate-950",
];

export default function GroupsPage() {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<CollectionGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [renaming, setRenaming] = useState<RenameState>(null);
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);
    const [sort, setSort] = useState<SortOption>("recent");
    const [searchTerm, setSearchTerm] = useState("");
    const [message, setMessage] = useState<string | null>(null);

    // Auto-rotate state
    const [autoRotate, setAutoRotate] = useState<AutoRotateSettings>(defaultAutoRotate);
    const [autoRotateExpanded, setAutoRotateExpanded] = useState(false);
    const [libraries, setLibraries] = useState<PlexLibrary[]>([]);
    const [savingAutoRotate, setSavingAutoRotate] = useState(false);
    const [rotationSettings, setRotationSettings] = useState<RotationSettings | null>(null);

    const activeCount = groups.filter((g) => isGroupCurrentlyActive(g)).length;

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
    }, []);

    const filteredGroups = useMemo(() => {
        const visible = groups.filter((group) =>
            group.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
        );

        switch (sort) {
            case "name":
                return [...visible].sort((a, b) => a.name.localeCompare(b.name));
            case "size":
                return [...visible].sort((a, b) => b.collections.length - a.collections.length);
            default:
                return visible;
        }
    }, [groups, searchTerm, sort]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            setCreating(true);
            setMessage(null);
            const payload = { ...emptyGroup, name: newName.trim() };
            const r = await fetchWithAuth("/api/admin/config/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const text = await r.text();
            if (!r.ok) throw new Error(text || "Failed to create group");
            setNewName("");
            setMessage("Group created");
            await refreshGroups();
        } catch (e) {
            setError(String(e));
        } finally {
            setCreating(false);
        }
    };

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
                <p className="text-xs uppercase tracking-wide text-slate-500">Collections</p>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tight text-white">Collection Groups</h1>
                        <p className="text-slate-400 text-sm max-w-2xl">
                            Manage how your collections are organized before diving into advanced settings. Create groups, adjust
                            names, and jump into detailed configuration when you’re ready.
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                        <span className="text-xs uppercase tracking-wide text-slate-500">Overview</span>
                        <div className="flex items-center gap-3 text-sm text-slate-200">
                            <span className="rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2">{groups.length} total groups</span>
                            <span className="rounded-lg border border-emerald-500/30 bg-emerald-900/40 px-3 py-2 text-emerald-100">
                                {activeCount} active
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {message ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-900/60 bg-emerald-900/40 px-4 py-3 text-emerald-100">
                    <Check className="h-4 w-4" />
                    <p className="text-sm">{message}</p>
                </div>
            ) : null}

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
                                    <label className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 cursor-pointer hover:border-slate-600 transition-colors">
                                        <Checkbox
                                            variant="amber"
                                            checked={autoRotate.visibility_home}
                                            onCheckedChange={(checked) => handleVisibilityChange("visibility_home", checked === true)}
                                            disabled={savingAutoRotate}
                                        />
                                        <div>
                                            <span className="text-sm text-white">Home</span>
                                            <p className="text-xs text-slate-500">Admin's home page</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 cursor-pointer hover:border-slate-600 transition-colors">
                                        <Checkbox
                                            variant="amber"
                                            checked={autoRotate.visibility_shared}
                                            onCheckedChange={(checked) => handleVisibilityChange("visibility_shared", checked === true)}
                                            disabled={savingAutoRotate}
                                        />
                                        <div>
                                            <span className="text-sm text-white">Shared</span>
                                            <p className="text-xs text-slate-500">Other users' home</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 cursor-pointer hover:border-slate-600 transition-colors">
                                        <Checkbox
                                            variant="amber"
                                            checked={autoRotate.visibility_recommended}
                                            onCheckedChange={(checked) => handleVisibilityChange("visibility_recommended", checked === true)}
                                            disabled={savingAutoRotate}
                                        />
                                        <div>
                                            <span className="text-sm text-white">Recommended</span>
                                            <p className="text-xs text-slate-500">Library recommended</p>
                                        </div>
                                    </label>
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
                        <p className="text-sm text-slate-400">Quickly edit names or jump into detailed configuration.</p>
                    </div>
                    <div className="shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
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
                            <Listbox value={sort} onChange={(value) => setSort(value as SortOption)}>
                                <div className="relative">
                                    <Listbox.Button className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/70 transition-colors min-w-[180px]">
                                        <span className="flex-1 text-left">
                                            {sort === "recent" && "Recently updated"}
                                            {sort === "name" && "Name A-Z"}
                                            {sort === "size" && "Most collections"}
                                        </span>
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                    </Listbox.Button>
                                    <Listbox.Options className="absolute right-0 z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg focus:outline-none">
                                        <Listbox.Option
                                            value="recent"
                                            className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <span>Recently updated</span>
                                                    {selected && <Check className="h-4 w-4 text-white" />}
                                                </>
                                            )}
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="name"
                                            className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <span>Name A-Z</span>
                                                    {selected && <Check className="h-4 w-4 text-white" />}
                                                </>
                                            )}
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="size"
                                            className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold flex items-center justify-between"
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <span>Most collections</span>
                                                    {selected && <Check className="h-4 w-4 text-white" />}
                                                </>
                                            )}
                                        </Listbox.Option>
                                    </Listbox.Options>
                                </div>
                            </Listbox>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                {filteredGroups.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredGroups.map((group, index) => {
                            const originalIndex = groups.indexOf(group);
                            const isRenaming = renaming?.index === originalIndex;
                            return (
                                <div
                                    key={`${group.name}-${index}`}
                                    className="group relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/50 shadow-md hover:shadow-xl hover:border-slate-700 transition-all duration-300"
                                >
                                    <div className="relative">
                                        {renderCover(group, index)}
                                        {(() => {
                                            const status = getGroupStatus(group);
                                            const statusStyles = {
                                                active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/20',
                                                scheduled: 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/20',
                                                disabled: 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/20',
                                            };
                                            const statusLabels = {
                                                active: 'Active',
                                                scheduled: 'Scheduled',
                                                disabled: 'Disabled',
                                            };
                                            return (
                                                <div className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm transition-all duration-200 ${statusStyles[status]}`}>
                                                    {statusLabels[status]}
                                                </div>
                                            );
                                        })()}
                                        {(group.date_range?.start || group.date_range?.end) && (
                                            <div className="absolute right-3 top-3 rounded-full bg-slate-900/80 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-slate-100 border border-slate-700/50">
                                                {group.date_range?.start ? new Date(group.date_range.start).toLocaleDateString('en', { month: '2-digit', day: '2-digit' }) : '??/??'}
                                                {' - '}
                                                {group.date_range?.end ? new Date(group.date_range.end).toLocaleDateString('en', { month: '2-digit', day: '2-digit' }) : '??/??'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3 p-4">
                                        {isRenaming ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={renaming?.value ?? ""}
                                                    onChange={(e) => setRenaming({ index: originalIndex, value: e.target.value })}
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
                                                <div>
                                                    <p className="text-lg font-bold text-white">{group.name || "Untitled group"}</p>
                                                    <p className="text-xs text-slate-400">{group.collections.length} collections</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setRenaming({ index: originalIndex, value: group.name })}
                                                    className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:border-slate-600 hover:text-white"
                                                    aria-label={`Rename ${group.name}`}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-3">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/groups/${originalIndex}`)}
                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 transition-all duration-200 hover:border-primary/70 hover:bg-primary/10 hover:text-white active:scale-95"
                                            >
                                                <SlidersHorizontal className="h-4 w-4" />
                                                Open Editor
                                                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(originalIndex)}
                                                    disabled={processingIndex === originalIndex}
                                                    className="rounded-lg border border-red-900/60 bg-red-900/40 p-2 text-red-100 hover:border-red-700 hover:bg-red-900/60 transition-all duration-200 active:scale-95 disabled:opacity-60"
                                                    aria-label={`Delete ${group.name}`}
                                                >
                                                    {processingIndex === originalIndex ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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

            <div className={`flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 hover:border-primary/50 px-6 py-8 text-center transition-all duration-300 ${autoRotate.enabled ? "opacity-50 pointer-events-none transition-opacity" : ""}`}>
                <button
                    type="button"
                    onClick={() => navigate('/groups/new')}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-slate-100 ring-2 ring-slate-800 hover:bg-slate-800 hover:ring-primary/50 transition-all duration-200 active:scale-95"
                >
                    <Plus className="h-5 w-5" />
                </button>
                <div className="space-y-1">
                    <p className="text-lg font-semibold text-white">Create another group</p>
                    <p className="text-sm text-slate-400">Organize collections into sagas, events, or curated lists.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g ‘Holiday Specials’"
                        className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70 focus:border-primary/50 transition-all duration-200"
                    />
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={creating}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 hover:bg-blue-600 active:scale-95 disabled:opacity-60"
                    >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New group
                    </button>
                </div>
            </div>
        </div>
    );
}