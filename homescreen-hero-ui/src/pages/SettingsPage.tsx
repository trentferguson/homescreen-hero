import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { Bell, Shield, SlidersHorizontal, Check, ChevronDown, FileText, Copy, Pause, Play, RefreshCw, Search, Trash2 } from "lucide-react";
import { Switch, Listbox } from "@headlessui/react";
import FieldRow from "../components/FieldRow";
import FormSection from "../components/FormSection";
import TestConnectionCta from "../components/TestConnectionCta";

const tabs = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "integrations", label: "Integrations", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
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
};
type ConfigSaveResponse = { ok: boolean; path: string; message: string; env_override: boolean };
type HealthComponent = { ok: boolean; error?: string | null };
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "ALL";

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
    const [activeTab, setActiveTab] = useState<TabId>("general");
    const [plexTestStatus, setPlexTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [weeklySummary, setWeeklySummary] = useState(false);
    const [defaultTheme, setDefaultTheme] = useState<"Dark" | "Light" | "Auto">("Dark");
    const [rotationSettings, setRotationSettings] = useState<RotationSettings>({
        enabled: true,
        interval_hours: 12,
        max_collections: 5,
        strategy: "random",
        allow_repeats: false,
    });
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
            case "integrations":
                return "Manage connected services like Plex with credential-safe forms.";
            case "notifications":
                return "Fine-tune how the app keeps you informed.";
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
                    <FormSection
                        title="General settings (Work in Progress)"
                        description="Placeholder for future general configuration options. These settings do not yet persist."
                    >
                        <FieldRow
                            label="Application name"
                            hint="Shown in the dashboard header and outgoing notifications."
                        >
                            <input
                                type="text"
                                defaultValue="HomeScreen Hero"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </FieldRow>

                        <FieldRow
                            label="Base URL"
                            description="Used to build links in notifications and integrations."
                            hint="Example: https://hero.example.com"
                        >
                            <input
                                type="url"
                                placeholder="https://hero.example.com"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </FieldRow>

                        <FieldRow label="Default theme" hint="Applied across dashboards and the homepage.">
                            <Listbox value={defaultTheme} onChange={setDefaultTheme}>
                                <div className="relative">
                                    <Listbox.Button className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70 text-left flex items-center justify-between">
                                        <span>{defaultTheme}</span>
                                        <ChevronDown size={16} className="text-slate-400" />
                                    </Listbox.Button>

                                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden focus:outline-none">
                                        {["Dark", "Light", "Auto"].map((theme) => (
                                            <Listbox.Option
                                                key={theme}
                                                value={theme}
                                                className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                            >
                                                <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 text-sm">
                                                    <span className="data-[selected]:font-medium">{theme}</span>
                                                    <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                                </div>
                                            </Listbox.Option>
                                        ))}
                                    </Listbox.Options>
                                </div>
                            </Listbox>
                        </FieldRow>
                    </FormSection>

                    <FormSection
                        title="Rotation schedule"
                        description="Configure how often the scheduler rotates featured collections."
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
                                    <span className="inline-block h-5 w-5 transform rounded-full bg-white transition data-[checked]:translate-x-5 translate-x-1" />
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

                        <FieldRow label="Strategy" hint="Random is currently the only supported strategy.">
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
                                        <span>Random</span>
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
                                <span className="inline-block h-5 w-5 transform rounded-full bg-white transition data-[checked]:translate-x-5 translate-x-1" />
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
                    </FormSection>
                </>
            ) : null}

            {activeTab === "integrations" ? (
                <div className="space-y-4">
                    <FormSection
                        title="Plex"
                        description="Provide credentials for the media server this dashboard references."
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
                                                    className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${
                                                        lib.enabled
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
                    </FormSection>

                    <FormSection
                        title="Other integrations"
                        description="Wire up optional services while keeping the configuration safe."
                    >
                        <FieldRow
                            label="Webhook URL"
                            hint="Triggered on successful rotations when enabled."
                        >
                            <input
                                type="url"
                                placeholder="https://hooks.example.com/rotate"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </FieldRow>
                    </FormSection>
                </div>
            ) : null}

            {activeTab === "notifications" ? (
                <div className="space-y-4">
                    <FormSection
                        title="Manage Notifications (Work in Progress)"
                        description="Alerts are not yet implemented, but future settings can be configured here."
                    >
                        <FieldRow label="Send notifications">
                            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-3 py-2">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Enable alerts</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Covers successes, failures, and dry runs.</p>
                                </div>
                                <Switch
                                    checked={notificationsEnabled}
                                    onChange={() => setNotificationsEnabled((v) => !v)}
                                    className="relative inline-flex h-6 w-11 items-center rounded-full transition data-[checked]:bg-primary bg-slate-600"
                                >
                                    <span className="inline-block h-5 w-5 transform rounded-full bg-white transition data-[checked]:translate-x-5 translate-x-1" />
                                </Switch>
                            </div>
                        </FieldRow>

                        <FieldRow label="Weekly digest" hint="Summary of successes and failures delivered every Monday.">
                            <Switch
                                checked={weeklySummary}
                                onChange={() => setWeeklySummary((v) => !v)}
                                className="relative inline-flex h-6 w-11 items-center rounded-full transition data-[checked]:bg-primary bg-slate-600"
                            >
                                <span className="inline-block h-5 w-5 transform rounded-full bg-white transition data-[checked]:translate-x-5 translate-x-1" />
                            </Switch>
                        </FieldRow>

                        <FieldRow label="Email recipients" description="Comma-separated list of addresses to notify.">
                            <input
                                type="email"
                                multiple
                                placeholder="ops@example.com, admin@example.com"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </FieldRow>
                    </FormSection>
                </div>
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