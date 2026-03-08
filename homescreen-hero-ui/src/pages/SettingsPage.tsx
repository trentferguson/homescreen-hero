import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "../utils/api";
import { SlidersHorizontal, Check, ChevronDown, FileText, Copy, Download, Pause, Play, RefreshCw, Search, Server, CalendarSync, Ban, Archive, Upload, HardDriveDownload, HardDriveUpload, Undo2, Shield, Users, Palette, Sun, Moon } from "lucide-react";
import { Switch, Listbox } from "@headlessui/react";
import FieldRow from "../components/FieldRow";
import CollapsibleFormSection from "../components/CollapsibleFormSection";
import TestConnectionCta from "../components/TestConnectionCta";
import Toast from "../components/Toast";
import UserRow from "../components/UserRow";
import { useAuth } from "../utils/auth";
import { useTheme, type ThemeAccent } from "../utils/theme";

const tabs = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "backup", label: "Backup", icon: Archive },
] as const;

type TabId = (typeof tabs)[number]["id"];

type PlexLibraryConfig = { name: string; enabled: boolean };
type PlexSettings = { base_url: string; token: string; libraries: PlexLibraryConfig[] };
type AvailableLibrary = { title: string; type: string };
type RotationSettings = {
    enabled: boolean;
    interval_hours: number;
    max_collections: number;
    group_order: string;
    allow_repeats: boolean;
    sync_all_on_rotation: boolean;
    blacklisted_collections: string[];
    per_library_limits: Record<string, number>;
};
type ConfigSaveResponse = { ok: boolean; path: string; message: string; env_override: boolean };
type HealthComponent = { ok: boolean; error?: string | null };
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "ALL";

type CollectionSource = {
    name: string;
    source: "plex" | "trakt" | "letterboxd" | "mdblist" | "anilist";
    detail?: string | null;
};

type CollectionSourcesResponse = {
    plex: CollectionSource[];
    trakt: CollectionSource[];
    letterboxd: CollectionSource[];
    mdblist: CollectionSource[];
    anilist: CollectionSource[];
};

function guessLevel(line: string): Exclude<LogLevel, "ALL"> | null {
    const up = line.toUpperCase();
    if (up.includes("[ERROR]") || up.includes(" ERROR ") || up.includes("] ERROR")) return "ERROR";
    if (up.includes("[WARNING]") || up.includes("[WARN]") || up.includes(" WARN ") || up.includes("] WARN")) return "WARN";
    if (up.includes("[INFO]") || up.includes(" INFO ") || up.includes("] INFO")) return "INFO";
    if (up.includes("[DEBUG]") || up.includes(" DEBUG ") || up.includes("] DEBUG")) return "DEBUG";
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

const ACCENT_OPTIONS: { value: ThemeAccent; label: string; swatch: string }[] = [
    { value: "default", label: "Default", swatch: "bg-[rgb(25,93,230)]" },
    { value: "plex-orange", label: "Plex Orange", swatch: "bg-[rgb(229,160,13)]" },
];

function AppearanceSection() {
    const { theme, setTheme, accent, setAccent } = useTheme();

    return (
        <CollapsibleFormSection
            title="Appearance"
            description="Customize how the dashboard looks."
            icon={Palette}
        >
            <FieldRow label="Mode" description="Switch between light and dark interface.">
                <div className="flex gap-2">
                    {(["light", "dark"] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setTheme(mode)}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                                theme === mode
                                    ? "bg-primary text-white"
                                    : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                            }`}
                        >
                            {mode === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            {mode === "light" ? "Light" : "Dark"}
                        </button>
                    ))}
                </div>
            </FieldRow>

            <FieldRow label="Accent" description="Choose the primary accent color used throughout the app.">
                <div className="flex gap-3">
                    {ACCENT_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setAccent(opt.value)}
                            className={`flex items-center gap-2.5 rounded-lg px-4 py-2 text-sm font-medium transition border ${
                                accent === opt.value
                                    ? "border-primary bg-primary/10 text-slate-900 dark:text-white"
                                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600"
                            }`}
                        >
                            <span className={`h-4 w-4 rounded-full ${opt.swatch} ring-1 ring-black/10`} />
                            {opt.label}
                        </button>
                    ))}
                </div>
            </FieldRow>
        </CollapsibleFormSection>
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
    const location = useLocation();
    const navigate = useNavigate();

    const activeTab = useMemo<TabId>(() => {
        const hash = location.hash.replace("#", "").toLowerCase();
        const match = tabs.find((t) => t.id === hash);
        return match ? match.id : "general";
    }, [location.hash]);

    const setActiveTab = useCallback(
        (id: TabId) => {
            navigate(`#${id}`, { replace: true });
        },
        [navigate]
    );
    const [plexTestStatus, setPlexTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

    // Track which section should be expanded based on URL param
    const sectionParam = searchParams.get("section");
    const [rotationExpanded] = useState(sectionParam === "rotation");
    const [authExpanded] = useState(sectionParam === "auth");
    const authSectionRef = useRef<HTMLDivElement | null>(null);

    // Clear the URL param after initial load and scroll to the target section
    useEffect(() => {
        if (sectionParam) {
            setSearchParams({}, { replace: true });
            if (sectionParam === "auth") {
                // Small delay to let the section render before scrolling
                setTimeout(() => {
                    authSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 200);
            }
        }
    }, []);
    const [rotationSettings, setRotationSettings] = useState<RotationSettings>({
        enabled: true,
        interval_hours: 12,
        max_collections: 5,
        group_order: "display_order",
        allow_repeats: false,
        sync_all_on_rotation: true,
        blacklisted_collections: [],
        per_library_limits: {},
    });
    // Track input values as strings to allow empty fields while editing
    const [intervalInput, setIntervalInput] = useState("12");
    const [maxCollectionsInput, setMaxCollectionsInput] = useState("5");
    const [blacklistSearch, setBlacklistSearch] = useState("");
    const [blacklistSourceFilter, setBlacklistSourceFilter] = useState<"all" | "plex" | "trakt" | "letterboxd" | "mdblist" | "anilist">("all");
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

    // Auth settings state
    const [authMethod, setAuthMethod] = useState<"password" | "plex" | "both">("password");
    const [autoApproveUsers, setAutoApproveUsers] = useState(true);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [savingAuth, setSavingAuth] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authMessage, setAuthMessage] = useState<string | null>(null);

    // User management state
    type UserListItem = {
        id: number;
        plex_username: string | null;
        plex_email: string | null;
        plex_thumb: string | null;
        role: string;
        status: string;
        created_at: string;
        last_login_at: string | null;
    };
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const { username: currentUsername } = useAuth();

    // Logs state
    const [lines, setLines] = useState<string[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logsError, setLogsError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [level, setLevel] = useState<LogLevel>("ALL");
    const [paused, setPaused] = useState(false);
    const [follow, setFollow] = useState(true);
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    // Backup/Restore state
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [validating, setValidating] = useState(false);
    const [reverting, setReverting] = useState(false);
    const [backupStatus, setBackupStatus] = useState<{ exists: boolean; modified_at: string | null } | null>(null);
    const [backupToast, setBackupToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [validationResult, setValidationResult] = useState<{ ok: boolean; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const tabDescription = useMemo(() => {
        switch (activeTab) {
            case "general":
                return "Control the basics without directly editing the YAML config.";
            case "logs":
                return "View and search application logs in real-time.";
            case "backup":
                return "Export or import your configuration file.";
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
                setIntervalInput(String(data.interval_hours));
                setMaxCollectionsInput(String(data.max_collections));
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
                    ...(data.anilist || []),
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

    // Fetch auth settings
    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/auth-method")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: { method: "password" | "plex" | "both"; auto_approve_users: boolean }) => {
                if (!isMounted) return;
                setAuthMethod(data.method);
                setAutoApproveUsers(data.auto_approve_users);
            })
            .catch((e) => {
                if (!isMounted) return;
                setAuthError(String(e));
            })
            .finally(() => {
                if (!isMounted) return;
                setLoadingAuth(false);
            });
        return () => { isMounted = false; };
    }, []);

    // Fetch users list
    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const r = await fetchWithAuth("/api/auth/users");
            if (!r.ok) throw new Error(await r.text());
            const data = await r.json();
            setUsers(data.users);
        } catch {
            // Silently fail — user list is non-critical
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    // Load users when auth method includes plex
    useEffect(() => {
        if (authMethod === "plex" || authMethod === "both") {
            fetchUsers();
        }
    }, [authMethod, fetchUsers]);

    async function saveAuthSettings() {
        try {
            setSavingAuth(true);
            setAuthError(null);
            setAuthMessage(null);

            const r = await fetchWithAuth("/api/admin/config/auth-method", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method: authMethod, auto_approve_users: autoApproveUsers }),
            });

            if (!r.ok) throw new Error(await r.text());
            const data: ConfigSaveResponse = await r.json();
            setAuthMessage(data.message);
        } catch (e) {
            setAuthError(String(e));
        } finally {
            setSavingAuth(false);
        }
    }

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

    const handleIntervalChange = (value: string) => {
        setIntervalInput(value);
        const parsed = Number(value);
        if (value !== "" && !Number.isNaN(parsed)) {
            setRotationSettings((prev) => ({ ...prev, interval_hours: parsed }));
        }
    };

    const handleMaxCollectionsChange = (value: string) => {
        setMaxCollectionsInput(value);
        const parsed = Number(value);
        if (value !== "" && !Number.isNaN(parsed)) {
            setRotationSettings((prev) => ({ ...prev, max_collections: parsed }));
        }
    };

    const handleLibraryLimitChange = (libraryName: string, value: string) => {
        const trimmed = value.trim();
        setRotationSettings((prev) => {
            const newLimits = { ...prev.per_library_limits };
            if (trimmed === "" || trimmed === "0") {
                // Empty or 0 means no limit - remove from map
                delete newLimits[libraryName];
            } else {
                const parsed = Number(trimmed);
                if (!Number.isNaN(parsed) && parsed > 0) {
                    newLimits[libraryName] = parsed;
                }
            }
            return { ...prev, per_library_limits: newLimits };
        });
    };

    // Get enabled libraries for per-library limits UI
    const enabledLibraries = useMemo(() => {
        return plexSettings.libraries.filter((lib) => lib.enabled);
    }, [plexSettings.libraries]);

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
    async function fetchLogs(showLoading = false) {
        if (showLoading) setLoadingLogs(true);
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
        } catch (e: unknown) {
            setLogsError(e instanceof Error ? e.message : "Failed to load logs");
        } finally {
            if (showLoading) setLoadingLogs(false);
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


    async function downloadLogs() {
        try {
            const res = await fetchWithAuth("/api/logs/download");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "homescreen_hero.log";
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: unknown) {
            setLogsError(e instanceof Error ? e.message : "Failed to download logs");
        }
    }

    // Backup functions
    async function handleExport() {
        setExporting(true);
        setBackupToast(null);
        try {
            const res = await fetchWithAuth("/api/admin/config/export");
            if (!res.ok) throw new Error(await res.text());
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const disposition = res.headers.get("Content-Disposition");
            const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
            a.download = filenameMatch?.[1] || "config_backup.yaml";
            a.click();
            URL.revokeObjectURL(url);
            setBackupToast({ message: "Configuration exported successfully.", type: "success" });
        } catch (e: unknown) {
            setBackupToast({ message: e instanceof Error ? e.message : "Failed to export configuration.", type: "error" });
        } finally {
            setExporting(false);
        }
    }

    async function handleValidate() {
        if (!selectedFile) return;
        setValidating(true);
        setBackupToast(null);
        setValidationResult(null);
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            const res = await fetchWithAuth("/api/admin/config/import?validate_only=true", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                setValidationResult({ ok: false, message: data.detail || "Validation failed." });
            } else {
                setValidationResult({ ok: true, message: data.message });
            }
        } catch (e: unknown) {
            setBackupToast({ message: e instanceof Error ? e.message : "Validation request failed.", type: "error" });
        } finally {
            setValidating(false);
        }
    }

    async function handleImport() {
        if (!selectedFile) return;
        setImporting(true);
        setBackupToast(null);
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            const res = await fetchWithAuth("/api/admin/config/import", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || "Import failed.");
            }
            setBackupToast({ message: data.message, type: "success" });
            setSelectedFile(null);
            setValidationResult(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (e: unknown) {
            setBackupToast({ message: e instanceof Error ? e.message : "Failed to import configuration.", type: "error" });
        } finally {
            setImporting(false);
        }
    }

    async function fetchBackupStatus() {
        try {
            const res = await fetchWithAuth("/api/admin/config/backup-status");
            if (res.ok) {
                const data = await res.json();
                setBackupStatus(data);
            }
        } catch {
            // Non-fatal
        }
    }

    async function handleRevert() {
        setReverting(true);
        setBackupToast(null);
        try {
            const res = await fetchWithAuth("/api/admin/config/revert", { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || "Revert failed.");
            }
            setBackupToast({ message: data.message, type: "success" });
            fetchBackupStatus();
        } catch (e: unknown) {
            setBackupToast({ message: e instanceof Error ? e.message : "Failed to revert configuration.", type: "error" });
        } finally {
            setReverting(false);
        }
    }

    // Fetch backup status when switching to backup tab
    useEffect(() => {
        if (activeTab === "backup") {
            fetchBackupStatus();
        }
    }, [activeTab]);

    // Refresh backup status after import
    useEffect(() => {
        if (backupToast?.type === "success" && activeTab === "backup") {
            fetchBackupStatus();
        }
    }, [backupToast]);

    // Logs effects
    useEffect(() => {
        if (activeTab === "logs") {
            fetchLogs(true);
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== "logs" || paused) return;
        const id = window.setInterval(fetchLogs, 2000);
        return () => window.clearInterval(id);
    }, [activeTab, paused]);

    // Auto-scroll to bottom when following
    useEffect(() => {
        if (!follow || activeTab !== "logs") return;
        const el = scrollerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [lines, follow, activeTab]);

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
                    <AppearanceSection />

                    <CollapsibleFormSection
                        title="Plex"
                        description="Provide credentials for the media server this dashboard references."
                        icon={Server}
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
                            actions={
                                <button
                                    type="button"
                                    onClick={savePlexSettings}
                                    disabled={savingPlex || loadingPlex}
                                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {savingPlex ? "Saving…" : "Save Settings"}
                                </button>
                            }
                        />
                    </CollapsibleFormSection>

                    <div ref={authSectionRef}>
                    <CollapsibleFormSection
                        title="Authentication"
                        description="Control how users sign in to the dashboard."
                        icon={Shield}
                        defaultExpanded={authExpanded}
                    >
                        <FieldRow label="Login Methods" hint="Choose which authentication methods are available on the login page.">
                            <Listbox
                                value={authMethod}
                                onChange={(val) => setAuthMethod(val)}
                                disabled={loadingAuth}
                            >
                                <div className="relative">
                                    <Listbox.Button className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70 text-left flex items-center justify-between data-[disabled]:opacity-50">
                                        <span>
                                            {authMethod === "password" ? "Password Only" :
                                             authMethod === "plex" ? "Plex Only" :
                                             "Password + Plex"}
                                        </span>
                                        <ChevronDown size={16} className="text-slate-400" />
                                    </Listbox.Button>

                                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden focus:outline-none">
                                        <Listbox.Option
                                            value="password"
                                            className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 text-sm">
                                                <div>
                                                    <span className="data-[selected]:font-medium">Password Only</span>
                                                    <p className="text-xs text-slate-500">Admin signs in with a local username and password. No multi-user support.</p>
                                                </div>
                                                <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                            </div>
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="plex"
                                            className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 text-sm">
                                                <div>
                                                    <span className="data-[selected]:font-medium">Plex Only</span>
                                                    <p className="text-xs text-slate-500">All users sign in with their Plex account. Server owner is admin.</p>
                                                </div>
                                                <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                            </div>
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="both"
                                            className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 text-sm">
                                                <div>
                                                    <span className="data-[selected]:font-medium">Password + Plex</span>
                                                    <p className="text-xs text-slate-500">Admin can use password or Plex. Shared users sign in with Plex.</p>
                                                </div>
                                                <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                            </div>
                                        </Listbox.Option>
                                    </Listbox.Options>
                                </div>
                            </Listbox>
                        </FieldRow>

                        {/* Auto-approve toggle */}
                        <div className={authMethod === "password" ? "opacity-40 pointer-events-none" : ""}>
                            <FieldRow label="Auto-approve Users" hint="When off, new Plex users must be approved by an admin before they can sign in.">
                                <Switch
                                    checked={autoApproveUsers}
                                    onChange={setAutoApproveUsers}
                                    disabled={authMethod === "password"}
                                    className="group relative inline-flex h-6 w-11 items-center rounded-full transition data-[checked]:bg-primary bg-slate-600"
                                >
                                    <span className="inline-block h-5 w-5 transform rounded-full bg-white transition group-data-[checked]:translate-x-5 translate-x-1" />
                                </Switch>
                            </FieldRow>
                        </div>

                        {/* Save Button */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex-1">
                                {authMessage && (
                                    <p className="text-xs text-emerald-400">{authMessage}</p>
                                )}
                                {authError && (
                                    <p className="text-xs text-rose-400">{authError}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={saveAuthSettings}
                                disabled={savingAuth || loadingAuth}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingAuth ? (
                                    <>
                                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Save Settings
                                    </>
                                )}
                            </button>
                        </div>

                        {/* User list */}
                        <div className={`mt-4 pt-4 border-t border-slate-700/50 ${authMethod === "password" ? "opacity-40 pointer-events-none" : ""}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Users size={15} className="text-slate-400" />
                                    <h4 className="text-sm font-semibold text-slate-200">Users</h4>
                                    {users.filter(u => u.status === "pending").length > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
                                            {users.filter(u => u.status === "pending").length} pending
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={fetchUsers}
                                    disabled={loadingUsers || authMethod === "password"}
                                    className="text-xs text-primary hover:text-primary/80 transition disabled:opacity-50"
                                >
                                    {loadingUsers ? "Loading..." : "Refresh"}
                                </button>
                            </div>

                            {authMethod === "password" ? (
                                <p className="text-xs text-slate-500 py-3 text-center">Enable Plex authentication to manage users.</p>
                            ) : loadingUsers && users.length === 0 ? (
                                <p className="text-xs text-slate-500 py-3 text-center">Loading users...</p>
                            ) : users.length === 0 ? (
                                <p className="text-xs text-slate-500 py-3 text-center">No Plex users have signed in yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {users.map((u) => (
                                        <UserRow
                                            key={u.id}
                                            user={u}
                                            currentUsername={currentUsername}
                                            onUpdate={fetchUsers}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </CollapsibleFormSection>
                    </div>

                    <CollapsibleFormSection
                        title="Rotation Settings"
                        description="Configure how often the scheduler rotates featured collections."
                        icon={CalendarSync}
                        defaultExpanded={rotationExpanded}
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
                                value={intervalInput}
                                onChange={(e) => handleIntervalChange(e.target.value)}
                                disabled={loadingRotation}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </FieldRow>

                        <FieldRow label="Max collections" hint="Global cap on how many collections appear at once.">
                            <input
                                type="number"
                                min={1}
                                value={maxCollectionsInput}
                                onChange={(e) => handleMaxCollectionsChange(e.target.value)}
                                disabled={loadingRotation}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                            />
                        </FieldRow>

                        {enabledLibraries.length >= 2 && (
                            <FieldRow label="Per-library limits" hint="Optionally limit how many collections can come from each library. Leave empty for no limit.">
                                <div className="space-y-2">
                                    {enabledLibraries.map((lib) => (
                                        <div key={lib.name} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
                                            <span className="text-sm text-slate-200 flex-1">{lib.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400">Max:</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    placeholder="∞"
                                                    value={rotationSettings.per_library_limits[lib.name] ?? ""}
                                                    onChange={(e) => handleLibraryLimitChange(lib.name, e.target.value)}
                                                    disabled={loadingRotation}
                                                    className="w-16 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-primary/70 placeholder-slate-500 focus:placeholder-transparent"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <p className="text-xs text-slate-500 mt-1">
                                        These limits work alongside the global max. For example: global max=12, Movies max=6, TV max=6 means at most 6 from each library, up to 12 total.
                                    </p>
                                </div>
                            </FieldRow>
                        )}

                        <FieldRow label="Group Order" hint="How groups are ordered for processing during rotation.">
                            <Listbox
                                value={rotationSettings.group_order}
                                onChange={(val) =>
                                    setRotationSettings((prev) => ({
                                        ...prev,
                                        group_order: val,
                                    }))
                                }
                                disabled={loadingRotation}
                            >
                                <div className="relative">
                                    <Listbox.Button className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70 text-left flex items-center justify-between data-[disabled]:opacity-50">
                                        <span>
                                            {rotationSettings.group_order === "weighted" ? "Weighted" :
                                             rotationSettings.group_order === "random" ? "Random" :
                                             "Display Order"}
                                        </span>
                                        <ChevronDown size={16} className="text-slate-400" />
                                    </Listbox.Button>

                                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden focus:outline-none">
                                        <Listbox.Option
                                            value="display_order"
                                            className="px-3 py-2 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 text-sm">
                                                <span className="data-[selected]:font-medium">Display Order</span>
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
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingRotation ? (
                                    <>
                                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Save Settings
                                    </>
                                )}
                            </button>
                        </div>
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
                                {(["all", "plex", "trakt", "letterboxd", "mdblist", "anilist"] as const).map((filter) => (
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
                                                              : filter === "anilist"
                                                              ? "#2b7de9"
                                                              : "#4284c9",
                                                  }
                                                : undefined
                                        }
                                    >
                                        {filter === "anilist" ? "AniList" : filter.charAt(0).toUpperCase() + filter.slice(1)}
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
                            <IconButton label="Refresh" onClick={() => fetchLogs(true)} disabled={loadingLogs}>
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

                            <IconButton label="Download full log" onClick={downloadLogs}>
                                <Download size={18} />
                                Download
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

                            <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
                                <Switch
                                    checked={follow}
                                    onChange={setFollow}
                                    className="relative inline-flex h-5 w-9 items-center rounded-full transition data-[checked]:bg-emerald-500 bg-slate-600"
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${follow ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </Switch>
                                Follow
                            </label>
                        </div>
                    </div>

                    {/* Viewer */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                        {logsError ? (
                            <div className="p-4 text-amber-300 text-sm whitespace-pre-wrap">{logsError}</div>
                        ) : (
                            <div
                                ref={scrollerRef}
                                className="max-h-[70vh] overflow-auto font-mono text-[12px] leading-relaxed scrollbar-thin"
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

            {activeTab === "backup" ? (
                <div className="space-y-6">
                    <CollapsibleFormSection
                        title="Export Configuration"
                        description="Download your current config.yaml as a backup file."
                        icon={HardDriveDownload}
                        defaultExpanded
                    >
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400">
                                Export your current configuration to a YAML file. This includes all settings, groups, integration sources, and rotation rules.
                            </p>
                            <p className="text-xs text-amber-400/80">
                                Note: Sensitive values like API keys and tokens stored in config.yaml will be included in the export. Values from environment variables are not included.
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleExport}
                                    disabled={exporting}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {exporting ? (
                                        <>
                                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4" />
                                            Export Config
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </CollapsibleFormSection>

                    <CollapsibleFormSection
                        title="Import Configuration"
                        description="Upload a config.yaml file to replace your current configuration."
                        icon={HardDriveUpload}
                        defaultExpanded
                    >
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400">
                                Import a previously exported configuration file. Your current config will be automatically backed up before being replaced.
                            </p>

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Select File
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".yaml,.yml"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setSelectedFile(file);
                                        setValidationResult(null);
                                        setBackupToast(null);
                                    }}
                                    className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-slate-700 file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-100 hover:file:bg-slate-700 file:transition file:cursor-pointer"
                                />
                            </div>

                            {validationResult && (
                                <div className={`rounded-lg border px-3 py-2 text-xs ${
                                    validationResult.ok
                                        ? "border-emerald-700 bg-emerald-900/50 text-emerald-100"
                                        : "border-rose-700 bg-rose-950/60 text-rose-100"
                                }`}>
                                    {validationResult.message}
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleValidate}
                                    disabled={!selectedFile || validating}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {validating ? (
                                        <>
                                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Validating...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4" />
                                            Validate
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleImport}
                                    disabled={!selectedFile || importing || validating || (validationResult !== null && !validationResult.ok)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {importing ? (
                                        <>
                                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            Import Config
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </CollapsibleFormSection>

                    <CollapsibleFormSection
                        title="Revert Configuration"
                        description="Revert to the previous configuration that was replaced during import."
                        icon={Undo2}
                        defaultExpanded
                    >
                        <div className="space-y-4">
                            {backupStatus === null ? (
                                <p className="text-sm text-slate-500">Checking for backup...</p>
                            ) : !backupStatus.exists ? (
                                <p className="text-sm text-slate-400">
                                    No backup available. A backup is automatically created each time you import a configuration.
                                </p>
                            ) : (
                                <>
                                    <p className="text-sm text-slate-400">
                                        A backup of your previous configuration exists from{" "}
                                        <span className="text-slate-200 font-medium">
                                            {backupStatus.modified_at
                                                ? new Date(backupStatus.modified_at).toLocaleString()
                                                : "unknown date"}
                                        </span>.
                                        Reverting will swap your current config with this backup, so you can always revert again if needed.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handleRevert}
                                            disabled={reverting}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-600 text-amber-400 text-sm font-semibold transition hover:bg-amber-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {reverting ? (
                                                <>
                                                    <span className="h-4 w-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                                                    Reverting...
                                                </>
                                            ) : (
                                                <>
                                                    <Undo2 className="h-4 w-4" />
                                                    Revert to Previous Config
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </CollapsibleFormSection>

                </div>
            ) : null}

            {backupToast && (
                <Toast
                    message={backupToast.message}
                    type={backupToast.type}
                    onClose={() => setBackupToast(null)}
                />
            )}
        </div>
    );
}
