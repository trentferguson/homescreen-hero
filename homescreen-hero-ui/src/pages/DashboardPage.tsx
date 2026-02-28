import { useEffect, useState, useMemo, useRef } from "react";
import { DndContext, rectIntersection, DragOverlay } from "@dnd-kit/core";
import type { DragStartEvent, DragOverEvent } from "@dnd-kit/core";
import { Lock, Unlock, ChevronDown, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import type { ActiveCollection } from "../components/ActiveCollectionsCard";
import { DraggableWidget, DroppableSection, EditModeBanner } from "../components/dashboard";
import { widgetRegistry } from "../widgets/registry";
import ActiveCollectionsCard from "../components/ActiveCollectionsCard";
import AnalyticsCard from "../components/AnalyticsCard";
import MostActiveUsersCard from "../components/MostActiveUsersCard";
import ActiveStreamsCard from "../components/ActiveStreamsCard";
import GraphCarouselCard from "../components/GraphCarouselCard";
import HealthCard from "../components/HealthCard";
import RotationStatusCard from "../components/RotationStatusCard";
import RecentRotationsCard from "../components/RecentRotationsCard";
import IntegrationsHealthCard from "../components/IntegrationsHealthCard";
import SeerrCarouselCard from "../components/SeerrCarouselCard";
import Toast from "../components/Toast";
import { timeAgo } from "../utils/dates";
import { fetchWithAuth } from "../utils/api";
import { useDashboardLayout } from "../hooks/useDashboardLayout";

type RotationHistoryItem = {
    id: number;
    created_at: string;
    success: boolean;
    error_message?: string | null;
    featured_collections: string[];
};

type HealthComponent = { ok: boolean; error?: string;[k: string]: unknown };

type RotationExecution = {
    rotation: {
        selected_collections: string[];
        groups: {
            group_name: string;
            chosen_collections: string[];
            available_collections: string[];
            picked_count: number;
            reason_skipped?: string | null;
            active: boolean;
            min_picks: number;
            max_picks: number;
        }[];
        max_global: number;
        remaining_global: number;
        today: string;
    };
    applied_collections: string[];
    dry_run: boolean;
    simulation_id?: number | null;
};

const healthEndpoints = {
    config: "/api/health/config",
    database: "/api/health/database",
    trakt: "/api/health/trakt",
    plex: "/api/health/plex",
} as const;

type HealthMap = Partial<Record<keyof typeof healthEndpoints, HealthComponent>>;

// Cache configuration
const HEALTH_CACHE_KEY = "healthscreen-hero-health-cache";
const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type HealthCache = {
    data: HealthMap;
    timestamp: number;
};

export default function Dashboard() {
    const [health, setHealth] = useState<HealthMap>({});
    const [healthLoading, setHealthLoading] = useState(true);
    const [history, setHistory] = useState<RotationHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<null | "simulate" | "apply" | "sync">(null);
    const [simulation, setSimulation] = useState<RotationExecution | null>(null);
    const [showSimulationModal, setShowSimulationModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const [pendingUserCount, setPendingUserCount] = useState(0);

    const [activeCollections, setActiveCollections] = useState<ActiveCollection[]>([]);
    const [activeLoading, setActiveLoading] = useState(true);
    const [tautulliEnabled, setTautulliEnabled] = useState<boolean>(false);
    const [seerrEnabled, setSeerrEnabled] = useState<boolean>(false);
    const [schedulerStatus, setSchedulerStatus] = useState<{
        enabled: boolean;
        interval_hours: number;
        next_run_time: string | null;
        is_running: boolean;
    } | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [rotationDropdownOpen, setRotationDropdownOpen] = useState(false);
    const rotationDropdownRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();
    const { authMethod } = useAuth();

    // Dashboard layout customization
    const {
        visibilityMap,
        visibleStatusBarWidgets,
        visibleMainWidgets,
        toggleVisibility,
        isWidgetAvailable,
        isEditMode,
        toggleEditMode,
        reorderStatusBarWidgets,
        reorderMainWidgets,
    } = useDashboardLayout({ tautulli: tautulliEnabled, seerr: seerrEnabled });

    // Compute hidden widgets for the "Add Widget" dropdown
    const hiddenWidgets = useMemo(() => {
        return Object.values(widgetRegistry)
            .filter((widget) => !visibilityMap[widget.id])
            .map((widget) => ({
                id: widget.id,
                name: widget.name,
                description: widget.description,
                available: isWidgetAvailable(widget.id),
            }));
    }, [visibilityMap, isWidgetAvailable]);

    // Track which widget is being dragged for overlay
    const [activeId, setActiveId] = useState<string | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(String(event.active.id));
    };

    // Handle drag over for real-time reordering preview
    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const draggedId = String(active.id);
        const overId = String(over.id);

        // Only reorder within the same section
        const activeWidget = widgetRegistry[draggedId];
        const overWidget = widgetRegistry[overId];

        if (!activeWidget || !overWidget) return;
        if (activeWidget.section !== overWidget.section) return;

        // Reorder during drag for real-time preview
        if (activeWidget.section === "status-bar") {
            reorderStatusBarWidgets(draggedId, overId);
        } else {
            reorderMainWidgets(draggedId, overId);
        }
    };

    // Handle drag end - just clear the active state
    const handleDragEnd = () => {
        setActiveId(null);
    };

    const plex = health.plex;
    const plexDetails = plex?.details as { server_name?: string; libraries?: unknown[]; enabled_count?: number } | undefined;

    const plexServerName = plexDetails?.server_name ?? "Plex";
    const plexLibraries = plexDetails?.libraries;
    const plexLibraryInfo = plexLibraries
        ? `${plexDetails?.enabled_count ?? plexLibraries.length} ${plexLibraries.length === 1 ? 'library' : 'libraries'}`
        : null;
    const plexDetail = [plexServerName, plexLibraryInfo]
        .filter((value): value is string => Boolean(value))
        .join(" • ");

    const loadHealthFromCache = (): HealthCache | null => {
        try {
            const cached = localStorage.getItem(HEALTH_CACHE_KEY);
            if (!cached) return null;

            const parsedCache: HealthCache = JSON.parse(cached);
            const age = Date.now() - parsedCache.timestamp;

            if (age > HEALTH_CACHE_TTL_MS) {
                localStorage.removeItem(HEALTH_CACHE_KEY);
                return null;
            }

            return parsedCache;
        } catch {
            return null;
        }
    };

    const saveHealthToCache = (data: HealthMap) => {
        try {
            const cache: HealthCache = {
                data,
                timestamp: Date.now(),
            };
            localStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify(cache));
        } catch {
            // Ignore cache save errors
        }
    };

    const loadHealth = async (forceRefresh = false) => {
        // Try to load from cache first
        if (!forceRefresh) {
            const cached = loadHealthFromCache();
            if (cached) {
                setHealth(cached.data);
                setHealthLoading(false);
                return;
            }
        }

        setHealthLoading(true);

        const entries = await Promise.all(
            (Object.entries(healthEndpoints) as [keyof typeof healthEndpoints, string][]).map(
                async ([key, url]) => {
                    try {
                        const response = await fetchWithAuth(url);
                        const payload = await response.json();

                        if (!response.ok) {
                            const message = (payload as { error?: string })?.error ?? `HTTP ${response.status}`;
                            return [key, { ok: false, error: message } satisfies HealthComponent];
                        }

                        return [key, payload as HealthComponent];
                    } catch (e) {
                        return [key, { ok: false, error: String(e) } satisfies HealthComponent];
                    }
                },
            ),
        );

        const healthData = Object.fromEntries(entries) as HealthMap;
        setHealth(healthData);
        saveHealthToCache(healthData);
        setHealthLoading(false);
    };


    const loadActiveCollections = async () => {
        setActiveLoading(true);

        try {
            const response = await fetchWithAuth("/api/collections/active");
            const payload = await response.json();
            setActiveCollections(payload.collections ?? []);
        } catch (e) {
            setError(String(e));
        } finally {
            setActiveLoading(false);
        }
    };

    const loadSchedulerStatus = async () => {
        try {
            const response = await fetchWithAuth("/api/rotate/scheduler-status");
            const payload = await response.json();
            setSchedulerStatus(payload);
        } catch (e) {
            console.error("Failed to load scheduler status:", e);
        }
    };

    const loadTautulliConfig = async () => {
        try {
            const response = await fetchWithAuth("/api/admin/config/tautulli");
            if (response.ok) {
                const config = await response.json();
                setTautulliEnabled(config.enabled ?? false);
            } else {
                setTautulliEnabled(false);
            }
        } catch (e) {
            console.error("Failed to load Tautulli config:", e);
            setTautulliEnabled(false);
        }
    };

    const loadSeerrConfig = async () => {
        try {
            const response = await fetchWithAuth("/api/admin/config/seerr");
            if (response.ok) {
                const config = await response.json();
                setSeerrEnabled(config.enabled ?? false);
            } else {
                setSeerrEnabled(false);
            }
        } catch (e) {
            console.error("Failed to load Seerr config:", e);
            setSeerrEnabled(false);
        }
    };

    const loadPendingUsers = async () => {
        if (authMethod !== "plex" && authMethod !== "both") return;
        try {
            const resp = await fetchWithAuth("/api/auth/users");
            if (resp.ok) {
                const data = await resp.json();
                const pending = (data.users ?? []).filter((u: { status: string }) => u.status === "pending");
                setPendingUserCount(pending.length);
            }
        } catch {
            // Non-critical — silently ignore
        }
    };

    useEffect(() => {
        void loadActiveCollections();
        void loadSchedulerStatus();
        void loadTautulliConfig();
        void loadSeerrConfig();
        void loadPendingUsers();
    }, []);

    // Update current time every second for live countdown
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const refresh = () => {
        setError(null);
        setHistoryLoading(true);
        void loadHealth();
        void loadActiveCollections();
        void loadSchedulerStatus();
        fetchWithAuth("/api/history/all?limit=50")
            .then(async (r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
                return r.json();
            })
            .then((payload: RotationHistoryItem[]) => setHistory(payload ?? []))
            .catch((e) => setError(String(e)))
            .finally(() => setHistoryLoading(false));
    };

    useEffect(() => {
        refresh();
    }, []);

    // Close rotation dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (rotationDropdownRef.current && !rotationDropdownRef.current.contains(event.target as Node)) {
                setRotationDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const rotationItems = history.map((record) => {
        const { featured_collections } = record;

        let summary = record.success ? "Rotation succeeded" : "Rotation failed";
        if (featured_collections?.length) {
            summary = `Featured: ${featured_collections.join(", ")}`;
        }

        return {
            id: record.id,
            created_at: record.created_at,
            success: record.success,
            summary,
            error_message: record.error_message,
            featured_collections: featured_collections ?? [],
        };
    });

    const lastRun = history.length
        ? { created_at: history[0].created_at, success: history[0].success, duration: null }
        : null;

    async function simulateRotation() {
        try {
            setBusy("simulate");
            setError(null);
            const r = await fetchWithAuth("/api/rotate/simulate-next", { method: "POST" });
            if (!r.ok) throw new Error(`Simulation failed: HTTP ${r.status} ${await r.text()}`);
            const payload: RotationExecution = await r.json();
            setSimulation(payload);
            setShowSimulationModal(true);
            void loadActiveCollections();
        } catch (e) {
            setError(String(e));
        } finally {
            setBusy(null);
        }
    }

    async function applySimulation() {
        if (!simulation?.simulation_id) {
            setError("No simulation available to apply.");
            return;
        }

        try {
            setBusy("apply");
            setError(null);
            const r = await fetchWithAuth(`/api/rotate/use-simulation/${simulation.simulation_id}`, { method: "POST" });
            if (!r.ok) throw new Error(`Apply simulation failed: HTTP ${r.status} ${await r.text()}`);
            await r.json();
            setShowSimulationModal(false);
            refresh();
            void loadActiveCollections();
        } catch (e) {
            setError(String(e));
        } finally {
            setBusy(null);
        }
    }

    async function forceRunRotation() {
        try {
            setBusy("sync");
            setError(null);
            const r = await fetchWithAuth("/api/rotate/rotate-now", { method: "POST" });
            if (!r.ok) throw new Error(`Force sync failed: HTTP ${r.status} ${await r.text()}`);

            const result = await r.json();

            // Show success toast
            setToast({
                message: result.message || "Rotation completed successfully!",
                type: "success"
            });

            refresh();
            void loadActiveCollections();
        } catch (e) {
            setError(String(e));
            setToast({
                message: "Failed to run rotation",
                type: "error"
            });
        } finally {
            setBusy(null);
        }
    }

    async function syncAllLists() {
        try {
            setBusy("sync");
            setError(null);
            const r = await fetchWithAuth("/api/rotate/sync-all", { method: "POST" });
            if (!r.ok) throw new Error(`Sync failed: HTTP ${r.status} ${await r.text()}`);

            const result = await r.json();

            // Show success toast
            setToast({
                message: result.message || "All lists synced successfully!",
                type: "success"
            });

            void loadActiveCollections();
        } catch (e) {
            setError(String(e));
            setToast({
                message: "Failed to sync lists",
                type: "error"
            });
        } finally {
            setBusy(null);
        }
    }

    // Render individual widgets based on ID
    const renderWidget = (widgetId: string) => {
        switch (widgetId) {
            case "plex-health":
                return (
                    <HealthCard
                        key={widgetId}
                        title="Plex"
                        ok={plex?.ok}
                        loading={!plex && healthLoading}
                        subtitleOk="Online"
                        subtitleBad="Offline"
                        detail={
                            !plex && healthLoading
                                ? "Checking health…"
                                : plex?.ok
                                    ? plexDetail
                                    : plex?.error ?? "Connection failed"
                        }
                        icon={
                            <img src="/plex_icon_white.png" alt="Plex" className="w-12 h-12 object-contain" />
                        }
                    />
                );
            case "active-streams":
                return <ActiveStreamsCard key={widgetId} loading={healthLoading} />;
            case "integrations-health":
                return <IntegrationsHealthCard key={widgetId} loading={healthLoading} />;
            case "rotation-status":
                return (
                    <RotationStatusCard
                        key={widgetId}
                        enabled={schedulerStatus?.enabled ?? false}
                        nextRunTime={schedulerStatus?.next_run_time ?? null}
                        loading={schedulerStatus === null}
                        currentTime={currentTime}
                    />
                );
            case "active-collections":
                return <ActiveCollectionsCard key={widgetId} collections={activeCollections} loading={activeLoading} />;
            case "analytics":
                return <AnalyticsCard key={widgetId} loading={healthLoading} />;
            case "most-active-users":
                return <MostActiveUsersCard key={widgetId} loading={healthLoading} />;
            case "graph-carousel":
                return <GraphCarouselCard key={widgetId} loading={healthLoading} />;
            case "recent-rotations":
                return (
                    <RecentRotationsCard
                        key={widgetId}
                        items={rotationItems}
                        lastRun={lastRun}
                        loading={historyLoading}
                        formatTimeAgo={timeAgo}
                    />
                );
            case "seerr-carousel":
                return <SeerrCarouselCard key={widgetId} loading={healthLoading} />;
            default:
                return null;
        }
    };

    return (
        <>
            {showSimulationModal && simulation ? (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 px-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800/80 animate-in zoom-in-95 duration-300">
                        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-800/80">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Simulation Results</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Simulation ID: {simulation.simulation_id ?? "N/A"}
                                </p>
                            </div>
                            <button
                                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-200 text-2xl leading-none px-2"
                                onClick={() => setShowSimulationModal(false)}
                                aria-label="Close simulation results"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hover-only">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Selected Collections</h4>
                                {simulation.rotation.selected_collections.length ? (
                                    <ul className="list-disc list-inside text-slate-700 dark:text-slate-200 space-y-1">
                                        {simulation.rotation.selected_collections.map((name) => (
                                            <li key={name}>{name}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-slate-500">No collections selected.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Max Global</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{simulation.rotation.max_global}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Remaining Slots</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{simulation.rotation.remaining_global}</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Group Details</h4>
                                <div className="space-y-3">
                                    {simulation.rotation.groups.map((group) => (
                                        <div
                                            key={group.group_name}
                                            className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50/60 dark:bg-slate-800/40"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                <div>
                                                    <p className="font-semibold text-slate-900 dark:text-white">{group.group_name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        Picks: {group.picked_count} / {group.max_picks} (min {group.min_picks})
                                                    </p>
                                                </div>
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${group.active
                                                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                                                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                                        }`}
                                                >
                                                    {group.active ? "Active" : "Inactive"}
                                                </span>
                                            </div>

                                            {group.reason_skipped ? (
                                                <p className="text-xs text-amber-600 dark:text-amber-300 mt-2">
                                                    Skipped: {group.reason_skipped}
                                                </p>
                                            ) : null}

                                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                                                        Available
                                                    </p>
                                                    {group.available_collections.length ? (
                                                        <ul className="text-sm text-slate-700 dark:text-slate-200 list-disc list-inside space-y-1">
                                                            {group.available_collections.map((collection) => (
                                                                <li key={collection}>{collection}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-sm text-slate-500">None</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                                                        Chosen
                                                    </p>
                                                    {group.chosen_collections.length ? (
                                                        <ul className="text-sm text-slate-700 dark:text-slate-200 list-disc list-inside space-y-1">
                                                            {group.chosen_collections.map((collection) => (
                                                                <li key={collection}>{collection}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-sm text-slate-500">None</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50">
                            <button
                                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-200 active:scale-95"
                                onClick={() => setShowSimulationModal(false)}
                                disabled={busy !== null}
                            >
                                Close
                            </button>
                            <button
                                className="px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-60"
                                onClick={applySimulation}
                                disabled={busy !== null}
                            >
                                {busy === "apply" ? "Applying…" : "Apply Simulation"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="max-w-8xl mx-auto flex flex-col gap-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col gap-1.5">
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">System Overview</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Monitor rotation status, history, and collection usage.
                        </p>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={toggleEditMode}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 active:scale-95 ${
                                isEditMode
                                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                                    : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300"
                            }`}
                            title={isEditMode ? "Lock dashboard" : "Edit layout"}
                        >
                            {isEditMode ? <Unlock size={18} /> : <Lock size={18} />}
                        </button>

                        <button
                            onClick={syncAllLists}
                            disabled={busy !== null}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60"
                        >
                            {busy === "sync" ? "Syncing…" : "Sync All Lists"}
                        </button>

                        {/* Split button for Run Rotation */}
                        <div className="relative" ref={rotationDropdownRef}>
                            <div className="flex">
                                <button
                                    onClick={forceRunRotation}
                                    disabled={busy !== null}
                                    className="flex items-center gap-2 px-4 py-2 rounded-l-lg bg-primary hover:bg-blue-600 text-white shadow-lg shadow-primary/30 hover:shadow-primary/40 text-sm font-bold transition-all duration-200 active:scale-95 disabled:opacity-60"
                                >
                                    {busy === "apply" ? "Running…" : "Run Rotation Now"}
                                </button>
                                <button
                                    onClick={() => setRotationDropdownOpen(!rotationDropdownOpen)}
                                    disabled={busy !== null}
                                    className="flex items-center px-2 py-2 rounded-r-lg bg-primary hover:bg-blue-600 text-white shadow-lg shadow-primary/30 hover:shadow-primary/40 border-l border-blue-400/30 transition-all duration-200 active:scale-95 disabled:opacity-60"
                                >
                                    <ChevronDown size={16} className={`transition-transform ${rotationDropdownOpen ? "rotate-180" : ""}`} />
                                </button>
                            </div>
                            {rotationDropdownOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-50 overflow-hidden">
                                    <button
                                        onClick={() => {
                                            simulateRotation();
                                            setRotationDropdownOpen(false);
                                        }}
                                        disabled={busy !== null}
                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-700/50 transition-colors disabled:opacity-60"
                                    >
                                        {busy === "simulate" ? "Simulating…" : "Simulate Rotation"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pending user approvals banner */}
                {pendingUserCount > 0 && (
                    <button
                        onClick={() => navigate("/settings?section=auth")}
                        className="flex items-center gap-3 w-full p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                    >
                        <Users size={18} />
                        <span>
                            <strong>{pendingUserCount}</strong> {pendingUserCount === 1 ? "user" : "users"} pending approval
                        </span>
                        <span className="ml-auto flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 text-sm">
                            Review
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>
                        </span>
                    </button>
                )}

                {/* Errors */}
                {error ? (
                    <pre className="p-4 rounded-xl bg-red-900/30 border border-red-900/50 text-red-200 whitespace-pre-wrap shadow-lg">
                        {error}
                    </pre>
                ) : null}

                <DndContext
                    collisionDetection={rectIntersection}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    {/* Edit mode banner */}
                    {isEditMode && (
                        <EditModeBanner
                            hiddenWidgets={hiddenWidgets}
                            onAddWidget={toggleVisibility}
                        />
                    )}

                    {/* Status Bar - always 4 columns for 1x1 health widgets */}
                    {visibleStatusBarWidgets.length > 0 && (
                        <DroppableSection id="status-bar" items={visibleStatusBarWidgets}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {visibleStatusBarWidgets.map((widgetId) => (
                                    <DraggableWidget
                                        key={widgetId}
                                        id={widgetId}
                                        isEditMode={isEditMode}
                                        onHide={() => toggleVisibility(widgetId)}
                                    >
                                        {renderWidget(widgetId)}
                                    </DraggableWidget>
                                ))}
                            </div>
                        </DroppableSection>
                    )}

                    {/* Main Widget Grid */}
                    {visibleMainWidgets.length > 0 && (
                        <DroppableSection id="main" items={visibleMainWidgets}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {visibleMainWidgets.map((widgetId) => (
                                    <DraggableWidget
                                        key={widgetId}
                                        id={widgetId}
                                        isEditMode={isEditMode}
                                        colSpan={widgetRegistry[widgetId]?.colSpan}
                                        onHide={() => toggleVisibility(widgetId)}
                                    >
                                        {renderWidget(widgetId)}
                                    </DraggableWidget>
                                ))}
                            </div>
                        </DroppableSection>
                    )}

                    {/* Drag overlay for smooth visual feedback */}
                    <DragOverlay>
                        {activeId ? (
                            <div className="opacity-90 shadow-2xl rounded-xl">
                                {renderWidget(activeId)}
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>

                {/* Footer */}
                <div className="border-t border-slate-200 dark:border-slate-800 mt-4 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 dark:text-slate-500">
                    <p>© {new Date().getFullYear()} homescreen-hero </p>
                    <div className="flex gap-4 mt-2 md:mt-0">
                        <button onClick={refresh} className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors">
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
}
