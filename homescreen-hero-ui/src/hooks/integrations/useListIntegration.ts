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
    settingsError: string | null;
    settingsMessage: string | null;
    saveSettings: () => Promise<void>;
    clearSettingsMessages: () => void;

    // Test connection
    testStatus: TestStatus;
    testConnection: () => Promise<void>;

    // Sources
    sources: Source[];
    loadingSources: boolean;
    sourcesError: string | null;
    sourcesMessage: string | null;
    clearSourcesMessages: () => void;

    // Source mutations
    newSource: Source;
    setNewSource: React.Dispatch<React.SetStateAction<Source>>;
    addSource: () => Promise<void>;
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
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

    // Test connection state
    const [testStatus, setTestStatus] = useState<TestStatus>("idle");

    // Sources state
    const [sources, setSources] = useState<Source[]>([]);
    const [loadingSources, setLoadingSources] = useState(true);
    const [sourcesError, setSourcesError] = useState<string | null>(null);
    const [sourcesMessage, setSourcesMessage] = useState<string | null>(null);

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
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: TSettings | null) => {
                if (!isMounted || !data) return;
                setSettings(data);
            })
            .catch((e) => {
                if (isMounted) setSettingsError(String(e));
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
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: Source[]) => {
                if (isMounted) setSources(data || []);
            })
            .catch((e) => {
                if (isMounted) setSourcesError(String(e));
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
                if (!r.ok) throw new Error(await r.text());
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

    // Clear messages helpers
    const clearSettingsMessages = useCallback(() => {
        setSettingsError(null);
        setSettingsMessage(null);
    }, []);

    const clearSourcesMessages = useCallback(() => {
        setSourcesError(null);
        setSourcesMessage(null);
    }, []);

    // Save settings
    const saveSettings = useCallback(async () => {
        if (!hasSettings) return;

        try {
            setSavingSettings(true);
            setSettingsError(null);
            setSettingsMessage(null);

            const r = await fetchWithAuth(basePath, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (!r.ok) throw new Error(await r.text());

            const data: ConfigSaveResponse = await r.json();
            setSettingsMessage(data.message);
        } catch (e) {
            setSettingsError(String(e));
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
            if (!r.ok) throw new Error(await r.text());

            const data: HealthComponent = await r.json();

            if (data?.ok === true) {
                setSettingsError(null);
                setTestStatus("success");
            } else {
                setTestStatus("error");
                setSettingsError(data?.error || `${integrationName} API health check failed.`);
            }
        } catch (e) {
            setTestStatus("error");
            setSettingsError(String(e));
        }
    }, [healthEndpoint, integrationName]);

    // Add source
    const addSource = useCallback(async () => {
        try {
            setSavingSource(true);
            setSourcesError(null);
            setSourcesMessage(null);

            const r = await fetchWithAuth(`${basePath}/sources`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSource),
            });

            if (!r.ok) throw new Error(await r.text());

            const data: ConfigSaveResponse = await r.json();

            // Reload sources
            const refreshR = await fetchWithAuth(`${basePath}/sources`);
            if (refreshR.ok) {
                const refreshedSources: Source[] = await refreshR.json();
                setSources(refreshedSources || []);
            }

            setNewSource({ name: "", url: "", plex_library: "" });
            setSourcesMessage(data.message);
        } catch (e) {
            setSourcesError(String(e));
        } finally {
            setSavingSource(false);
        }
    }, [basePath, newSource]);

    // Remove source
    const removeSource = useCallback(
        async (index: number) => {
            try {
                setDeletingSource(index);
                setSourcesError(null);
                setSourcesMessage(null);

                const r = await fetchWithAuth(`${basePath}/sources/${index}`, {
                    method: "DELETE",
                });

                if (!r.ok) throw new Error(await r.text());

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

                setSourcesMessage(data.message);
            } catch (e) {
                setSourcesError(String(e));
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
                setSourcesError(null);
                setSourcesMessage(null);

                const r = await fetchWithAuth(`${basePath}/sources/${index}/sync`, {
                    method: "POST",
                });

                if (!r.ok) throw new Error(await r.text());

                const data = await r.json();
                setSourcesMessage(`Synced ${data.items_matched}/${data.items_total} items`);

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
                setSourcesError(String(e));
            } finally {
                setSyncingSource(null);
            }
        },
        [basePath]
    );

    // Toggle missing items (load if needed, then expand/collapse)
    const toggleMissingItems = useCallback(
        async (index: number) => {
            // If already loaded, just toggle visibility
            if (missingItems.has(index)) {
                setExpandedMissing((prev) => {
                    const newSet = new Set(prev);
                    if (newSet.has(index)) {
                        newSet.delete(index);
                    } else {
                        newSet.add(index);
                    }
                    return newSet;
                });
                return;
            }

            // Load missing items
            try {
                setLoadingMissing((prev) => new Set(prev).add(index));

                const r = await fetchWithAuth(`${basePath}/sources/${index}/missing`);
                if (!r.ok) throw new Error(await r.text());

                const data: TMissing[] = await r.json();
                setMissingItems((prev) => new Map(prev).set(index, data));
                setExpandedMissing((prev) => new Set(prev).add(index));
            } catch (e) {
                setSourcesError(`Failed to load missing items: ${String(e)}`);
            } finally {
                setLoadingMissing((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(index);
                    return newSet;
                });
            }
        },
        [basePath, missingItems]
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
        settingsError,
        settingsMessage,
        saveSettings,
        clearSettingsMessages,

        // Test connection
        testStatus,
        testConnection,

        // Sources
        sources,
        loadingSources,
        sourcesError,
        sourcesMessage,
        clearSourcesMessages,

        // Source mutations
        newSource,
        setNewSource,
        addSource,
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
