import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "../../utils/api";
import type {
    Source,
    SourceStatus,
    BaseMissingItem,
    ConfigSaveResponse,
    HealthComponent,
    TestStatus,
} from "../../types/integrations";

// Extract a human-readable message from a failed response.
// FastAPI returns {"detail": "..."} for HTTPExceptions.
async function extractError(r: Response): Promise<string> {
    const text = await r.text();
    try {
        const json = JSON.parse(text);
        if (typeof json.detail === "string") return json.detail;
    } catch { /* not JSON, fall through */ }
    return text || `Request failed (${r.status})`;
}

export interface UseListIntegrationConfig<TSettings> {
    // API endpoint base (e.g., "trakt", "letterboxd", "mdblist")
    integrationName: string;

    // Initial settings state
    initialSettings: TSettings;

    // Whether this integration has configurable settings (Letterboxd doesn't)
    hasSettings: boolean;

    // Health endpoint for test connection (e.g., "/api/health/trakt")
    healthEndpoint?: string;
}

export interface UseListIntegrationReturn<TSettings, TMissing> {
    // Settings
    settings: TSettings;
    setSettings: React.Dispatch<React.SetStateAction<TSettings>>;
    loadingSettings: boolean;
    savingSettings: boolean;
    saveSettings: () => Promise<void>;

    // Test connection
    testStatus: TestStatus;
    testConnection: () => Promise<void>;

    // Sources
    sources: Source[];
    loadingSources: boolean;

    // Toast notification (replaces inline banners)
    toast: { message: string; type: "success" | "error" } | null;
    clearToast: () => void;

    // Source mutations
    newSource: Source;
    setNewSource: React.Dispatch<React.SetStateAction<Source>>;
    addSource: (sourceOverride?: Source) => Promise<boolean>;
    updateSource: (index: number, source: Source) => Promise<void>;
    removeSource: (index: number) => Promise<void>;
    syncSource: (index: number) => Promise<void>;
    savingSource: boolean;
    syncingSource: number | null;
    deletingSource: number | null;

    // Source statuses
    statuses: Map<number, SourceStatus>;

    // Missing items
    missingItems: Map<number, TMissing[]>;
    expandedMissing: Set<number>;
    missingPages: Map<number, number>;
    loadingMissing: Set<number>;
    toggleMissingItems: (index: number) => void;
    setMissingPage: (index: number, page: number) => void;
}

export function useListIntegration<TSettings, TMissing extends BaseMissingItem>(
    config: UseListIntegrationConfig<TSettings>
): UseListIntegrationReturn<TSettings, TMissing> {
    const { integrationName, initialSettings, hasSettings, healthEndpoint } = config;
    const basePath = `/api/admin/config/${integrationName}`;

    // Settings state
    const [settings, setSettings] = useState<TSettings>(initialSettings);
    const [loadingSettings, setLoadingSettings] = useState(hasSettings);
    const [savingSettings, setSavingSettings] = useState(false);

    // Test connection state
    const [testStatus, setTestStatus] = useState<TestStatus>("idle");

    // Sources state
    const [sources, setSources] = useState<Source[]>([]);
    const [loadingSources, setLoadingSources] = useState(true);

    // Toast notification (replaces separate settings/sources message/error states)
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Source mutation state
    const [newSource, setNewSource] = useState<Source>({
        name: "",
        url: "",
        plex_library: "",
    });
    const [savingSource, setSavingSource] = useState(false);
    const [syncingSource, setSyncingSource] = useState<number | null>(null);
    const [deletingSource, setDeletingSource] = useState<number | null>(null);

    // Status state
    const [statuses, setStatuses] = useState<Map<number, SourceStatus>>(new Map());

    // Missing items state
    const [missingItems, setMissingItems] = useState<Map<number, TMissing[]>>(new Map());
    const [expandedMissing, setExpandedMissing] = useState<Set<number>>(new Set());
    const [missingPages, setMissingPages] = useState<Map<number, number>>(new Map());
    const [loadingMissing, setLoadingMissing] = useState<Set<number>>(new Set());

    // Load settings (if applicable)
    useEffect(() => {
        if (!hasSettings) {
            setLoadingSettings(false);
            return;
        }

        let isMounted = true;

        fetchWithAuth(basePath)
            .then(async (r) => {
                if (!r.ok) throw new Error(await extractError(r));
                return r.json();
            })
            .then((data: TSettings | null) => {
                if (!isMounted || !data) return;
                setSettings(data);
            })
            .catch((e) => {
                if (isMounted) setToast({ message: String(e), type: "error" });
            })
            .finally(() => {
                if (isMounted) setLoadingSettings(false);
            });

        return () => {
            isMounted = false;
        };
    }, [basePath, hasSettings]);

    // Load sources
    useEffect(() => {
        let isMounted = true;

        fetchWithAuth(`${basePath}/sources`)
            .then(async (r) => {
                if (!r.ok) throw new Error(await extractError(r));
                return r.json();
            })
            .then((data: Source[]) => {
                if (isMounted) setSources(data || []);
            })
            .catch((e) => {
                if (isMounted) setToast({ message: String(e), type: "error" });
            })
            .finally(() => {
                if (isMounted) setLoadingSources(false);
            });

        return () => {
            isMounted = false;
        };
    }, [basePath]);

    // Load source statuses
    useEffect(() => {
        if (loadingSources || sources.length === 0) return;

        let isMounted = true;

        fetchWithAuth(`${basePath}/sources/status`)
            .then(async (r) => {
                if (!r.ok) throw new Error(await extractError(r));
                return r.json();
            })
            .then((data: SourceStatus[]) => {
                if (!isMounted) return;
                const statusMap = new Map<number, SourceStatus>();
                data.forEach((status) => statusMap.set(status.source_index, status));
                setStatuses(statusMap);
            })
            .catch(() => {
                // Silently fail, statuses are optional
            });

        return () => {
            isMounted = false;
        };
    }, [basePath, loadingSources, sources.length]);

    const clearToast = useCallback(() => setToast(null), []);

    // Save settings
    const saveSettings = useCallback(async () => {
        if (!hasSettings) return;

        try {
            setSavingSettings(true);

            const r = await fetchWithAuth(basePath, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (!r.ok) throw new Error(await extractError(r));

            const data: ConfigSaveResponse = await r.json();
            setToast({ message: data.message, type: "success" });
        } catch (e) {
            setToast({ message: String(e), type: "error" });
        } finally {
            setSavingSettings(false);
        }
    }, [basePath, hasSettings, settings]);

    // Test connection
    const testConnection = useCallback(async () => {
        if (!healthEndpoint) return;

        try {
            setTestStatus("testing");

            const r = await fetchWithAuth(healthEndpoint);
            if (!r.ok) throw new Error(await extractError(r));

            const data: HealthComponent = await r.json();

            if (data?.ok === true) {
                setTestStatus("success");
            } else {
                setTestStatus("error");
                setToast({ message: data?.error || `${integrationName} API health check failed.`, type: "error" });
            }
        } catch (e) {
            setTestStatus("error");
            setToast({ message: String(e), type: "error" });
        }
    }, [healthEndpoint, integrationName]);

    // Add source (accepts optional override for integrations with custom forms)
    // Returns true on success so callers can reset their form only when appropriate
    const addSource = useCallback(async (sourceOverride?: Source): Promise<boolean> => {
        const sourceToAdd = sourceOverride || newSource;
        try {
            setSavingSource(true);

            const r = await fetchWithAuth(`${basePath}/sources`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(sourceToAdd),
            });

            if (!r.ok) throw new Error(await extractError(r));

            const data: ConfigSaveResponse = await r.json();

            // Reload sources
            const refreshR = await fetchWithAuth(`${basePath}/sources`);
            if (refreshR.ok) {
                const refreshedSources: Source[] = await refreshR.json();
                setSources(refreshedSources || []);
            }

            if (!sourceOverride) {
                setNewSource({ name: "", url: "", plex_library: "" });
            }
            setToast({ message: data.message, type: "success" });
            return true;
        } catch (e) {
            setToast({ message: String(e), type: "error" });
            return false;
        } finally {
            setSavingSource(false);
        }
    }, [basePath, newSource]);

    // Update source (e.g., toggle auto_request)
    const updateSource = useCallback(
        async (index: number, source: Source) => {
            try {
                const r = await fetchWithAuth(`${basePath}/sources/${index}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(source),
                });

                if (!r.ok) throw new Error(await extractError(r));

                // Reload sources
                const refreshR = await fetchWithAuth(`${basePath}/sources`);
                if (refreshR.ok) {
                    const refreshedSources: Source[] = await refreshR.json();
                    setSources(refreshedSources || []);
                }
            } catch (e) {
                setToast({ message: String(e), type: "error" });
            }
        },
        [basePath]
    );

    // Remove source
    const removeSource = useCallback(
        async (index: number) => {
            try {
                setDeletingSource(index);

                const r = await fetchWithAuth(`${basePath}/sources/${index}`, {
                    method: "DELETE",
                });

                if (!r.ok) throw new Error(await extractError(r));

                const data: ConfigSaveResponse = await r.json();

                // Reload sources
                const refreshR = await fetchWithAuth(`${basePath}/sources`);
                if (refreshR.ok) {
                    const refreshedSources: Source[] = await refreshR.json();
                    setSources(refreshedSources || []);
                }

                // Clear index-based caches (indices shift after delete)
                setMissingItems(new Map());
                setExpandedMissing(new Set());
                setMissingPages(new Map());
                setStatuses(new Map());

                setToast({ message: data.message, type: "success" });
            } catch (e) {
                setToast({ message: String(e), type: "error" });
            } finally {
                setDeletingSource(null);
            }
        },
        [basePath]
    );

    // Sync source
    const syncSource = useCallback(
        async (index: number) => {
            try {
                setSyncingSource(index);

                const r = await fetchWithAuth(`${basePath}/sources/${index}/sync`, {
                    method: "POST",
                });

                if (!r.ok) throw new Error(await extractError(r));

                const data = await r.json();
                setToast({ message: `Synced ${data.items_matched}/${data.items_total} items`, type: "success" });

                // Refresh statuses
                const statusR = await fetchWithAuth(`${basePath}/sources/status`);
                if (statusR.ok) {
                    const statusData: SourceStatus[] = await statusR.json();
                    const statusMap = new Map<number, SourceStatus>();
                    statusData.forEach((s) => statusMap.set(s.source_index, s));
                    setStatuses(statusMap);
                }

                // Clear missing items cache for this source (may have changed)
                setMissingItems((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(index);
                    return newMap;
                });
            } catch (e) {
                setToast({ message: String(e), type: "error" });
            } finally {
                setSyncingSource(null);
            }
        },
        [basePath]
    );

    // Toggle missing items (always re-fetch when expanding to avoid stale data)
    const toggleMissingItems = useCallback(
        async (index: number) => {
            // If expanded, just collapse
            if (expandedMissing.has(index)) {
                setExpandedMissing((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(index);
                    return newSet;
                });
                return;
            }

            // Fetch fresh missing items and expand
            try {
                setLoadingMissing((prev) => new Set(prev).add(index));

                const r = await fetchWithAuth(`${basePath}/sources/${index}/missing`);
                if (!r.ok) throw new Error(await extractError(r));

                const data: TMissing[] = await r.json();
                setMissingItems((prev) => new Map(prev).set(index, data));
                setExpandedMissing((prev) => new Set(prev).add(index));
            } catch (e) {
                setToast({ message: `Failed to load missing items: ${String(e)}`, type: "error" });
            } finally {
                setLoadingMissing((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(index);
                    return newSet;
                });
            }
        },
        [basePath, expandedMissing]
    );

    // Set missing items page
    const setMissingPage = useCallback((index: number, page: number) => {
        setMissingPages((prev) => new Map(prev).set(index, page));
    }, []);

    return {
        // Settings
        settings,
        setSettings,
        loadingSettings,
        savingSettings,
        saveSettings,

        // Test connection
        testStatus,
        testConnection,

        // Sources
        sources,
        loadingSources,

        // Toast
        toast,
        clearToast,

        // Source mutations
        newSource,
        setNewSource,
        addSource,
        updateSource,
        removeSource,
        syncSource,
        savingSource,
        syncingSource,
        deletingSource,

        // Statuses
        statuses,

        // Missing items
        missingItems,
        expandedMissing,
        missingPages,
        loadingMissing,
        toggleMissingItems,
        setMissingPage,
    };
}
