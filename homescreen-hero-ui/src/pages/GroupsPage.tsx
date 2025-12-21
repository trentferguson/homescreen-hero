import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowRight,
    Check,
    Loader2,
    Pencil,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
} from "lucide-react";

import FormSection from "../components/FormSection";

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

    const activeCount = groups.filter((g) => g.enabled).length;

    const refreshGroups = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetch("/api/admin/config/groups").then((r) => r.json());
            setGroups(data);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshGroups();
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
            const r = await fetch("/api/admin/config/groups", {
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
            const r = await fetch(`/api/admin/config/groups/${renaming.index}`, {
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
            const r = await fetch(`/api/admin/config/groups/${index}`, { method: "DELETE" });
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

    const renderCover = (index: number) => {
        const gradient = coverGradients[index % coverGradients.length];
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
                            <span className="rounded-lg bg-slate-900 px-3 py-2">{groups.length} total groups</span>
                            <span className="rounded-lg bg-emerald-900/50 px-3 py-2 text-emerald-100">
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

            <FormSection
                title="Groups"
                description="Quickly edit names or jump into detailed configuration."
                actions={
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
                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as SortOption)}
                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                        >
                            <option value="recent">Recently updated</option>
                            <option value="name">Name A-Z</option>
                            <option value="size">Most collections</option>
                        </select>
                    </div>
                }
            >
                {filteredGroups.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredGroups.map((group, index) => {
                            const originalIndex = groups.indexOf(group);
                            const isRenaming = renaming?.index === originalIndex;
                            return (
                                <div
                                    key={`${group.name}-${index}`}
                                    className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 shadow-sm shadow-slate-900/50"
                                >
                                    <div className="relative">
                                        {renderCover(index)}
                                        <div className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${group.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                            {group.enabled ? "Active" : "Disabled"}
                                        </div>
                                        {(group.date_range?.start || group.date_range?.end) && (
                                            <div className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-100">
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
                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-primary/70 hover:text-white"
                                            >
                                                <SlidersHorizontal className="h-4 w-4" />
                                                Advanced
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/groups/${originalIndex}`)}
                                                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-slate-600 hover:bg-slate-800"
                                                >
                                                    Open editor
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(originalIndex)}
                                                    disabled={processingIndex === originalIndex}
                                                    className="rounded-lg border border-red-900/60 bg-red-900/40 p-2 text-red-100 hover:border-red-700 hover:bg-red-900/60 disabled:opacity-60"
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
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-900">
                            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                        </div>
                        <p className="mt-3 text-sm text-slate-300">No groups match your search.</p>
                    </div>
                )}
            </FormSection>

            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 px-6 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-slate-100">
                    <Plus className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                    <p className="text-lg font-semibold text-white">Create another group</p>
                    <p className="text-sm text-slate-400">Organize collections into sagas, events, or curated lists.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g"
                        className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                    />
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={creating}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:bg-blue-600 disabled:opacity-60"
                    >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New group
                    </button>
                </div>
            </div>
        </div>
    );
}