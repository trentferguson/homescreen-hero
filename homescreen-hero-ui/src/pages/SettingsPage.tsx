import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "../utils/api";
import { SlidersHorizontal, Check, ChevronDown, FileText, Copy, Pause, Play, RefreshCw, Search, Trash2, Server, CalendarSync, Ban } from "lucide-react";
import { Switch, Listbox } from "@headlessui/react";
import FieldRow from "../components/FieldRow";
import CollapsibleFormSection from "../components/CollapsibleFormSection";
import TestConnectionCta from "../components/TestConnectionCta";

const tabs = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "logs", label: "Logs", icon: FileText },
] as const;

type TabId = (typeof tabs)[number]["id"];

type PlexLibraryConfig = { name: string; enabled: boolean };
type PlexSettings = { base_url: string; token: string; libraries: PlexLibraryConfig[] };
type AvailableLibrary = { title: string; type: string };
type RotationSettings = {
    enabled: boolean;
    interval_hours: number;
    max_collections: number;
    strategy: string;
    allow_repeats: boolean;
    sync_all_on_rotation: boolean;
    blacklisted_collections: string[];
};
type ConfigSaveResponse = { ok: boolean; path: string; message: string; env_override: boolean };
type HealthComponent = { ok: boolean; error?: string | null };
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "ALL";

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

function guessLevel(line: string): Exclude<LogLevel, "ALL"> | null {
    const up = line.toUpperCase();
    if (up.includes(" ERROR ") || up.startsWith("ERROR") || up.includes("] ERROR")) return "ERROR";
    if (up.includes(" WARN ") || up.startsWith("WARN") || up.includes("] WARN")) return "WARN";
    if (up.includes(" INFO ") || up.startsWith("INFO") || up.includes("] INFO")) return "INFO";
    if (up.includes(" DEBUG ") || up.startsWith("DEBUG") || up.includes("] DEBUG")) return "DEBUG";
    return null;
}

function LevelBadge({ level }: { level: Exclude<LogLevel, "ALL"> | null }) {
    const cls =
        level === "ERROR"
            ? "bg-red-500/15 text-red-300 ring-red-500/20"
            : level === "WARN"
                ? "bg-amber-500/15 text-amber-300 ring-amber-500/20"
                : level === "INFO"
                    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20"
                    : level === "DEBUG"
                        ? "bg-sky-500/15 text-sky-300 ring-sky-500/20"
                        : "bg-slate-500/10 text-slate-300 ring-slate-500/20";

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
            {level ?? "LOG"}
        </span>
    );
}

function IconButton({
    label,
    onClick,
    disabled,
    children,
}: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-800 bg-white/5 hover:bg-white/10 text-slate-200 disabled:opacity-60 disabled:hover:bg-white/5 transition-colors"
        >
            {children}
        </button>
    );
}

export default function SettingsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabId>("general");
    const [plexTestStatus, setPlexTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

    // Track which section should be expanded based on URL param
    const sectionParam = searchParams.get("section");
    const [rotationExpanded] = useState(sectionParam === "rotation");

    // Clear the URL param after initial load to avoid re-expanding on tab switches
    useEffect(() => {
        if (sectionParam) {
            setSearchParams({}, { replace: true });
        }
    }, []);
    const [rotationSettings, setRotationSettings] = useState<RotationSettings>({
        enabled: true,
        interval_hours: 12,
        max_collections: 5,
        strategy: "random",
        allow_repeats: false,
        sync_all_on_rotation: true,
        blacklisted_collections: [],
    });
    const [blacklistSearch, setBlacklistSearch] = useState("");
    const [blacklistSourceFilter, setBlacklistSourceFilter] = useState<"all" | "plex" | "trakt" | "letterboxd" | "mdblist">("all");
    const [blacklistPage, setBlacklistPage] = useState(1);
    const [collectionSources, setCollectionSources] = useState<CollectionSource[]>([]);
    const blacklistItemsPerPage = 20;
    const [loadingRotation, setLoadingRotation] = useState(true);
    const [savingRotation, setSavingRotation] = useState(false);
    const [rotationError, setRotationError] = useState<string | null>(null);
    const [rotationMessage, setRotationMessage] = useState<string | null>(null);
    const [plexSettings, setPlexSettings] = useState<PlexSettings>({
        base_url: "",
        token: "",
        libraries: [],
    });
    const [availableLibraries, setAvailableLibraries] = useState<AvailableLibrary[]>([]);
    const [loadingLibraries, setLoadingLibraries] = useState(false);
    const [loadingPlex, setLoadingPlex] = useState(true);
    const [savingPlex, setSavingPlex] = useState(false);
    const [plexError, setPlexError] = useState<string | null>(null);
    const [plexMessage, setPlexMessage] = useState<string | null>(null);

    // Logs state
    const [lines, setLines] = useState<string[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logsError, setLogsError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [level, setLevel] = useState<LogLevel>("ALL");
    const [paused, setPaused] = useState(false);
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const tabDescription = useMemo(() => {
        switch (activeTab) {
            case "general":
                return "Control the basics without directly editing the YAML config.";
            case "logs":
                return "View and search application logs in real-time.";
            default:
                return "";
        }
    }, [activeTab]);

    const handleTestConnection = async () => {
        try {
            setPlexTestStatus("testing");

            const r = await fetchWithAuth("/api/health/plex");
            if (!r.ok) {
                throw new Error(await r.text());
            }

            const data: HealthComponent = await r.json();
            const ok = data?.ok === true;

            if (ok) {
                setPlexError(null);
                setPlexTestStatus("success");
            } else {
                setPlexTestStatus("error");
                setPlexError(data?.error || "Plex health check failed.");
            }
        } catch (e) {
            setPlexTestStatus("error");
            setPlexError(String(e));
        }
    };

    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/rotation")
            .then(async (r) => {
                if (!r.ok) {
                    throw new Error(await r.text());
                }
                return r.json();
            })
            .then((data: RotationSettings) => {
                if (!isMounted) return;
                setRotationSettings(data);
            })
            .catch((e) => {
                if (!isMounted) return;
                setRotationError(String(e));
            })
            .finally(() => {
                if (!isMounted) return;
                setLoadingRotation(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Fetch collection sources for blacklist picker
    useEffect(() => {
        fetchWithAuth("/api/admin/config/group-sources")
            .then((r) => r.json())
            .then((data: CollectionSourcesResponse) => {
                const combined = [
                    ...(data.plex || []),
                    ...(data.trakt || []),
                    ...(data.letterboxd || []),
                    ...(data.mdblist || []),
                ];
                setCollectionSources(combined);
            })
            .catch(() => {
                // Non-fatal, users can still type names manually
            });
    }, []);

    // Filter and paginate available sources for blacklist
    const availableBlacklistSources = useMemo(() => {
        let filtered = collectionSources.filter(
            (s) => !rotationSettings.blacklisted_collections.includes(s.name)
        );

        if (blacklistSourceFilter !== "all") {
            filtered = filtered.filter((s) => s.source === blacklistSourceFilter);
        }

        if (blacklistSearch.trim()) {
            const query = blacklistSearch.toLowerCase();
            filtered = filtered.filter(
                (s) =>
                    s.name.toLowerCase().includes(query) ||
                    s.detail?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [collectionSources, rotationSettings.blacklisted_collections, blacklistSourceFilter, blacklistSearch]);

    const paginatedBlacklistSources = useMemo(() => {
        const startIndex = (blacklistPage - 1) * blacklistItemsPerPage;
        return availableBlacklistSources.slice(startIndex, startIndex + blacklistItemsPerPage);
    }, [availableBlacklistSources, blacklistPage, blacklistItemsPerPage]);

    const blacklistTotalPages = Math.ceil(availableBlacklistSources.length / blacklistItemsPerPage);

    // Reset pagination when filter/search changes
    useEffect(() => {
        setBlacklistPage(1);
    }, [blacklistSourceFilter, blacklistSearch]);

    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/plex")
            .then(async (r) => {
                if (!r.ok) {
                    throw new Error(await r.text());
                }
                return r.json();
            })
            .then((data: PlexSettings) => {
                if (!isMounted) return;
                setPlexSettings(data);
            })
            .catch((e) => {
                if (!isMounted) return;
                setPlexError(String(e));
            })
            .finally(() => {
                if (!isMounted) return;
                setLoadingPlex(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const fetchAvailableLibraries = async () => {
        try {
            setLoadingLibraries(true);
            const r = await fetchWithAuth("/api/collections/libraries");
            if (!r.ok) {
                throw new Error(await r.text());
            }
            const data: { libraries: AvailableLibrary[] } = await r.json();
            setAvailableLibraries(data.libraries || []);
        } catch (e) {
            setPlexError(`Failed to fetch libraries: ${String(e)}`);
        } finally {
            setLoadingLibraries(false);
        }
    };

    const toggleLibrary = (libraryName: string) => {
        setPlexSettings((prev) => {
            const existingIndex = prev.libraries.findIndex((lib) => lib.name === libraryName);
            if (existingIndex >= 0) {
                // Toggle enabled status
                const updated = [...prev.libraries];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    enabled: !updated[existingIndex].enabled,
                };
                return { ...prev, libraries: updated };
            } else {
                // Add new library
                return {
                    ...prev,
                    libraries: [...prev.libraries, { name: libraryName, enabled: true }],
                };
            }
        });
    };

    const removeLibrary = (libraryName: string) => {
        setPlexSettings((prev) => ({
            ...prev,
            libraries: prev.libraries.filter((lib) => lib.name !== libraryName),
        }));
    };

    async function saveRotationSettings() {
        try {
            setSavingRotation(true);
            setRotationError(null);
            setRotationMessage(null);

            const r = await fetchWithAuth("/api/admin/config/rotation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rotationSettings),
            });

            if (!r.ok) {
                throw new Error(await r.text());
            }

            const data: ConfigSaveResponse = await r.json();
            setRotationMessage(data.message);
        } catch (e) {
            setRotationError(String(e));
        } finally {
            setSavingRotation(false);
        }
    }

    const handleRotationNumberChange = (
        key: "interval_hours" | "max_collections",
        value: string,
    ) => {
        const parsed = Number(value);
        setRotationSettings((prev) => ({
            ...prev,
            [key]: Number.isNaN(parsed) ? 0 : parsed,
        }));
    };

    const addToBlacklist = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setRotationSettings((prev) => {
            if (prev.blacklisted_collections.includes(trimmed)) return prev;
            return {
                ...prev,
                blacklisted_collections: [...prev.blacklisted_collections, trimmed],
            };
        });
    };

    const removeFromBlacklist = (name: string) => {
        setRotationSettings((prev) => ({
            ...prev,
            blacklisted_collections: prev.blacklisted_collections.filter((c) => c !== name),
        }));
    };

    async function savePlexSettings() {
        try {
            setSavingPlex(true);
            setPlexError(null);
            setPlexMessage(null);

            const r = await fetchWithAuth("/api/admin/config/plex", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(plexSettings),
            });

            const text = await r.text();
            if (!r.ok) throw new Error(text);

            const data = JSON.parse(text) as ConfigSaveResponse;
            setPlexMessage(data.message);
        } catch (e) {
            setPlexError(String(e));
        } finally {
            setSavingPlex(false);
        }
    }

    // Logs functions
    async function fetchLogs() {
        setLoadingLogs(true);
        setLogsError(null);

        try {
            const res = await fetchWithAuth("/api/logs/tail");
            const text = await res.text();

            if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

            const trimmed = text.trim();
            let nextLines: string[] = [];

            if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                try {
                    const json = JSON.parse(trimmed);
                    if (Array.isArray(json)) {
                        nextLines = json.map(String);
                    } else if (Array.isArray(json.lines)) {
                        nextLines = json.lines.map(String);
                    } else if (typeof json.text === "string") {
                        nextLines = json.text.split(/\r?\n/);
                    } else {
                        nextLines = [JSON.stringify(json, null, 2)];
                    }
                } catch {
                    nextLines = trimmed.split(/\r?\n/);
                }
            } else {
                nextLines = trimmed.length ? trimmed.split(/\r?\n/).filter(Boolean) : [];
            }

            setLines(nextLines);
        } catch (e: any) {
            setLogsError(e?.message ?? "Failed to load logs");
        } finally {
            setLoadingLogs(false);
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return lines.filter((line) => {
            const lvl = guessLevel(line);
            if (level !== "ALL" && lvl !== level) return false;
            if (q && !line.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [lines, query, level]);

    const counts = useMemo(() => {
        let errorN = 0, warnN = 0, infoN = 0, debugN = 0;
        for (const l of lines) {
            const lvl = guessLevel(l);
            if (lvl === "ERROR") errorN++;
            else if (lvl === "WARN") warnN++;
            else if (lvl === "INFO") infoN++;
            else if (lvl === "DEBUG") debugN++;
        }
        return { errorN, warnN, infoN, debugN };
    }, [lines]);

    function copyVisible() {
        const text = filtered.join("\n");
        navigator.clipboard.writeText(text);
    }

    function clearLocal() {
        setLines([]);
    }

    // Logs effects
    useEffect(() => {
        if (activeTab === "logs") {
            fetchLogs();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== "logs" || paused) return;
        const id = window.setInterval(fetchLogs, 2000);
        return () => window.clearInterval(id);
    }, [activeTab, paused]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{tabDescription}</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
                {tabs.map(({ id, label, icon: Icon }) => {
                    const isActive = id === activeTab;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${isActive
                                ? "bg-primary text-white border-primary"
                                : "border-slate-800/60 bg-slate-900/60 text-slate-200 hover:border-slate-700"
                                }`}
                        >
                            <Icon size={16} />
                            {label}
                        </button>
                    );
                })}
            </div>

            {activeTab === "general" ? (
                <>
                    <CollapsibleFormSection
                        title="Plex"
                        description="Provide credentials for the media server this dashboard references."
                        icon={Server}
                        actions={
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="hidden sm:inline">Your secrets stay in the browser until saved.</span>
                                <button
                                    type="button"
                                    onClick={savePlexSettings}
                                    disabled={savingPlex || loadingPlex}
                                    className="rounded-lg border border-slate-700 px-3 py-1 font-semibold text-slate-100 transition disabled:opacity-60"
                                >
                                    {savingPlex ? "Saving…" : "Save Plex Settings"}
                                </button>
                            </div>
                        }
                    >
                        <FieldRow
                            label="Server URL"
                            description="Internal address the backend should use to reach Plex."
                            hint="Example: http://localhost:32400"
                        >
                            <input
                                type="text"
                                placeholder="http://localhost:32400"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                value={plexSettings.base_url}
                                onChange={(e) =>
                                    setPlexSettings((prev) => ({
                                        ...prev,
                                        base_url: e.target.value,
                                    }))
                                }
                                disabled={loadingPlex}
                            />
                        </FieldRow>

                        <FieldRow
                            label="X-Plex-Token"
                            description="Stored securely and not written to the config until you save."
                        >
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                value={plexSettings.token}
                                onChange={(e) =>
                                    setPlexSettings((prev) => ({
                                        ...prev,
                                        token: e.target.value,
                                    }))
                                }
                                disabled={loadingPlex}
                            />
                        </FieldRow>

                        <FieldRow label="Libraries" hint="Select which Plex libraries to use for rotation.">
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={fetchAvailableLibraries}
                                    disabled={loadingPlex || loadingLibraries}
                                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {loadingLibraries ? "Loading..." : "Fetch Available Libraries"}
                                </button>

                                {availableLibraries.length > 0 && (
                                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-2">
                                        <div className="text-xs text-slate-400 mb-2">Available Libraries:</div>
                                        {availableLibraries.map((lib) => {
                                            const isSelected = plexSettings.libraries.some((l) => l.name === lib.title);
                                            const isEnabled = plexSettings.libraries.find((l) => l.name === lib.title)?.enabled ?? true;
                                            return (
                                                <div key={lib.title} className="flex items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected && isEnabled}
                                                            onChange={() => toggleLibrary(lib.title)}
                                                            className="h-4 w-4 rounded border-slate-600 text-primary focus:ring-2 focus:ring-primary/70"
                                                            disabled={loadingPlex}
                                                        />
                                                        <div>
                                                            <div className="text-sm text-slate-100">{lib.title}</div>
                                                            <div className="text-xs text-slate-500">{lib.type}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {plexSettings.libraries.length > 0 && (
                                    <div className="rounded-lg border border-emerald-700 bg-emerald-900/30 p-3">
                                        <div className="text-xs text-emerald-300 mb-2">Selected Libraries:</div>
                                        <div className="flex flex-wrap gap-2">
                                            {plexSettings.libraries.map((lib) => (
                                                <div
                                                    key={lib.name}
                                                    className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${lib.enabled
                                                            ? "bg-emerald-800/50 text-emerald-100"
                                                            : "bg-slate-700/50 text-slate-400"
                                                        }`}
                                                >
                                                    <span>{lib.name}</span>
                                                    {!lib.enabled && <span className="text-xs">(disabled)</span>}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLibrary(lib.name)}
                                                        className="text-emerald-200 hover:text-emerald-50"
                                                        disabled={loadingPlex}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </FieldRow>

                        {plexMessage ? (
                            <div className="rounded-lg border border-emerald-700 bg-emerald-900/50 px-3 py-2 text-xs text-emerald-100">
                                {plexMessage}
                            </div>
                        ) : null}

                        {plexError ? (
                            <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                                {plexError}
                            </div>
                        ) : null}

                        <TestConnectionCta
                            service="Plex"
                            status={plexTestStatus}
                            onTest={handleTestConnection}
                            message="Run a dry connection test without restarting the service."
                        />
                    </CollapsibleFormSection>

                    <CollapsibleFormSection
                        title="Rotation schedule"
                        description="Configure how often the scheduler rotates featured collections."
                        icon={CalendarSync}
                        expanded={rotationExpanded}
                        actions={
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="hidden sm:inline">Writes directly to config.yaml.</span>
                                <button
                                    type="button"
                                    onClick={saveRotationSettings}
                                    disabled={savingRotation || loadingRotation}
                                    className="rounded-lg border border-slate-700 px-3 py-1 font-semibold text-slate-100 transition disabled:opacity-60"
                                >
                                    {savingRotation ? "Saving…" : "Save rotation settings"}
                                </button>
                            </div>
                        }
                    >
                        <FieldRow label="Automatic rotations">
                            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-3 py-2">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Enable scheduler</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">When enabled, rotations run on the configured interval.</p>
                                </div>
                                <Switch
                                    checked={rotationSettings.enabled}
                                    onChange={() => {
                                        if (loadingRotation) return;
                                        setRotationSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
                                    }}
                                    className="relative inline-flex h-6 w-11 items-center rounded-full transition data-[checked]:bg-primary bg-slate-600"
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${rotationSettings.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                                </Switch>
                            </div>
                        </FieldRow>

                        <FieldRow label="Interval (hours)" hint="How often to rotate featured collections.">
                            <input
                                type="number"
                                min={1}
                                value={rotationSettings.interval_hours}
                                onChange={(e) => handleRotationNumberChange("interval_hours", e.target.value)}
                                disabled={loadingRotation}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </FieldRow>

                        <FieldRow label="Max collections" hint="Global cap on how many collections appear at once.">
                            <input
                                type="number"
                                min={1}
                                value={rotationSettings.max_collections}
                                onChange={(e) => handleRotationNumberChange("max_collections", e.target.value)}
                                disabled={loadingRotation}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </FieldRow>

                        <FieldRow label="Strategy" hint="Choose how groups are prioritized during rotation.">
                            <Listbox
                                value={rotationSettings.strategy}
                                onChange={(val) =>
                                    setRotationSettings((prev) => ({
                                        ...prev,
                                        strategy: val,
                                    }))
                                }
                                disabled={loadingRotation}
                            >
                                <div className="relative">
                                    <Listbox.Button className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70 text-left flex items-center justify-between data-[disabled]:opacity-50">
                                        <span>
                                            {rotationSettings.strategy === "weighted" ? "Weighted" :
                                             rotationSettings.strategy === "lru" ? "Least Recently Used" :
                                             "Random"}
                                        </span>
                                        <ChevronDown size={16} className="text-slate-400" />
                                    </Listbox.Button>

                                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden focus:outline-none">
                                        <Listbox.Option
                                            value="random"
                                            className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 text-sm">
                                                <span className="data-[selected]:font-medium">Random</span>
                                                <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                            </div>
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="weighted"
                                            className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 text-sm">
                                                <span className="data-[selected]:font-medium">Weighted</span>
                                                <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                            </div>
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="lru"
                                            className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 text-sm">
                                                <span className="data-[selected]:font-medium">Least Recently Used</span>
                                                <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                            </div>
                                        </Listbox.Option>
                                    </Listbox.Options>
                                </div>
                            </Listbox>
                        </FieldRow>

                        <FieldRow label="Allow repeats" hint="Permit the same collection to appear in consecutive rotations.">
                            <Switch
                                checked={rotationSettings.allow_repeats}
                                onChange={() => {
                                    if (loadingRotation) return;
                                    setRotationSettings((prev) => ({
                                        ...prev,
                                        allow_repeats: !prev.allow_repeats,
                                    }));
                                }}
                                className="relative inline-flex h-6 w-11 items-center rounded-full transition data-[checked]:bg-primary bg-slate-600"
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${rotationSettings.allow_repeats ? 'translate-x-5' : 'translate-x-1'}`} />
                            </Switch>
                        </FieldRow>

                        <FieldRow label="Sync all lists on rotation" hint="When enabled, all third-party lists sync on every rotation. When disabled, only selected collections sync.">
                            <Switch
                                checked={rotationSettings.sync_all_on_rotation}
                                onChange={() => {
                                    if (loadingRotation) return;
                                    setRotationSettings((prev) => ({
                                        ...prev,
                                        sync_all_on_rotation: !prev.sync_all_on_rotation,
                                    }));
                                }}
                                className="relative inline-flex h-6 w-11 items-center rounded-full transition data-[checked]:bg-primary bg-slate-600"
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${rotationSettings.sync_all_on_rotation ? 'translate-x-5' : 'translate-x-1'}`} />
                            </Switch>
                        </FieldRow>

                        {rotationMessage ? (
                            <div className="rounded-lg border border-emerald-700 bg-emerald-900/50 px-3 py-2 text-xs text-emerald-100">
                                {rotationMessage}
                            </div>
                        ) : null}

                        {rotationError ? (
                            <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                                {rotationError}
                            </div>
                        ) : null}
                    </CollapsibleFormSection>

                    {/* Collection Blacklist */}
                    <CollapsibleFormSection
                        title="Collection Blacklist"
                        description="Collections that will never be selected during rotation, regardless of which groups they belong to."
                        icon={Ban}
                    >
                        {/* Currently Blacklisted */}
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-red-400 uppercase tracking-wider">
                                Currently Blacklisted
                            </label>
                            {rotationSettings.blacklisted_collections.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {rotationSettings.blacklisted_collections.map((collection) => (
                                        <button
                                            key={collection}
                                            type="button"
                                            onClick={() => removeFromBlacklist(collection)}
                                            disabled={loadingRotation}
                                            className="group inline-flex items-center gap-2 rounded-full border border-red-800/60 bg-red-900/30 px-3 py-1.5 text-xs font-semibold text-red-100 hover:border-red-600 hover:bg-red-900/50 transition-all disabled:opacity-50"
                                        >
                                            {collection}
                                            <span className="text-red-400 group-hover:text-red-200">×</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 p-3 text-center">
                                    <p className="text-xs text-slate-500">No collections blacklisted yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Search and Filter */}
                        <div className="space-y-3 pt-4 border-t border-slate-700/50">
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Add to Blacklist
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input
                                    type="text"
                                    value={blacklistSearch}
                                    onChange={(e) => setBlacklistSearch(e.target.value)}
                                    placeholder="Search collections..."
                                    className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                                />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {(["all", "plex", "trakt", "letterboxd", "mdblist"] as const).map((filter) => (
                                    <button
                                        key={filter}
                                        type="button"
                                        onClick={() => setBlacklistSourceFilter(filter)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                            blacklistSourceFilter === filter
                                                ? filter === "all"
                                                    ? "bg-red-600 text-white"
                                                    : "text-white"
                                                : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                        }`}
                                        style={
                                            blacklistSourceFilter === filter && filter !== "all"
                                                ? {
                                                      backgroundColor:
                                                          filter === "plex"
                                                              ? "#b8860b"
                                                              : filter === "trakt"
                                                              ? "#8b2e82"
                                                              : filter === "letterboxd"
                                                              ? "#00a63d"
                                                              : "#4284c9",
                                                  }
                                                : undefined
                                        }
                                    >
                                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Collection Grid */}
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mt-4">
                            {paginatedBlacklistSources.map((source) => (
                                <button
                                    key={`${source.source}-${source.name}`}
                                    type="button"
                                    onClick={() => addToBlacklist(source.name)}
                                    className="flex flex-col gap-1 rounded-lg border border-slate-800/60 bg-slate-900/50 p-2.5 text-left text-sm text-slate-100 transition-all duration-200 hover:border-red-500/40 hover:bg-red-900/20"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-semibold text-xs leading-tight flex-1 line-clamp-1">{source.name}</p>
                                        <span
                                            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold flex-shrink-0 text-white"
                                            style={{
                                                backgroundColor:
                                                    source.source === "plex"
                                                        ? "#e5a00d"
                                                        : source.source === "trakt"
                                                        ? "#af35a3"
                                                        : source.source === "letterboxd"
                                                        ? "#00a63d"
                                                        : "#4284c9",
                                            }}
                                        >
                                            {source.source.charAt(0).toUpperCase() + source.source.slice(1)}
                                        </span>
                                    </div>
                                    {source.detail && (
                                        <p className="text-[10px] text-slate-500 line-clamp-1">{source.detail}</p>
                                    )}
                                </button>
                            ))}
                        </div>

                        {availableBlacklistSources.length === 0 && (
                            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 p-3 text-center mt-4">
                                <p className="text-xs text-slate-500">
                                    {collectionSources.length === 0
                                        ? "No collections found. Configure Plex or integrations first."
                                        : "No matching collections found."}
                                </p>
                            </div>
                        )}

                        {/* Pagination */}
                        {blacklistTotalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/60">
                                <p className="text-xs text-slate-400">
                                    Showing {((blacklistPage - 1) * blacklistItemsPerPage) + 1}-{Math.min(blacklistPage * blacklistItemsPerPage, availableBlacklistSources.length)} of {availableBlacklistSources.length}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setBlacklistPage((p) => Math.max(1, p - 1))}
                                        disabled={blacklistPage === 1}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        Previous
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: blacklistTotalPages }, (_, i) => i + 1).map((page) => (
                                            <button
                                                key={page}
                                                type="button"
                                                onClick={() => setBlacklistPage(page)}
                                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                                    blacklistPage === page
                                                        ? "bg-red-600 text-white"
                                                        : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setBlacklistPage((p) => Math.min(blacklistTotalPages, p + 1))}
                                        disabled={blacklistPage === blacklistTotalPages}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Save Button */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex-1">
                                {rotationMessage && (
                                    <p className="text-xs text-emerald-400">{rotationMessage}</p>
                                )}
                                {rotationError && (
                                    <p className="text-xs text-rose-400">{rotationError}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={saveRotationSettings}
                                disabled={savingRotation || loadingRotation}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingRotation ? (
                                    <>
                                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Save Blacklist
                                    </>
                                )}
                            </button>
                        </div>
                    </CollapsibleFormSection>
                </>
            ) : null}

            {activeTab === "logs" ? (
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                        <div>
                            <h2 className="text-white text-2xl font-bold">Application Logs</h2>
                            <p className="text-slate-400 text-sm">
                                {lines.length} lines • {counts.errorN} errors • {counts.warnN} warnings
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <IconButton label="Refresh" onClick={fetchLogs} disabled={loadingLogs}>
                                <RefreshCw size={18} />
                                Refresh
                            </IconButton>

                            <IconButton
                                label={paused ? "Resume polling" : "Pause polling"}
                                onClick={() => setPaused((p) => !p)}
                            >
                                {paused ? <Play size={18} /> : <Pause size={18} />}
                                {paused ? "Resume" : "Pause"}
                            </IconButton>

                            <IconButton label="Copy visible" onClick={copyVisible} disabled={filtered.length === 0}>
                                <Copy size={18} />
                                Copy
                            </IconButton>

                            <IconButton label="Clear (local)" onClick={clearLocal} disabled={lines.length === 0}>
                                <Trash2 size={18} />
                                Clear
                            </IconButton>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search logs…"
                                className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="flex gap-3 items-center">
                            <Listbox value={level} onChange={(val) => setLevel(val)}>
                                <div className="relative">
                                    <Listbox.Button className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex items-center gap-2 min-w-[140px] justify-between">
                                        <span>
                                            {level === "ALL" ? "All levels" :
                                             level === "ERROR" ? "Error" :
                                             level === "WARN" ? "Warn" :
                                             level === "INFO" ? "Info" : "Debug"}
                                        </span>
                                        <ChevronDown size={16} className="text-slate-400" />
                                    </Listbox.Button>

                                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden focus:outline-none">
                                        {[
                                            { value: "ALL", label: "All levels" },
                                            { value: "ERROR", label: "Error" },
                                            { value: "WARN", label: "Warn" },
                                            { value: "INFO", label: "Info" },
                                            { value: "DEBUG", label: "Debug" },
                                        ].map((option) => (
                                            <Listbox.Option
                                                key={option.value}
                                                value={option.value}
                                                className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-800"
                                            >
                                                <div className="flex items-center justify-between text-slate-100">
                                                    <span className="data-[selected]:font-medium">{option.label}</span>
                                                    <Check size={16} className="text-emerald-500 invisible data-[selected]:visible" />
                                                </div>
                                            </Listbox.Option>
                                        ))}
                                    </Listbox.Options>
                                </div>
                            </Listbox>
                        </div>
                    </div>

                    {/* Viewer */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                            <div className="text-slate-200 font-semibold text-sm">Log stream</div>
                            <div className="text-slate-400 text-xs">
                                Showing {filtered.length} / {lines.length}
                            </div>
                        </div>

                        {logsError ? (
                            <div className="p-4 text-amber-300 text-sm whitespace-pre-wrap">{logsError}</div>
                        ) : (
                            <div
                                ref={scrollerRef}
                                className="max-h-[70vh] overflow-auto font-mono text-[12px] leading-relaxed"
                            >
                                {loadingLogs && lines.length === 0 ? (
                                    <div className="p-4 text-slate-400">Loading logs…</div>
                                ) : filtered.length === 0 ? (
                                    <div className="p-4 text-slate-400">No matching log lines.</div>
                                ) : (
                                    filtered.map((line, idx) => {
                                        const lvl = guessLevel(line);
                                        return (
                                            <div
                                                key={`${idx}-${line.slice(0, 16)}`}
                                                className="grid grid-cols-[52px_90px_1fr] gap-3 px-4 py-2 border-b border-slate-900/60 hover:bg-white/[0.03]"
                                            >
                                                <div className="text-slate-600 text-right tabular-nums">{idx + 1}</div>
                                                <div>
                                                    <LevelBadge level={lvl} />
                                                </div>
                                                <div className="text-slate-200 whitespace-pre-wrap break-words">{line}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}