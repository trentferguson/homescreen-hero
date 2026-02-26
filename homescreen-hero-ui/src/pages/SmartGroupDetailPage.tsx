import { useEffect, useState, useCallback, useRef } from "react";
import { fetchWithAuth } from "../utils/api";
import { getGroupStatus } from "../utils/dates";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    CalendarRange,
    Check,
    ChevronDown,
    Compass,
    Home,
    Lightbulb,
    Loader2,
    Minus,
    Plus,
    Share2,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    X,
} from "lucide-react";
import { Listbox } from "@headlessui/react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetBody,
    SheetCloseButton,
} from "../components/ui/sheet";
import { ConfirmDialog } from "../components/ui/confirm-dialog";

// ─── Types ───────────────────────────────────────────────────────────

type DateRange = { start: string; end: string };

type SmartGroupRule = {
    field: "label" | "source" | "library" | "name" | "item_count";
    operator: string;
    values: (string | number)[];
};

type SmartGroupForm = {
    name: string;
    enabled: boolean;
    smart: true;
    rules: SmartGroupRule[];
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

type FilterOptions = {
    labels: string[];
    sources: string[];
    libraries: string[];
};

type PreviewResult = {
    collections: string[];
    count: number;
};

// ─── Constants ───────────────────────────────────────────────────────

const FIELD_OPTIONS: { value: SmartGroupRule["field"]; label: string }[] = [
    { value: "label", label: "Label" },
    { value: "source", label: "Source" },
    { value: "library", label: "Library" },
    { value: "name", label: "Name" },
    { value: "item_count", label: "Item Count" },
];

const OPERATORS_BY_FIELD: Record<string, { value: string; label: string }[]> = {
    label: [
        { value: "includes", label: "includes any of" },
        { value: "excludes", label: "excludes all of" },
    ],
    source: [
        { value: "is", label: "is" },
        { value: "is_not", label: "is not" },
    ],
    library: [
        { value: "is", label: "is" },
        { value: "is_not", label: "is not" },
    ],
    name: [
        { value: "contains", label: "contains" },
        { value: "not_contains", label: "does not contain" },
    ],
    item_count: [
        { value: "gte", label: "at least" },
        { value: "lte", label: "at most" },
    ],
};

const SOURCE_OPTIONS = ["plex", "trakt", "letterboxd", "mdblist", "anilist", "mal"];

const SOURCE_COLORS: Record<string, string> = {
    plex: "bg-[#e5a00d]/20 text-[#e5a00d] border-[#e5a00d]/30",
    trakt: "bg-[#af35a3]/20 text-[#af35a3] border-[#af35a3]/30",
    letterboxd: "bg-[#00a63d]/20 text-[#00a63d] border-[#00a63d]/30",
    mdblist: "bg-[#4284c9]/20 text-[#4284c9] border-[#4284c9]/30",
    anilist: "bg-[#02a9ff]/20 text-[#02a9ff] border-[#02a9ff]/30",
    mal: "bg-[#2e51a2]/20 text-[#2e51a2] border-[#2e51a2]/30",
};

const emptyForm: SmartGroupForm = {
    name: "",
    enabled: true,
    smart: true,
    rules: [{ field: "label", operator: "includes", values: [] }],
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

// ─── Component ───────────────────────────────────────────────────────

export default function SmartGroupDetailPage() {
    const navigate = useNavigate();
    const { groupId } = useParams<{ groupId: string }>();
    const isNew = groupId === undefined || groupId === "new";

    const [form, setForm] = useState<SmartGroupForm>(emptyForm);
    const [groups, setGroups] = useState<SmartGroupForm[]>([]);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [messageVisible, setMessageVisible] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [renaming, setRenaming] = useState(false);

    // Filter options for rule builder dropdowns
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({ labels: [], sources: [], libraries: [] });

    // Live preview
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewExpanded, setPreviewExpanded] = useState(false);
    const previewDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Auto-save refs
    const savedFormRef = useRef<string>("");
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const selectedIndex = isNew ? "new" : Number(groupId);

    // ─── Data fetching ──────────────────────────────────────────

    useEffect(() => {
        fetchWithAuth("/api/admin/config/groups/smart-filter-options")
            .then((r) => r.json())
            .then(setFilterOptions)
            .catch(() => {}); // Non-critical
    }, []);

    useEffect(() => {
        if (isNew) return;
        setLoading(true);
        fetchWithAuth("/api/admin/config/groups")
            .then((r) => r.json())
            .then((allGroups: SmartGroupForm[]) => {
                setGroups(allGroups);
                const idx = Number(groupId);
                if (idx >= 0 && idx < allGroups.length) {
                    setForm(allGroups[idx]);
                    savedFormRef.current = JSON.stringify(allGroups[idx]);
                }
            })
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false));
    }, [groupId, isNew]);

    // ─── Live preview ───────────────────────────────────────────

    useEffect(() => {
        if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);

        // Only preview if there are rules with values
        const hasRules = form.rules.some((r) =>
            r.field === "item_count" ? r.values.length > 0 : r.values.length > 0
        );
        if (!hasRules) {
            setPreview(null);
            return;
        }

        previewDebounceRef.current = setTimeout(async () => {
            setPreviewLoading(true);
            try {
                const r = await fetchWithAuth("/api/admin/config/groups/preview-smart", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rules: form.rules }),
                });
                if (r.ok) {
                    const data = await r.json();
                    setPreview(data);
                }
            } catch {
                // Preview is non-critical
            } finally {
                setPreviewLoading(false);
            }
        }, 500);

        return () => {
            if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
        };
    }, [form.rules]);

    // ─── Auto-save ──────────────────────────────────────────────

    const autoSave = useCallback(async (formToSave: SmartGroupForm, index: number) => {
        try {
            setAutoSaveError(null);
            const payload = {
                ...formToSave,
                date_range: formToSave.date_range?.start && formToSave.date_range?.end ? formToSave.date_range : null,
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

    // Auto-dismiss toast
    useEffect(() => {
        if (!message) return;
        setMessageVisible(true);
        const fadeTimer = setTimeout(() => setMessageVisible(false), 2500);
        const clearTimer = setTimeout(() => setMessage(null), 3000);
        return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
    }, [message]);

    // ─── Actions ────────────────────────────────────────────────

    const createGroup = async () => {
        try {
            setSaving(true);
            setError(null);
            const payload = {
                ...form,
                date_range: form.date_range?.start && form.date_range?.end ? form.date_range : null,
            };
            const r = await fetchWithAuth("/api/admin/config/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const text = await r.text();
            if (!r.ok) throw new Error(text || "Failed to create group");

            const nextGroups = await fetchWithAuth("/api/admin/config/groups").then((res) => res.json());
            const targetIndex = nextGroups.length - 1;
            if (targetIndex >= 0) {
                setMessage("Smart group created");
                navigate(`/groups/smart/${targetIndex}`);
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
            const r = await fetchWithAuth(`/api/admin/config/groups/${selectedIndex}`, { method: "DELETE" });
            if (!r.ok) throw new Error("Failed to delete group");
            navigate("/groups");
        } catch (e) {
            setError(String(e));
        } finally {
            setDeleting(false);
        }
    };

    // ─── Rule helpers ───────────────────────────────────────────

    const updateRule = (index: number, updates: Partial<SmartGroupRule>) => {
        setForm((prev) => {
            const newRules = [...prev.rules];
            const current = newRules[index];
            const updated = { ...current, ...updates };

            // Reset operator and values when field changes
            if (updates.field && updates.field !== current.field) {
                updated.operator = OPERATORS_BY_FIELD[updates.field][0].value;
                updated.values = [];
            }

            newRules[index] = updated;
            return { ...prev, rules: newRules };
        });
    };

    const addRule = () => {
        setForm((prev) => ({
            ...prev,
            rules: [...prev.rules, { field: "label", operator: "includes", values: [] }],
        }));
    };

    const removeRule = (index: number) => {
        setForm((prev) => ({
            ...prev,
            rules: prev.rules.filter((_, i) => i !== index),
        }));
    };

    const toggleRuleValue = (ruleIndex: number, value: string) => {
        setForm((prev) => {
            const newRules = [...prev.rules];
            const rule = { ...newRules[ruleIndex] };
            const vals = [...rule.values];
            const idx = vals.indexOf(value);
            if (idx >= 0) vals.splice(idx, 1);
            else vals.push(value);
            rule.values = vals;
            newRules[ruleIndex] = rule;
            return { ...prev, rules: newRules };
        });
    };

    // ─── Number input helpers ───────────────────────────────────

    const handleNumberChange = (key: keyof SmartGroupForm, value: string) => {
        if (value === "") {
            setForm((prev) => ({ ...prev, [key]: "" as unknown as number }));
            return;
        }
        const num = Number(value);
        setForm((prev) => ({ ...prev, [key]: Number.isNaN(num) ? 0 : num }) as SmartGroupForm);
    };

    const handleNumberBlur = (key: keyof SmartGroupForm) => {
        const val = form[key];
        if (val === "" || val === undefined || val === null) {
            setForm((prev) => ({ ...prev, [key]: 0 }) as SmartGroupForm);
        }
    };

    const handleDateChange = (key: keyof DateRange, value: string) => {
        setForm((prev) => {
            const nextRange: DateRange = {
                start: prev.date_range?.start ?? "",
                end: prev.date_range?.end ?? "",
                [key]: value,
            };
            if (!nextRange.start && !nextRange.end) return { ...prev, date_range: null };
            return { ...prev, date_range: nextRange };
        });
    };

    // ─── Value options for a rule ────────────────────────────────

    const getValueOptions = (field: SmartGroupRule["field"]): string[] => {
        switch (field) {
            case "label": return filterOptions.labels;
            case "source": return SOURCE_OPTIONS;
            case "library": return filterOptions.libraries;
            default: return [];
        }
    };

    // ─── Render ─────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-6">
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
                    <div className="flex items-center gap-3">
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
                            <>
                                <span
                                    onClick={selectedIndex !== "new" ? () => setRenaming(true) : undefined}
                                    className={`text-3xl font-black tracking-tight text-white ${selectedIndex !== "new" ? "hover:text-slate-200 cursor-text transition-colors" : ""}`}
                                >
                                    {isNew ? "Create Smart Group" : form.name || "Untitled Group"}
                                </span>
                                <span className="shrink-0 rounded-full bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Smart
                                </span>
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
                            </>
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
                        {isNew && (
                            <button
                                type="button"
                                onClick={createGroup}
                                disabled={saving || !form.name.trim() || form.rules.length === 0}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Create Group
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Name input for new groups */}
            {isNew && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Group Name</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Horror Collections, Trakt Lists..."
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70 text-sm"
                    />
                </div>
            )}

            {/* Error / auto-save status */}
            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</div>
            )}
            {autoSaveError && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">Auto-save failed: {autoSaveError}</div>
            )}

            {/* Rule Builder */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Rules</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Collections matching <span className="text-slate-300 font-medium">all</span> rules will be included.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {form.rules.map((rule, i) => (
                        <div key={i} className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 shrink-0">
                                    {i === 0 ? "Where" : "And"}
                                </span>

                                {/* Field selector */}
                                <Listbox value={rule.field} onChange={(val) => updateRule(i, { field: val as SmartGroupRule["field"] })}>
                                    <div className="relative w-36">
                                        <Listbox.Button className="flex items-center justify-between w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-primary/70">
                                            <span>{FIELD_OPTIONS.find((f) => f.value === rule.field)?.label}</span>
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        </Listbox.Button>
                                        <Listbox.Options className="absolute z-20 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg">
                                            {FIELD_OPTIONS.map((opt) => (
                                                <Listbox.Option key={opt.value} value={opt.value} className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold">
                                                    {opt.label}
                                                </Listbox.Option>
                                            ))}
                                        </Listbox.Options>
                                    </div>
                                </Listbox>

                                {/* Operator selector */}
                                <Listbox value={rule.operator} onChange={(val) => updateRule(i, { operator: val })}>
                                    <div className="relative w-44">
                                        <Listbox.Button className="flex items-center justify-between w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-primary/70">
                                            <span>{OPERATORS_BY_FIELD[rule.field]?.find((o) => o.value === rule.operator)?.label}</span>
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        </Listbox.Button>
                                        <Listbox.Options className="absolute z-20 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg">
                                            {OPERATORS_BY_FIELD[rule.field]?.map((opt) => (
                                                <Listbox.Option key={opt.value} value={opt.value} className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 data-[selected]:bg-primary data-[selected]:font-semibold">
                                                    {opt.label}
                                                </Listbox.Option>
                                            ))}
                                        </Listbox.Options>
                                    </div>
                                </Listbox>

                                <div className="flex-1" />

                                {/* Remove rule */}
                                {form.rules.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeRule(i)}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Value input — varies by field type */}
                            {rule.field === "item_count" ? (
                                <div className="flex items-center gap-2 ml-[76px]">
                                    <input
                                        type="number"
                                        min={0}
                                        value={rule.values[0] ?? ""}
                                        onChange={(e) => {
                                            const v = e.target.value === "" ? [] : [Number(e.target.value)];
                                            updateRule(i, { values: v });
                                        }}
                                        placeholder="10"
                                        className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <span className="text-xs text-slate-400">items</span>
                                </div>
                            ) : rule.field === "name" ? (
                                <div className="ml-[76px] space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                        {(rule.values as string[]).map((v, vi) => (
                                            <span key={vi} className="flex items-center gap-1 rounded-full bg-primary/20 text-primary border border-primary/30 px-3 py-1 text-xs font-medium">
                                                {v}
                                                <button type="button" onClick={() => {
                                                    const newVals = [...rule.values];
                                                    newVals.splice(vi, 1);
                                                    updateRule(i, { values: newVals });
                                                }}>
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Type a keyword and press Enter"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                                updateRule(i, { values: [...rule.values, e.currentTarget.value.trim()] });
                                                e.currentTarget.value = "";
                                            }
                                        }}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                    />
                                </div>
                            ) : (
                                <div className="ml-[76px] flex flex-wrap gap-2">
                                    {getValueOptions(rule.field).map((opt) => {
                                        const isSelected = rule.values.includes(opt);
                                        const colorClass = rule.field === "source" && SOURCE_COLORS[opt];
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => toggleRuleValue(i, opt)}
                                                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all duration-200 ${
                                                    isSelected
                                                        ? colorClass || "bg-primary/20 text-primary border-primary/30"
                                                        : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-300"
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                    {getValueOptions(rule.field).length === 0 && (
                                        <p className="text-xs text-slate-500 italic">No options available</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={addRule}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-slate-700/50 px-4 py-2.5 text-sm text-slate-400 hover:text-primary hover:border-primary/40 transition-all duration-200"
                >
                    <Plus className="h-4 w-4" />
                    Add Rule
                </button>
            </section>

            {/* Live Preview */}
            <section className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-semibold text-white">Matching Collections</h3>
                        {previewLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : preview ? (
                            <span className="rounded-full bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 text-xs font-bold">
                                {preview.count}
                            </span>
                        ) : null}
                    </div>
                    {preview && preview.count > 0 && (
                        <button
                            type="button"
                            onClick={() => setPreviewExpanded(!previewExpanded)}
                            className="text-xs text-slate-400 hover:text-white transition-colors"
                        >
                            {previewExpanded ? "Collapse" : "Show all"}
                        </button>
                    )}
                </div>

                {!preview || preview.count === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                        {form.rules.some((r) => r.values.length > 0)
                            ? "No collections match these rules."
                            : "Add values to your rules to see matching collections."}
                    </p>
                ) : (
                    <div className={`flex flex-wrap gap-2 ${!previewExpanded && preview.count > 10 ? "max-h-20 overflow-hidden" : ""}`}>
                        {preview.collections.map((name) => (
                            <span key={name} className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs text-slate-300">
                                {name}
                            </span>
                        ))}
                    </div>
                )}
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
                                {(["min_picks", "max_picks"] as const).map((key) => (
                                    <div key={key} className="space-y-1">
                                        <label className="text-xs text-slate-400">{key === "min_picks" ? "Min picks" : "Max picks"}</label>
                                        <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
                                            <button type="button" disabled={Number(form[key]) <= 0} onClick={() => handleNumberChange(key, String(Math.max(0, Number(form[key]) - 1)))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                                <Minus className="h-4 w-4" />
                                            </button>
                                            <input type="number" min={0} value={form[key]} onChange={(e) => handleNumberChange(key, e.target.value)} onBlur={() => handleNumberBlur(key)} className="w-12 text-center text-sm font-semibold text-white tabular-nums bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                            <button type="button" onClick={() => handleNumberChange(key, String(Number(form[key]) + 1))} className="flex items-center justify-center h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
                                                isSelected ? "border-primary bg-primary/15" : "border-slate-700 bg-slate-900 hover:border-slate-600"
                                            }`}
                                        >
                                            <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-slate-500"}`} />
                                            <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-slate-300"}`}>{label}</span>
                                            <div className={`h-4 w-4 shrink-0 rounded-full border-2 transition-all duration-200 ml-auto ${isSelected ? "border-primary bg-primary" : "border-slate-600 bg-transparent"}`} />
                                        </button>
                                    );
                                })}
                            </div>
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
                                    <input type="text" value={form.date_range?.start ?? ""} onChange={(e) => handleDateChange("start", e.target.value)} placeholder="11-20" className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">End</label>
                                    <input type="text" value={form.date_range?.end ?? ""} onChange={(e) => handleDateChange("end", e.target.value)} placeholder="12-26" className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/70" />
                                </div>
                            </div>
                        </div>
                    </SheetBody>
                </SheetContent>
            </Sheet>

            {/* Delete confirmation */}
            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Smart Group"
                description={`Are you sure you want to delete "${form.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => { setShowDeleteConfirm(false); deleteGroup(); }}
            />

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
