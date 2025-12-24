import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarRange, Check, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react";
import FieldRow from "../components/FieldRow";
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
    visibility_home: boolean;
    visibility_shared: boolean;
    visibility_recommended: boolean;
    date_range?: DateRange | null;
    collections: string[];
};

type CollectionSource = {
    name: string;
    source: "plex" | "trakt";
    detail?: string | null;
};

type CollectionSourcesResponse = {
    plex: CollectionSource[];
    trakt: CollectionSource[];
};

type ConfigSaveResponse = { ok: boolean; path: string; message: string; env_override: boolean };

const emptyGroup: CollectionGroup = {
    name: "",
    enabled: true,
    min_picks: 0,
    max_picks: 1,
    weight: 1,
    min_gap_rotations: 0,
    visibility_home: true,
    visibility_shared: false,
    visibility_recommended: false,
    date_range: null,
    collections: [],
};

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-primary" : "bg-slate-600"}`}
    >
        <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-1"}`}
        />
    </button>
);

export default function GroupDetailPage() {
    const navigate = useNavigate();
    const { groupId } = useParams();
    const [groups, setGroups] = useState<CollectionGroup[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | "new">("new");
    const [form, setForm] = useState<CollectionGroup>(emptyGroup);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [sources, setSources] = useState<CollectionSource[]>([]);
    const [manualCollection, setManualCollection] = useState("");

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
            return;
        }

        const parsedIndex = groupId !== undefined ? Number(groupId) : groups.length ? 0 : NaN;

        if (!Number.isNaN(parsedIndex) && groups[parsedIndex]) {
            setSelectedIndex(parsedIndex);
            setForm(groups[parsedIndex]);
        } else if (groups.length) {
            setSelectedIndex(0);
            setForm(groups[0]);
        } else {
            setSelectedIndex("new");
            setForm(emptyGroup);
        }
    }, [groupId, groups]);

    useEffect(() => {
        fetchWithAuth("/api/admin/config/group-sources")
            .then((r) => r.json())
            .then((data: CollectionSourcesResponse) => {
                const combined = [...(data.plex || []), ...(data.trakt || [])];
                setSources(combined);
            })
            .catch(() => {
                // Non-fatal for UI; users can still type manual names
            });
    }, []);

    const resetToNew = () => {
        setMessage(null);
        setError(null);
        navigate("/groups/new", { replace: true });
    };

    const onSelectGroup = (index: number) => {
        const selected = groups[index];
        if (!selected) return;
        setMessage(null);
        setError(null);
        navigate(`/groups/${index}`);
    };

    const handleNumberChange = (key: keyof CollectionGroup, value: string) => {
        const num = value === "" ? 0 : Number(value);
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
        if (!name.trim()) return;
        setForm((prev) => {
            if (prev.collections.includes(name)) return prev;
            return { ...prev, collections: [...prev.collections, name] };
        });
        setManualCollection("");
    };

    const removeCollection = (name: string) => {
        setForm((prev) => ({
            ...prev,
            collections: prev.collections.filter((c) => c !== name),
        }));
    };

    const availableSources = useMemo(() => sources.filter((s) => !form.collections.includes(s.name)), [sources, form.collections]);

    const saveGroup = async () => {
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

            const isNew = selectedIndex === "new";
            const endpoint = isNew ? "/api/admin/config/groups" : `/api/admin/config/groups/${selectedIndex}`;
            const method = isNew ? "POST" : "PUT";

            const r = await fetchWithAuth(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const text = await r.text();
            if (!r.ok) throw new Error(text || "Failed to save group");

            const resp = JSON.parse(text) as ConfigSaveResponse;
            setMessage(resp.message);

            // Refresh groups list after save
            const nextGroups = await fetchWithAuth("/api/admin/config/groups").then((res) => res.json());
            setGroups(nextGroups);
            const targetIndex = isNew ? nextGroups.length - 1 : Number(selectedIndex);
            if (!Number.isNaN(targetIndex) && targetIndex >= 0) {
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
            <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Collections / Groups</p>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white">Edit Collection Group</h1>
                        <p className="text-slate-400 text-sm">
                            Configure content sources, rotation schedules, and display rules for your homescreen.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={resetToNew}
                            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-600"
                        >
                            Start new group
                        </button>
                        <button
                            type="button"
                            onClick={saveGroup}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:bg-blue-600 disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save changes
                        </button>
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

            <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
                <FormSection
                    title="Group overview"
                    description="Switch between groups or create a new one to manage its rotation behavior."
                    actions={
                        selectedIndex !== "new" ? (
                            <button
                                type="button"
                                onClick={deleteGroup}
                                disabled={deleting}
                                className="flex items-center gap-2 rounded-lg bg-red-900/60 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/80 disabled:opacity-60"
                            >
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                Delete group
                            </button>
                        ) : null
                    }
                >
                    <div className="space-y-3">
                        {groups.length ? (
                            <div className="grid grid-cols-1 gap-3">
                                {groups.map((group, idx) => {
                                    const isActive = idx === selectedIndex;
                                    return (
                                        <button
                                            key={group.name + idx}
                                            type="button"
                                            onClick={() => onSelectGroup(idx)}
                                            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${isActive
                                                ? "border-primary/80 bg-primary/10 text-white shadow-sm"
                                                : "border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-700"
                                                }`}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold">{group.name || `Group ${idx + 1}`}</p>
                                                <p className="text-xs text-slate-400">{group.collections.length} collections</p>
                                            </div>
                                            <span
                                                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${group.enabled
                                                    ? "bg-emerald-500/20 text-emerald-200"
                                                    : "bg-slate-800 text-slate-300"
                                                    }`}
                                            >
                                                {group.enabled ? "Enabled" : "Disabled"}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400">No groups yet. Start by creating one.</p>
                        )}

                        <button
                            type="button"
                            onClick={resetToNew}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
                        >
                            <Plus className="h-4 w-4" /> New group
                        </button>
                    </div>
                </FormSection>

                <div className="space-y-6">
                    <FormSection
                        title="Identity"
                        description="Name the group and toggle whether it's active for rotations."
                        actions={
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <span className="text-xs uppercase tracking-wide text-slate-500">Active status</span>
                                <Toggle checked={form.enabled} onChange={() => setForm((p) => ({ ...p, enabled: !p.enabled }))} />
                            </div>
                        }
                    >
                        <FieldRow
                            label="Group name"
                            hint="Required. The label shown across dashboards and logs."
                        >
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                placeholder="Holiday Movies"
                            />
                        </FieldRow>
                    </FormSection>

                    <FormSection
                        title="Rotation rules"
                        description="Control how many collections are pulled in and how often they repeat."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                                <p className="text-sm font-semibold text-slate-100">Pick limits</p>
                                <p className="text-xs text-slate-400">Min and max collections to include per rotation.</p>
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Min picks</label>
                                        <input
                                            type="number"
                                            value={form.min_picks}
                                            onChange={(e) => handleNumberChange("min_picks", e.target.value)}
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Max picks</label>
                                        <input
                                            type="number"
                                            value={form.max_picks}
                                            onChange={(e) => handleNumberChange("max_picks", e.target.value)}
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                                <p className="text-sm font-semibold text-slate-100">Priority & spacing</p>
                                <p className="text-xs text-slate-400">Higher weights are picked more often. Min gap prevents repeats.</p>
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Weight</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={form.weight}
                                            onChange={(e) => handleNumberChange("weight", e.target.value)}
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Min gap (rotations)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={form.min_gap_rotations}
                                            onChange={(e) => handleNumberChange("min_gap_rotations", e.target.value)}
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                            <div className="flex items-center gap-2 text-slate-100">
                                <CalendarRange className="h-4 w-4" />
                                <p className="text-sm font-semibold">Date range</p>
                                <p className="text-xs text-slate-400">Optional activation window (MM-DD).</p>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Start</label>
                                    <input
                                        type="text"
                                        value={form.date_range?.start ?? ""}
                                        onChange={(e) => handleDateChange("start", e.target.value)}
                                        placeholder="11-20"
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">End</label>
                                    <input
                                        type="text"
                                        value={form.date_range?.end ?? ""}
                                        onChange={(e) => handleDateChange("end", e.target.value)}
                                        placeholder="12-26"
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                    />
                                </div>
                            </div>
                        </div>
                    </FormSection>

                    <FormSection
                        title="Visibility settings"
                        description="Control where collections from this group appear on Plex homescreens."
                    >
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                            <p className="text-sm font-semibold text-slate-100 mb-3">Promote collections to</p>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-200">Your Home page</p>
                                        <p className="text-xs text-slate-400">Show on server admin's Home screen</p>
                                    </div>
                                    <Toggle
                                        checked={form.visibility_home}
                                        onChange={() => setForm((p) => ({ ...p, visibility_home: !p.visibility_home }))}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-200">Shared users' Home pages</p>
                                        <p className="text-xs text-slate-400">Show on friends'/shared users' Home screens</p>
                                    </div>
                                    <Toggle
                                        checked={form.visibility_shared}
                                        onChange={() => setForm((p) => ({ ...p, visibility_shared: !p.visibility_shared }))}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-200">Library Recommended</p>
                                        <p className="text-xs text-slate-400">Show in Library's Recommended section</p>
                                    </div>
                                    <Toggle
                                        checked={form.visibility_recommended}
                                        onChange={() => setForm((p) => ({ ...p, visibility_recommended: !p.visibility_recommended }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </FormSection>

                    <FormSection
                        title="Content sources"
                        description="Pull collections from Plex and Trakt. Use the quick-add buttons or type names manually."
                        actions={
                            <button
                                type="button"
                                onClick={() => {
                                    setForm((prev) => ({ ...prev, collections: [] }));
                                }}
                                className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500"
                            >
                                <RefreshCcw className="h-3.5 w-3.5" /> Clear selections
                            </button>
                        }
                    >
                        <FieldRow label="Selected collections" hint="Click a chip to remove it from the group.">
                            {form.collections.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {form.collections.map((collection) => (
                                        <button
                                            key={collection}
                                            type="button"
                                            onClick={() => removeCollection(collection)}
                                            className="group inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-red-500/70 hover:text-red-100"
                                        >
                                            {collection}
                                            <span className="text-slate-500 group-hover:text-red-200">×</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">No collections selected.</p>
                            )}
                        </FieldRow>

                        <FieldRow
                            label="Add from available sources"
                            description="Choose from discovered Plex collections or configured Trakt lists."
                        >
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {availableSources.map((source) => (
                                    <button
                                        key={`${source.source}-${source.name}`}
                                        type="button"
                                        onClick={() => addCollection(source.name)}
                                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-left text-sm text-slate-100 transition hover:border-primary/70 hover:text-white"
                                    >
                                        <div className="space-y-1">
                                            <p className="font-semibold">{source.name}</p>
                                            {source.detail ? (
                                                <p className="text-xs text-slate-400">{source.detail}</p>
                                            ) : null}
                                        </div>
                                        <span
                                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${source.source === "plex"
                                                ? "bg-blue-500/20 text-blue-100"
                                                : "bg-rose-500/20 text-rose-100"
                                                }`}
                                        >
                                            {source.source === "plex" ? "Plex" : "Trakt"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </FieldRow>

                        <FieldRow
                            label="Add manually"
                            hint="If you don't see a collection listed above, type its name and click Add."
                        >
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="text"
                                    value={manualCollection}
                                    onChange={(e) => setManualCollection(e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                                    placeholder="Christmas Classics"
                                />
                                <button
                                    type="button"
                                    onClick={() => addCollection(manualCollection)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-blue-600"
                                >
                                    <Plus className="h-4 w-4" /> Add
                                </button>
                            </div>
                        </FieldRow>
                    </FormSection>
                </div>
            </div>
        </div>
    );
}