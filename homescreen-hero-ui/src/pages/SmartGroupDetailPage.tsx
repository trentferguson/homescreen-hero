import { useEffect, useState, useCallback, useRef } from "react";
import { fetchWithAuth } from "../utils/api";
import { getGroupStatus } from "../utils/dates";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    CalendarRange,
    Check,
    ChevronDown,
    CircleDot,
    Compass,
    Home,
    Loader2,
    Minus,
    Plus,
    Search,
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
    field: "label" | "source" | "library" | "name" | "sort_title" | "item_count";
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

type PreviewCollection = {
    name: string;
    poster_url: string | null;
};

type PreviewResult = {
    collections: PreviewCollection[];
    count: number;
};

// ─── Constants ───────────────────────────────────────────────────────

const FIELD_OPTIONS: { value: SmartGroupRule["field"]; label: string }[] = [
    { value: "label", label: "Label" },
    { value: "source", label: "Source" },
    { value: "library", label: "Library" },
    { value: "name", label: "Name" },
    { value: "sort_title", label: "Sort Title" },
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
    sort_title: [
        { value: "contains", label: "contains" },
        { value: "not_contains", label: "does not contain" },
    ],
    item_count: [
        { value: "gte", label: "at least" },
        { value: "lte", label: "at most" },
    ],
};

const SOURCE_OPTIONS = ["plex", "trakt", "letterboxd", "mdblist", "anilist", "mal"];

const emptyForm: SmartGroupForm = {
    name: "",
    enabled: true,
    smart: true,
    rules: [{ field: "library", operator: "is", values: [] }],
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
    const [loading, setLoading] = useState(true);
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
    const [labelSearches, setLabelSearches] = useState<Record<number, string>>({});

    // Rule card animations
    const [animatingIn, setAnimatingIn] = useState<number | null>(null);
    const [removingIndex, setRemovingIndex] = useState<number | null>(null);

    // Live preview
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewExpanded, setPreviewExpanded] = useState(false);
    const previewDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [loadedPreviewPosters, setLoadedPreviewPosters] = useState<Record<string, boolean>>({});
    const [previewRevision, setPreviewRevision] = useState(0);

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
        if (isNew) { navigate("/groups", { replace: true }); return; }
        setLoading(true);
        fetchWithAuth("/api/admin/config/groups")
            .then((r) => r.json())
            .then((allGroups: SmartGroupForm[]) => {
                const idx = Number(groupId);
                if (idx >= 0 && idx < allGroups.length) {
                    setForm(allGroups[idx]);
                    savedFormRef.current = JSON.stringify(allGroups[idx]);
                }
            })
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false));
    }, [groupId, isNew, navigate]);

    // ─── Live preview ───────────────────────────────────────────

    useEffect(() => {
        if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);

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
                    setPreviewRevision((r) => r + 1);
                    setLoadedPreviewPosters({});
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
        setAnimatingIn(form.rules.length);
        setForm((prev) => ({
            ...prev,
            rules: [...prev.rules, { field: "library", operator: "is", values: [] }],
        }));
        setTimeout(() => setAnimatingIn(null), 250);
    };

    const removeRule = (index: number) => {
        if (removingIndex !== null) return;
        setRemovingIndex(index);
        setTimeout(() => {
            setForm((prev) => ({
                ...prev,
                rules: prev.rules.filter((_, i) => i !== index),
            }));
            setRemovingIndex(null);
        }, 200);
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

    const hasRuleValues = form.rules.some((r) => r.values.length > 0);
    const previewCollections = preview?.collections ?? [];
    const PREVIEW_LIMIT = 15;
    const hasOverflow = previewCollections.length > PREVIEW_LIMIT;
    // When collapsed with overflow, show 14 posters + the "+N" tile to fill the grid
    const visiblePreviewCollections = previewExpanded
        ? previewCollections
        : hasOverflow
            ? previewCollections.slice(0, PREVIEW_LIMIT - 1)
            : previewCollections;

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
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
                            <>
                                <span
                                    onClick={() => setRenaming(true)}
                                    className="text-3xl font-black tracking-tight text-white hover:text-slate-200 cursor-text transition-colors"
                                >
                                    {form.name || "Untitled Group"}
                                </span>
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30">
                                    <Sparkles className="h-3.5 w-3.5" />
                                </span>
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

            {/* Error / auto-save status */}
            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</div>
            )}
            {autoSaveError && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">Auto-save failed: {autoSaveError}</div>
            )}
            <div className="grid gap-6 xl:gap-0 xl:divide-x xl:divide-slate-800/70 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
                {/* Rule Builder */}
                <section className="space-y-4 xl:pr-6">
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-slate-100">Rules</h2>
                        <p className="text-xs text-slate-400">Collections matching <span className="text-slate-200 font-medium">all</span> rules will be included.</p>
                    </div>

                    <div className="space-y-3">
                        {form.rules.map((rule, i) => (
                            <div key={i} className={`${animatingIn === i ? 'rule-card-enter' : ''} ${removingIndex === i ? 'rule-card-exit' : ''}`}>
                                {i > 0 && (
                                    <div className="flex items-center gap-3 pb-3 -mt-1">
                                        <div className="flex-1 border-t border-slate-700/50" />
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">and</span>
                                        <div className="flex-1 border-t border-slate-700/50" />
                                    </div>
                                )}
                            <div className="space-y-3 rounded-xl border border-blue-500/15 bg-[#0f1d35]/85 p-4 shadow-[inset_0_0_0_1px_rgba(30,64,175,0.14)]">
                                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                                    {/* Field selector */}
                                    <Listbox value={rule.field} onChange={(val) => updateRule(i, { field: val as SmartGroupRule["field"] })}>
                                        <div className="relative w-full sm:w-36 shrink-0">
                                            <Listbox.Button className="flex items-center justify-between w-full rounded-lg border border-slate-500/40 bg-slate-700/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700/55 focus:outline-none focus:ring-2 focus:ring-slate-400/45">
                                                <span>{FIELD_OPTIONS.find((f) => f.value === rule.field)?.label}</span>
                                                <ChevronDown className="h-3.5 w-3.5 text-slate-300/80" />
                                            </Listbox.Button>
                                            <Listbox.Options className="absolute z-20 mt-1 w-full rounded-lg border border-slate-500/40 bg-slate-800/95 py-1 shadow-lg">
                                                {FIELD_OPTIONS.map((opt) => (
                                                    <Listbox.Option key={opt.value} value={opt.value} className="cursor-pointer px-3 py-2 text-sm text-slate-100 hover:bg-slate-700/70 data-[selected]:bg-slate-600/80 data-[selected]:font-semibold">
                                                        {opt.label}
                                                    </Listbox.Option>
                                                ))}
                                            </Listbox.Options>
                                        </div>
                                    </Listbox>

                                    {/* Operator selector */}
                                    <Listbox value={rule.operator} onChange={(val) => updateRule(i, { operator: val })}>
                                        <div className="relative w-full sm:w-44 shrink-0">
                                            <Listbox.Button className="flex items-center justify-between w-full rounded-lg border border-slate-500/40 bg-slate-700/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700/55 focus:outline-none focus:ring-2 focus:ring-slate-400/45">
                                                <span>{OPERATORS_BY_FIELD[rule.field]?.find((o) => o.value === rule.operator)?.label}</span>
                                                <ChevronDown className="h-3.5 w-3.5 text-slate-300/80" />
                                            </Listbox.Button>
                                            <Listbox.Options className="absolute z-20 mt-1 w-full rounded-lg border border-slate-500/40 bg-slate-800/95 py-1 shadow-lg">
                                                {OPERATORS_BY_FIELD[rule.field]?.map((opt) => (
                                                    <Listbox.Option key={opt.value} value={opt.value} className="cursor-pointer px-3 py-2 text-sm text-slate-100 hover:bg-slate-700/70 data-[selected]:bg-slate-600/80 data-[selected]:font-semibold">
                                                        {opt.label}
                                                    </Listbox.Option>
                                                ))}
                                            </Listbox.Options>
                                        </div>
                                    </Listbox>

                                    {/* Remove rule */}
                                    {form.rules.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeRule(i)}
                                            className="shrink-0 sm:ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Value input varies by field type */}
                                {rule.field === "item_count" ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            value={rule.values[0] ?? ""}
                                            onChange={(e) => {
                                                const v = e.target.value === "" ? [] : [Number(e.target.value)];
                                                updateRule(i, { values: v });
                                            }}
                                            placeholder="10"
                                            className="w-24 rounded-lg border border-blue-400/25 bg-[#102140] px-3 py-2 text-sm text-blue-100 placeholder-blue-200/35 focus:outline-none focus:ring-2 focus:ring-blue-500/55 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <span className="text-xs text-slate-400">items</span>
                                    </div>
                                ) : rule.field === "name" || rule.field === "sort_title" ? (
                                    <div className="space-y-2 rounded-xl border border-blue-400/15 bg-[#0d1a31] px-3 pb-3 pt-2">
                                        {(rule.values as string[]).length > 0 && (
                                            <div className="flex flex-wrap gap-2.5">
                                                {(rule.values as string[]).map((v, vi) => (
                                                    <span key={vi} className="flex items-center gap-1.5 rounded-lg border border-blue-400/25 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-200">
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
                                        )}
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="text"
                                                placeholder="Type a keyword, then hit Enter"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                                        updateRule(i, { values: [...rule.values, e.currentTarget.value.trim()] });
                                                        e.currentTarget.value = "";
                                                    }
                                                }}
                                                className="w-full border-b border-blue-400/20 bg-transparent py-2 pl-9 pr-2 text-sm text-blue-100 placeholder-blue-200/35 focus:border-blue-400/50 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    (() => {
                                        const allOptions = getValueOptions(rule.field);
                                        const showSearch = rule.field === "label" && allOptions.length >= 6;
                                        const searchText = (labelSearches[i] ?? "").toLowerCase();
                                        const selected = allOptions.filter((opt) => rule.values.includes(opt));
                                        const unselected = allOptions.filter((opt) => !rule.values.includes(opt));
                                        const filteredUnselected = showSearch && searchText
                                            ? unselected.filter((opt) => opt.toLowerCase().includes(searchText))
                                            : unselected;

                                        return (
                                            <div className="space-y-2">
                                                {/* Selected pills — always visible */}
                                                {showSearch && selected.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {selected.map((opt) => (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                onClick={() => toggleRuleValue(i, opt)}
                                                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all duration-200 bg-blue-500/20 text-blue-100 border-blue-300/40"
                                                            >
                                                                {opt}
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Search input for labels with 10+ options */}
                                                {showSearch && (
                                                    <div className="relative">
                                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                                        <input
                                                            type="text"
                                                            value={labelSearches[i] ?? ""}
                                                            onChange={(e) => setLabelSearches((prev) => ({ ...prev, [i]: e.target.value }))}
                                                            placeholder="Filter labels…"
                                                            className="w-full rounded-lg border border-blue-400/20 bg-[#0d1a31] py-2 pl-9 pr-2 text-sm text-blue-100 placeholder-blue-200/35 focus:border-blue-400/50 focus:outline-none"
                                                        />
                                                    </div>
                                                )}

                                                {/* Unselected pills (filtered when searching) */}
                                                <div className="flex flex-wrap gap-2">
                                                    {/* When not using search layout, show selected inline */}
                                                    {!showSearch && selected.map((opt) => (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => toggleRuleValue(i, opt)}
                                                            className="rounded-lg px-3 py-1.5 text-xs font-medium border transition-all duration-200 bg-blue-500/20 text-blue-100 border-blue-300/40"
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                    {filteredUnselected.map((opt) => (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => toggleRuleValue(i, opt)}
                                                            className="rounded-lg px-3 py-1.5 text-xs font-medium border transition-all duration-200 bg-[#102140] text-blue-200/70 border-blue-500/20 hover:border-blue-300/35 hover:text-blue-100"
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                    {allOptions.length === 0 && (
                                                        <p className="text-xs text-slate-500 italic">No options available</p>
                                                    )}
                                                    {showSearch && searchText && filteredUnselected.length === 0 && (
                                                        <p className="text-xs text-slate-500 italic">No labels match "{labelSearches[i]}"</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={addRule}
                        className="flex w-full items-center gap-2 rounded-lg border border-blue-400/20 bg-[#0f1d35]/55 px-3 py-2.5 text-sm font-medium text-blue-200/90 transition-colors hover:bg-blue-500/10 hover:text-blue-100"
                    >
                        <CircleDot className="h-4 w-4" />
                        Add Rule
                    </button>
                </section>

                {/* Live Preview */}
                <section className="space-y-4 xl:sticky xl:top-6 xl:pl-6 h-fit">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold text-white">Live Preview</h3>
                            {previewLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                        </div>
                        <p className="text-xs text-slate-400">
                            {previewLoading ? (
                                "Updating…"
                            ) : preview ? (
                                <>
                                    <span className="text-primary font-bold">{preview.count}</span>
                                    {" "}{preview.count === 1 ? "collection matches" : "collections match"} your rules
                                </>
                            ) : (
                                "Configure rules to see matching collections"
                            )}
                        </p>
                    </div>

                    {!preview ? (
                        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                            {Array.from({ length: 15 }).map((_, idx) => (
                                <div key={idx} className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950 aspect-[2/3]">
                                    <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800 via-slate-700/70 to-slate-800" />
                                </div>
                            ))}
                        </div>
                    ) : preview.count === 0 ? (
                        <div className={`rounded-xl border border-dashed border-slate-700/70 bg-slate-950/50 px-4 py-6 text-center transition-opacity duration-300 ${previewLoading ? "opacity-50" : "opacity-100"}`}>
                            <p className="text-sm text-slate-300">
                                {hasRuleValues ? "No collections match these rules." : "Add values to your rules to see matching collections."}
                            </p>
                        </div>
                    ) : (
                        <div className={`grid grid-cols-3 gap-2.5 sm:grid-cols-5 transition-opacity duration-300 ${previewLoading ? "opacity-40" : "opacity-100"}`}>
                            {visiblePreviewCollections.map((col, idx) => {
                                const posterLoaded = !col.poster_url || loadedPreviewPosters[col.name];
                                return (
                                    <div
                                        key={`${previewRevision}-${col.name}`}
                                        className="preview-poster-enter group relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950 aspect-[2/3]"
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        {col.poster_url ? (
                                            <>
                                                {!posterLoaded && (
                                                    <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800 via-slate-700/70 to-slate-800" />
                                                )}
                                                <img
                                                    src={col.poster_url}
                                                    alt={col.name}
                                                    className={`h-full w-full object-cover transition-all duration-300 group-hover:scale-105 ${
                                                        posterLoaded ? "opacity-100" : "opacity-0"
                                                    }`}
                                                    onLoad={() => {
                                                        setLoadedPreviewPosters((prev) => (prev[col.name] ? prev : { ...prev, [col.name]: true }));
                                                    }}
                                                    onError={() => {
                                                        setLoadedPreviewPosters((prev) => (prev[col.name] ? prev : { ...prev, [col.name]: true }));
                                                    }}
                                                />
                                            </>
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-[11px] text-slate-400">
                                                No Poster
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                            <span className="text-[11px] font-medium leading-tight text-white line-clamp-2">{col.name}</span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Overflow tile: blends into the grid as the last poster slot */}
                            {hasOverflow && (
                                <button
                                    type="button"
                                    onClick={() => setPreviewExpanded(!previewExpanded)}
                                    aria-expanded={previewExpanded}
                                    className="preview-poster-enter group relative overflow-hidden rounded-lg border border-slate-700/50 aspect-[2/3] cursor-pointer transition-all duration-300 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    style={{ animationDelay: `${visiblePreviewCollections.length * 40}ms` }}
                                >
                                    {/* Layered background for depth */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.07] via-transparent to-transparent" />
                                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'6\' height=\'6\' viewBox=\'0 0 6 6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'1\' cy=\'1\' r=\'0.6\' fill=\'%23fff\'/%3E%3C/svg%3E")' }} />

                                    {/* Decorative border glow on hover */}
                                    <div className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />

                                    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2">
                                        {previewExpanded ? (
                                            <>
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/50 bg-slate-800/80 transition-all duration-300 group-hover:border-primary/40 group-hover:bg-primary/10">
                                                    <ChevronDown className="h-4 w-4 rotate-180 text-slate-400 transition-colors group-hover:text-primary" />
                                                </div>
                                                <span className="text-xs font-medium text-slate-400 transition-colors group-hover:text-slate-200">
                                                    Show less
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-600/40 bg-slate-800/60 transition-all duration-300 group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:scale-110">
                                                    <span className="text-lg font-bold text-slate-100 transition-colors group-hover:text-primary">
                                                        +{preview.count - visiblePreviewCollections.length}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 transition-colors group-hover:text-slate-300">
                                                    collections
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </button>
                            )}
                        </div>
                    )}
                </section>
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


