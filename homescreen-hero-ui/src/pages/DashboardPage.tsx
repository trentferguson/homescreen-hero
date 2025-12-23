import { useEffect, useState } from "react";
import type { ActiveCollection } from "../components/ActiveCollectionsCard";
import ActiveCollectionsCard from "../components/ActiveCollectionsCard";
import HealthCard from "../components/HealthCard";
import RecentRotationsCard from "../components/RecentRotationsCard";
import { timeAgo } from "../utils/dates";
import { fetchWithAuth } from "../utils/api";

type RotationHistoryItem = {
    id: number;
    created_at: string;
    success: boolean;
    error_message?: string | null;
    featured_collections: string[];
};

type HealthComponent = { ok: boolean; error?: string;[k: string]: any };

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

    const [activeCollections, setActiveCollections] = useState<ActiveCollection[]>([]);
    const [activeLoading, setActiveLoading] = useState(true);
    const [lastHealthCheck, setLastHealthCheck] = useState<number | null>(null);

    const plex = health.plex;
    const cfg = health.config;
    const db = health.database;
    const trakt = health.trakt;

    const plexServerName = plex?.details?.server_name ?? plex?.server_name ?? "Plex";
    const plexLibraryName = plex?.details?.library_name ?? plex?.library_name;
    const plexDetail = [plexServerName, plexLibraryName]
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
            setLastHealthCheck(Date.now());
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
                setLastHealthCheck(cached.timestamp);
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

    // Treat trakt “disabled/not configured” as OK but show message
    const traktDisabledMsg =
        trakt?.error && trakt.error.toLowerCase().includes("disabled")
            ? trakt.error
            : null;

    const traktOk = trakt?.ok ?? false;
    const traktDisplayOk = traktDisabledMsg ? true : traktOk;

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

    useEffect(() => {
        void loadActiveCollections();
    }, []);

    const refreshHealth = async () => {
        await loadHealth(true);
    };

    const refresh = () => {
        setError(null);
        setHistoryLoading(true);
        void loadHealth();
        void loadActiveCollections();
        fetchWithAuth("/api/history/all?limit=10")
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

    const rotationItems = history.map((record) => {
        const { featured_collections } = record;

        let summary = record.success ? "Rotation succeeded" : "Rotation failed";
        if (featured_collections?.length) {
            summary = `Featured: ${featured_collections.join(", ")}`;
        }

        return {
            created_at: record.created_at,
            success: record.success,
            summary,
            error_message: record.error_message,
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
            refresh();
            void loadActiveCollections();
        } catch (e) {
            setError(String(e));
        } finally {
            setBusy(null);
        }
    }


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

            <div className="max-w-8xl mx-auto flex flex-col gap-8">
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
                            onClick={refreshHealth}
                            disabled={healthLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60"
                            title={lastHealthCheck ? `Last checked: ${new Date(lastHealthCheck).toLocaleTimeString()}` : undefined}
                        >
                            {healthLoading ? "Checking…" : "Refresh Health"}
                        </button>

                        <button
                            onClick={simulateRotation}
                            disabled={busy !== null}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60"
                        >
                            {busy === "simulate" ? "Simulating…" : "Simulate Rotation"}
                        </button>

                        <button
                            onClick={forceRunRotation}
                            disabled={busy !== null}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white shadow-lg shadow-primary/30 hover:shadow-primary/40 text-sm font-bold transition-all duration-200 active:scale-95 disabled:opacity-60"
                        >
                            {busy === "sync" ? "Syncing…" : "Run Rotation Now"}
                        </button>
                    </div>
                </div>

                {/* Errors */}
                {error ? (
                    <pre className="p-4 rounded-xl bg-red-900/30 border border-red-900/50 text-red-200 whitespace-pre-wrap shadow-lg">
                        {error}
                    </pre>
                ) : null}

                {/* Health Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <HealthCard
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
                    />

                    <HealthCard
                        title="Config"
                        ok={cfg?.ok}
                        loading={!cfg && healthLoading}
                        subtitleOk="Loaded"
                        subtitleBad="Error"
                        detail={
                            !cfg && healthLoading
                                ? "Checking health…"
                                : cfg?.ok
                                    ? "Config Validated"
                                    : cfg?.error ?? "Failed to load config"
                        }
                    />

                    <HealthCard
                        title="SQL Database"
                        ok={db?.ok}
                        loading={!db && healthLoading}
                        subtitleOk="Ready"
                        subtitleBad="Error"
                        detail={
                            !db && healthLoading
                                ? "Checking health…"
                                : db?.ok
                                    ? "DB OK"
                                    : db?.error ?? "Database unavailable"
                        }
                    />

                    <HealthCard
                        title="Trakt"
                        ok={traktDisplayOk}
                        loading={!trakt && healthLoading}
                        subtitleOk={traktDisabledMsg ? "Disabled" : "Online"}
                        subtitleBad="Error"
                        detail={
                            !trakt && healthLoading
                                ? "Checking health…"
                                : traktDisabledMsg
                                    ? traktDisabledMsg
                                    : traktOk
                                        ? "Trakt OK"
                                        : trakt?.error ?? "Trakt check failed"
                        }
                    />

                    {/* Active Collections */}
                    <div className="col-span-full w-full">
                        <ActiveCollectionsCard collections={activeCollections} loading={activeLoading} />
                    </div>
                </div>

                <RecentRotationsCard
                    items={rotationItems}
                    lastRun={lastRun}
                    loading={historyLoading}
                    formatTimeAgo={timeAgo}
                />


                {/* Footer */}
                <div className="border-t border-slate-200 dark:border-slate-800 mt-4 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 dark:text-slate-500">
                    <p>© {new Date().getFullYear()} HomeScreen Hero</p>
                    <div className="flex gap-4 mt-2 md:mt-0">
                        <button onClick={refresh} className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors">
                            Refresh
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}