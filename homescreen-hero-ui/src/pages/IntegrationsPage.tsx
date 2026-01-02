import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { Switch, Listbox, Tab } from "@headlessui/react";
import { Check, ChevronDown, RefreshCw, ChevronRight, Wifi, WifiOff, ChevronLeft } from "lucide-react";
import FieldRow from "../components/FieldRow";
import FormSection from "../components/FormSection";
import TestConnectionCta from "../components/TestConnectionCta";

type PlexLibraryConfig = { name: string; enabled: boolean };
type PlexSettings = { base_url: string; token: string; libraries: PlexLibraryConfig[] };
type TraktSettings = { enabled: boolean; client_id: string; base_url: string; sources?: TraktSource[] };
type TraktSource = { name: string; url: string; plex_library: string };
type TraktSourceStatus = {
    source_index: number;
    name: string;
    last_sync_time: string | null;
    sync_status: "success" | "error" | "pending" | "never_synced";
    error_message: string | null;
    items_matched: number;
    items_total: number;
};
type TraktMissingItem = {
    title: string;
    year: number | null;
    trakt_id: number | null;
    slug: string | null;
    imdb_id: string | null;
    tmdb_id: number | null;
    first_seen: string;
    last_seen: string;
    times_seen: number;
};
type LetterboxdSettings = { enabled: boolean; sources?: LetterboxdSource[] };
type LetterboxdSource = { name: string; url: string; plex_library: string };
type LetterboxdSourceStatus = {
    source_index: number;
    name: string;
    last_sync_time: string | null;
    sync_status: "success" | "error" | "pending" | "never_synced";
    error_message: string | null;
    items_matched: number;
    items_total: number;
};
type LetterboxdMissingItem = {
    title: string;
    year: number | null;
    slug: string;
    letterboxd_url: string | null;
    first_seen: string;
    last_seen: string;
    times_seen: number;
};
type ConfigSaveResponse = { ok: boolean; path: string; message: string; env_override: boolean };
type HealthComponent = { ok: boolean; error?: string | null };

export default function IntegrationsPage() {
    const [traktTestStatus, setTraktTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [isConfigExpanded, setIsConfigExpanded] = useState(false);

    // Trakt settings state
    const [traktSettings, setTraktSettings] = useState<TraktSettings>({
        enabled: false,
        client_id: "",
        base_url: "https://api.trakt.tv",
    });
    const [traktSources, setTraktSources] = useState<TraktSource[]>([]);
    const [traktStatuses, setTraktStatuses] = useState<Map<number, TraktSourceStatus>>(new Map());
    const [traktMissingItems, setTraktMissingItems] = useState<Map<number, TraktMissingItem[]>>(new Map());
    const [expandedMissingItems, setExpandedMissingItems] = useState<Set<number>>(new Set());
    const [missingItemsPage, setMissingItemsPage] = useState<Map<number, number>>(new Map()); // source index -> current page

    const [loadingTrakt, setLoadingTrakt] = useState(true);
    const [loadingTraktSources, setLoadingTraktSources] = useState(true);
    const [loadingStatuses, setLoadingStatuses] = useState(false);
    const [savingTrakt, setSavingTrakt] = useState(false);
    const [savingSource, setSavingSource] = useState(false);
    const [syncingSource, setSyncingSource] = useState<number | null>(null);
    const [deletingSource, setDeletingSource] = useState<number | null>(null);
    const [loadingMissing, setLoadingMissing] = useState<Set<number>>(new Set());

    const [traktError, setTraktError] = useState<string | null>(null);
    const [traktMessage, setTraktMessage] = useState<string | null>(null);
    const [traktSourcesError, setTraktSourcesError] = useState<string | null>(null);
    const [traktSourcesMessage, setTraktSourcesMessage] = useState<string | null>(null);

    // Letterboxd settings state
    const [letterboxdSettings, setLetterboxdSettings] = useState<LetterboxdSettings>({
        enabled: false,
    });
    const [letterboxdSources, setLetterboxdSources] = useState<LetterboxdSource[]>([]);
    const [letterboxdStatuses, setLetterboxdStatuses] = useState<Map<number, LetterboxdSourceStatus>>(new Map());
    const [letterboxdMissingItems, setLetterboxdMissingItems] = useState<Map<number, LetterboxdMissingItem[]>>(new Map());
    const [expandedLetterboxdMissingItems, setExpandedLetterboxdMissingItems] = useState<Set<number>>(new Set());
    const [letterboxdMissingItemsPage, setLetterboxdMissingItemsPage] = useState<Map<number, number>>(new Map());

    const [loadingLetterboxd, setLoadingLetterboxd] = useState(true);
    const [loadingLetterboxdSources, setLoadingLetterboxdSources] = useState(true);
    const [loadingLetterboxdStatuses, setLoadingLetterboxdStatuses] = useState(false);
    const [savingLetterboxd, setSavingLetterboxd] = useState(false);
    const [savingLetterboxdSource, setSavingLetterboxdSource] = useState(false);
    const [syncingLetterboxdSource, setSyncingLetterboxdSource] = useState<number | null>(null);
    const [deletingLetterboxdSource, setDeletingLetterboxdSource] = useState<number | null>(null);
    const [loadingLetterboxdMissing, setLoadingLetterboxdMissing] = useState<Set<number>>(new Set());

    const [letterboxdError, setLetterboxdError] = useState<string | null>(null);
    const [letterboxdMessage, setLetterboxdMessage] = useState<string | null>(null);
    const [letterboxdSourcesError, setLetterboxdSourcesError] = useState<string | null>(null);
    const [letterboxdSourcesMessage, setLetterboxdSourcesMessage] = useState<string | null>(null);

    const [plexSettings, setPlexSettings] = useState<PlexSettings>({
        base_url: "",
        token: "",
        libraries: [],
    });

    const [newSource, setNewSource] = useState<TraktSource>({
        name: "",
        url: "",
        plex_library: "",
    });

    const [newLetterboxdSource, setNewLetterboxdSource] = useState<LetterboxdSource>({
        name: "",
        url: "",
        plex_library: "",
    });

    // Load Plex settings to populate library dropdown
    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/plex")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: PlexSettings) => {
                if (!isMounted) return;
                setPlexSettings(data);
            })
            .catch(() => {
                // Silently fail, not critical for this page
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Load Trakt settings
    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/trakt")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: TraktSettings | null) => {
                if (!isMounted) return;
                if (!data) return;
                setTraktSettings({
                    enabled: data.enabled ?? false,
                    client_id: data.client_id ?? "",
                    base_url: data.base_url || "https://api.trakt.tv",
                    sources: data.sources ?? [],
                });
            })
            .catch((e) => {
                if (!isMounted) return;
                setTraktError(String(e));
            })
            .finally(() => {
                if (!isMounted) return;
                setLoadingTrakt(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Load Trakt sources
    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/trakt/sources")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: TraktSource[]) => {
                if (!isMounted) return;
                setTraktSources(data || []);
            })
            .catch((e) => {
                if (!isMounted) return;
                setTraktSourcesError(String(e));
            })
            .finally(() => {
                if (!isMounted) return;
                setLoadingTraktSources(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Load Trakt sources sync status
    useEffect(() => {
        if (loadingTraktSources || traktSources.length === 0) return;

        let isMounted = true;
        setLoadingStatuses(true);

        fetchWithAuth("/api/admin/config/trakt/sources/status")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: TraktSourceStatus[]) => {
                if (!isMounted) return;
                const statusMap = new Map<number, TraktSourceStatus>();
                data.forEach((status) => {
                    statusMap.set(status.source_index, status);
                });
                setTraktStatuses(statusMap);
            })
            .catch(() => {
                // Silently fail, statuses are optional
            })
            .finally(() => {
                if (!isMounted) return;
                setLoadingStatuses(false);
            });

        return () => {
            isMounted = false;
        };
    }, [loadingTraktSources, traktSources.length]);

    // Load Letterboxd settings
    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/letterboxd")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: LetterboxdSettings | null) => {
                if (!isMounted) return;
                if (!data) return;
                setLetterboxdSettings({
                    enabled: data.enabled ?? false,
                    sources: data.sources ?? [],
                });
            })
            .catch((e) => {
                if (!isMounted) return;
                setLetterboxdError(String(e));
            })
            .finally(() => {
                if (!isMounted) return;
                setLoadingLetterboxd(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Load Letterboxd sources
    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/letterboxd/sources")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: LetterboxdSource[]) => {
                if (!isMounted) return;
                setLetterboxdSources(data || []);
            })
            .catch((e) => {
                if (!isMounted) return;
                setLetterboxdSourcesError(String(e));
            })
            .finally(() => {
                if (!isMounted) return;
                setLoadingLetterboxdSources(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Load Letterboxd sources sync status
    useEffect(() => {
        if (loadingLetterboxdSources || letterboxdSources.length === 0) return;

        let isMounted = true;
        setLoadingLetterboxdStatuses(true);

        fetchWithAuth("/api/admin/config/letterboxd/sources/status")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: LetterboxdSourceStatus[]) => {
                if (!isMounted) return;
                const statusMap = new Map<number, LetterboxdSourceStatus>();
                data.forEach((status) => {
                    statusMap.set(status.source_index, status);
                });
                setLetterboxdStatuses(statusMap);
            })
            .catch(() => {
                // Silently fail, statuses are optional
            })
            .finally(() => {
                if (!isMounted) return;
                setLoadingLetterboxdStatuses(false);
            });

        return () => {
            isMounted = false;
        };
    }, [loadingLetterboxdSources, letterboxdSources.length]);

    const handleTraktTestConnection = async () => {
        try {
            setTraktTestStatus("testing");

            const r = await fetchWithAuth("/api/health/trakt");
            if (!r.ok) throw new Error(await r.text());

            const data: HealthComponent = await r.json();
            const ok = data?.ok === true;

            if (ok) {
                setTraktError(null);
                setTraktTestStatus("success");
            } else {
                setTraktTestStatus("error");
                setTraktError(data?.error || "Trakt API health check failed.");
            }
        } catch (e) {
            setTraktTestStatus("error");
            setTraktError(String(e));
        }
    };

    async function saveTraktSettings() {
        try {
            setSavingTrakt(true);
            setTraktError(null);
            setTraktMessage(null);

            const r = await fetchWithAuth("/api/admin/config/trakt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(traktSettings),
            });

            if (!r.ok) throw new Error(await r.text());

            const data: ConfigSaveResponse = await r.json();
            setTraktMessage(data.message);
        } catch (e) {
            setTraktError(String(e));
        } finally {
            setSavingTrakt(false);
        }
    }

    async function addTraktSource() {
        try {
            setSavingSource(true);
            setTraktSourcesError(null);
            setTraktSourcesMessage(null);

            const r = await fetchWithAuth("/api/admin/config/trakt/sources", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSource),
            });

            if (!r.ok) throw new Error(await r.text());

            await fetchWithAuth("/api/admin/config/trakt/sources")
                .then((resp) => resp.json())
                .then((data: TraktSource[]) => setTraktSources(data || []));

            setNewSource({ name: "", url: "", plex_library: "" });
            const data: ConfigSaveResponse = await r.json();
            setTraktSourcesMessage(data.message);
        } catch (e) {
            setTraktSourcesError(String(e));
        } finally {
            setSavingSource(false);
        }
    }

    async function removeTraktSource(index: number) {
        try {
            setDeletingSource(index);
            setTraktSourcesError(null);
            setTraktSourcesMessage(null);

            const r = await fetchWithAuth(`/api/admin/config/trakt/sources/${index}`, {
                method: "DELETE",
            });

            if (!r.ok) throw new Error(await r.text());

            await fetchWithAuth("/api/admin/config/trakt/sources")
                .then((resp) => resp.json())
                .then((data: TraktSource[]) => setTraktSources(data || []));

            // Clear all index-based caches since indices have shifted after deletion
            setTraktMissingItems(new Map());
            setExpandedMissingItems(new Set());
            setMissingItemsPage(new Map());
            setTraktStatuses(new Map());

            const data: ConfigSaveResponse = await r.json();
            setTraktSourcesMessage(data.message);
        } catch (e) {
            setTraktSourcesError(String(e));
        } finally {
            setDeletingSource(null);
        }
    }

    async function syncTraktSource(index: number) {
        try {
            setSyncingSource(index);
            setTraktSourcesError(null);
            setTraktSourcesMessage(null);

            const r = await fetchWithAuth(`/api/admin/config/trakt/sources/${index}/sync`, {
                method: "POST",
            });

            if (!r.ok) throw new Error(await r.text());

            const data = await r.json();
            setTraktSourcesMessage(`Synced ${data.items_matched}/${data.items_total} items`);

            // Refresh statuses after sync
            const statusR = await fetchWithAuth("/api/admin/config/trakt/sources/status");
            if (statusR.ok) {
                const statuses: TraktSourceStatus[] = await statusR.json();
                const statusMap = new Map<number, TraktSourceStatus>();
                statuses.forEach((status) => {
                    statusMap.set(status.source_index, status);
                });
                setTraktStatuses(statusMap);
            }

            // Clear missing items cache for this source so it reloads
            setTraktMissingItems((prev) => {
                const newMap = new Map(prev);
                newMap.delete(index);
                return newMap;
            });
        } catch (e) {
            setTraktSourcesError(String(e));
        } finally {
            setSyncingSource(null);
        }
    }

    async function loadMissingItems(index: number) {
        if (traktMissingItems.has(index)) {
            // Toggle collapse if already loaded
            setExpandedMissingItems((prev) => {
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

        try {
            setLoadingMissing((prev) => new Set(prev).add(index));

            const r = await fetchWithAuth(`/api/admin/config/trakt/sources/${index}/missing`);
            if (!r.ok) throw new Error(await r.text());

            const data: TraktMissingItem[] = await r.json();
            setTraktMissingItems((prev) => new Map(prev).set(index, data));
            setExpandedMissingItems((prev) => new Set(prev).add(index));
        } catch (e) {
            setTraktSourcesError(`Failed to load missing items: ${String(e)}`);
        } finally {
            setLoadingMissing((prev) => {
                const newSet = new Set(prev);
                newSet.delete(index);
                return newSet;
            });
        }
    }

    async function syncLetterboxdSource(index: number) {
        try {
            setSyncingLetterboxdSource(index);
            setLetterboxdSourcesError(null);
            setLetterboxdSourcesMessage(null);

            const r = await fetchWithAuth(`/api/admin/config/letterboxd/sources/${index}/sync`, {
                method: "POST",
            });

            if (!r.ok) throw new Error(await r.text());

            const data = await r.json();
            setLetterboxdSourcesMessage(`Synced ${data.items_matched}/${data.items_total} items`);

            // Refresh statuses after sync
            const statusR = await fetchWithAuth("/api/admin/config/letterboxd/sources/status");
            if (statusR.ok) {
                const statuses: LetterboxdSourceStatus[] = await statusR.json();
                const statusMap = new Map<number, LetterboxdSourceStatus>();
                statuses.forEach((status) => {
                    statusMap.set(status.source_index, status);
                });
                setLetterboxdStatuses(statusMap);
            }

            // Clear missing items cache for this source so it reloads
            setLetterboxdMissingItems((prev) => {
                const newMap = new Map(prev);
                newMap.delete(index);
                return newMap;
            });
        } catch (e) {
            setLetterboxdSourcesError(String(e));
        } finally {
            setSyncingLetterboxdSource(null);
        }
    }

    async function loadLetterboxdMissingItems(index: number) {
        if (letterboxdMissingItems.has(index)) {
            // Toggle collapse if already loaded
            setExpandedLetterboxdMissingItems((prev) => {
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

        try {
            setLoadingLetterboxdMissing((prev) => new Set(prev).add(index));

            const r = await fetchWithAuth(`/api/admin/config/letterboxd/sources/${index}/missing`);
            if (!r.ok) throw new Error(await r.text());

            const data: LetterboxdMissingItem[] = await r.json();
            setLetterboxdMissingItems((prev) => new Map(prev).set(index, data));
            setExpandedLetterboxdMissingItems((prev) => new Set(prev).add(index));
        } catch (e) {
            setLetterboxdSourcesError(`Failed to load missing items: ${String(e)}`);
        } finally {
            setLoadingLetterboxdMissing((prev) => {
                const newSet = new Set(prev);
                newSet.delete(index);
                return newSet;
            });
        }
    }

    function getSyncStatusBadge(status: TraktSourceStatus) {
        switch (status.sync_status) {
            case "success":
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/50 px-2 py-1 text-xs font-medium text-emerald-100 border border-emerald-700">
                        Success
                    </span>
                );
            case "error":
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-900/50 px-2 py-1 text-xs font-medium text-rose-100 border border-rose-700">
                        Error
                    </span>
                );
            case "pending":
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-900/50 px-2 py-1 text-xs font-medium text-amber-100 border border-amber-700">
                        Pending
                    </span>
                );
            case "never_synced":
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/50 px-2 py-1 text-xs font-medium text-slate-300 border border-slate-700">
                        last_sync_tbd
                    </span>
                );
        }
    }

    function getLetterboxdSyncStatusBadge(status: LetterboxdSourceStatus) {
        switch (status.sync_status) {
            case "success":
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/50 px-2 py-1 text-xs font-medium text-emerald-100 border border-emerald-700">
                        Success
                    </span>
                );
            case "error":
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-900/50 px-2 py-1 text-xs font-medium text-rose-100 border border-rose-700">
                        Error
                    </span>
                );
            case "pending":
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-900/50 px-2 py-1 text-xs font-medium text-amber-100 border border-amber-700">
                        Pending
                    </span>
                );
            case "never_synced":
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/50 px-2 py-1 text-xs font-medium text-slate-300 border border-slate-700">
                        last_sync_tbd
                    </span>
                );
        }
    }

    function formatDate(dateString: string | null) {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Integrations</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Manage third-party service integrations for automated list syncing and content discovery.
                </p>
            </div>

            <Tab.Group>
                <Tab.List className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800">
                    <Tab className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition data-[selected]:bg-primary data-[selected]:text-white data-[selected]:border-primary border-slate-800/60 bg-slate-900/60 text-slate-200 hover:border-slate-700 focus:outline-none">
                        Trakt
                    </Tab>
                    <Tab className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition data-[selected]:bg-primary data-[selected]:text-white data-[selected]:border-primary border-slate-800/60 bg-slate-900/60 text-slate-200 hover:border-slate-700 focus:outline-none">
                        Letterboxd
                    </Tab>
                    <Tab
                        disabled
                        className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition border-slate-800/60 bg-slate-900/30 text-slate-500 cursor-not-allowed"
                    >
                        IMDb
                        <span className="text-xs opacity-60">(Coming Soon)</span>
                    </Tab>
                    <Tab
                        disabled
                        className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition border-slate-800/60 bg-slate-900/30 text-slate-500 cursor-not-allowed"
                    >
                        Overseerr
                        <span className="text-xs opacity-60">(Coming Soon)</span>
                    </Tab>
                </Tab.List>

                <Tab.Panels>
                    {/* Trakt Tab */}
                    <Tab.Panel className="space-y-4 focus:outline-none">
                        {/* Trakt Configuration - Collapsible */}
                        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 overflow-hidden shadow-lg shadow-primary/5">
                            <button
                                type="button"
                                onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition"
                            >
                                <div className="text-left flex items-start gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2 border border-primary/20 mt-0.5">
                                        <Wifi className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-100">Trakt Configuration</h3>
                                        <p className="text-xs text-slate-400 mt-1">Configure your Trakt API credentials and settings.</p>
                                    </div>
                                </div>
                                <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${isConfigExpanded ? "rotate-90" : ""}`} />
                            </button>

                            <div
                                className={`grid transition-all duration-300 ease-in-out ${
                                    isConfigExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                }`}
                            >
                                <div className="overflow-hidden">
                                    <div className="px-6 pb-6 space-y-4 border-t border-slate-800">
                                        <div className="pt-4">
                                        <FieldRow label="Enable Trakt" description="Toggle syncing Trakt lists to your Plex collections.">
                                            <div className="flex justify-end">
                                                <Switch
                                                    checked={traktSettings.enabled}
                                                    onChange={() =>
                                                        setTraktSettings((prev) => ({
                                                            ...prev,
                                                            enabled: !prev.enabled,
                                                        }))
                                                    }
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                                                        traktSettings.enabled ? "bg-primary" : "bg-slate-600"
                                                    }`}
                                                >
                                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                                                        traktSettings.enabled ? "translate-x-5" : "translate-x-0.5"
                                                    }`} />
                                                </Switch>
                                            </div>
                                        </FieldRow>

                                        <FieldRow label="Client ID" description="Found in your Trakt application settings.">
                                            <input
                                                type="text"
                                                placeholder="Trakt client ID"
                                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                                value={traktSettings.client_id}
                                                onChange={(e) =>
                                                    setTraktSettings((prev) => ({
                                                        ...prev,
                                                        client_id: e.target.value,
                                                    }))
                                                }
                                                disabled={loadingTrakt}
                                            />
                                        </FieldRow>

                                        <FieldRow label="Base URL" description="Override only if you self-host the Trakt API.">
                                            <input
                                                type="url"
                                                placeholder="https://api.trakt.tv"
                                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                                value={traktSettings.base_url}
                                                onChange={(e) =>
                                                    setTraktSettings((prev) => ({
                                                        ...prev,
                                                        base_url: e.target.value,
                                                    }))
                                                }
                                                disabled={loadingTrakt}
                                            />
                                        </FieldRow>

                                        {traktMessage ? (
                                            <div className="rounded-lg border border-emerald-700 bg-emerald-900/50 px-3 py-2 text-xs text-emerald-100">
                                                {traktMessage}
                                            </div>
                                        ) : null}

                                        {traktError ? (
                                            <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                                                {traktError}
                                            </div>
                                        ) : null}

                                        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 mt-6">
                                            <div className="flex items-center gap-3">
                                                <span className={`rounded-full p-2 ${
                                                    traktTestStatus === "success"
                                                        ? "bg-emerald-500/15 text-emerald-400"
                                                        : traktTestStatus === "error"
                                                        ? "bg-rose-500/15 text-rose-400"
                                                        : "bg-amber-500/15 text-amber-400"
                                                }`}>
                                                    {traktTestStatus === "success" ? (
                                                        <Wifi size={18} />
                                                    ) : (
                                                        <WifiOff size={18} />
                                                    )}
                                                </span>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-semibold text-white">Test Trakt connection</p>
                                                    <p className="text-xs text-slate-400">
                                                        Run a dry connection test without restarting the service.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={saveTraktSettings}
                                                    disabled={savingTrakt || loadingTrakt}
                                                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
                                                >
                                                    {savingTrakt ? "Saving…" : "Save Settings"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleTraktTestConnection}
                                                    disabled={traktTestStatus === "testing"}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-semibold px-3 py-2 transition disabled:opacity-70"
                                                >
                                                    {traktTestStatus === "testing" ? "Testing…" : traktTestStatus === "success" ? "Retest" : "Test connection"}
                                                </button>
                                            </div>
                                        </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Trakt Lists Management */}
                        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-100">Trakt Lists</h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Add or remove Trakt list sources that sync into Plex collections.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addTraktSource}
                                    disabled={savingSource || loadingTraktSources || !newSource.name || !newSource.url || !newSource.plex_library}
                                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {savingSource ? "Adding…" : "Add List"}
                                </button>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <input
                                    type="text"
                                    placeholder="Friendly name"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                    value={newSource.name}
                                    onChange={(e) => setNewSource((prev) => ({ ...prev, name: e.target.value }))}
                                    disabled={savingSource || loadingTraktSources}
                                />
                                <input
                                    type="url"
                                    placeholder="https://trakt.tv/users/you/lists/favorites"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                    value={newSource.url}
                                    onChange={(e) => setNewSource((prev) => ({ ...prev, url: e.target.value }))}
                                    disabled={savingSource || loadingTraktSources}
                                />
                                <Listbox
                                    value={newSource.plex_library}
                                    onChange={(value) => setNewSource((prev) => ({ ...prev, plex_library: value }))}
                                    disabled={savingSource || loadingTraktSources}
                                >
                                    <div className="relative">
                                        <Listbox.Button className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:opacity-60 flex items-center justify-between">
                                            <span className={newSource.plex_library ? "text-slate-100" : "text-slate-500"}>
                                                {newSource.plex_library || "Select Plex library"}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-slate-400" />
                                        </Listbox.Button>
                                        <Listbox.Options className="absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg focus:outline-none max-h-60 overflow-auto">
                                            {plexSettings.libraries.filter((lib) => lib.enabled).length === 0 ? (
                                                <div className="px-3 py-2 text-xs text-slate-500">No enabled Plex libraries configured.</div>
                                            ) : (
                                                plexSettings.libraries
                                                    .filter((lib) => lib.enabled)
                                                    .map((lib) => (
                                                        <Listbox.Option
                                                            key={lib.name}
                                                            value={lib.name}
                                                            className="cursor-pointer px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 data-[selected]:bg-primary/20 data-[selected]:font-semibold flex items-center justify-between"
                                                        >
                                                            {({ selected }) => (
                                                                <>
                                                                    <span>{lib.name}</span>
                                                                    {selected && <Check className="h-4 w-4 text-primary" />}
                                                                </>
                                                            )}
                                                        </Listbox.Option>
                                                    ))
                                            )}
                                        </Listbox.Options>
                                    </div>
                                </Listbox>
                            </div>

                            {traktSourcesMessage ? (
                                <div className="rounded-lg border border-emerald-700 bg-emerald-900/50 px-3 py-2 text-xs text-emerald-100">
                                    {traktSourcesMessage}
                                </div>
                            ) : null}

                            {traktSourcesError ? (
                                <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                                    {traktSourcesError}
                                </div>
                            ) : null}

                            <div className="space-y-3">
                                {loadingTraktSources ? (
                                    <p className="text-xs text-slate-400">Loading sources…</p>
                                ) : traktSources.length === 0 ? (
                                    <p className="text-xs text-slate-400">No Trakt lists added yet.</p>
                                ) : (
                                    traktSources.map((source, idx) => {
                                        const status = traktStatuses.get(idx);
                                        const missingItems = traktMissingItems.get(idx);
                                        const isExpanded = expandedMissingItems.has(idx);
                                        const isLoadingMissing = loadingMissing.has(idx);

                                        return (
                                            <div key={`${source.name}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/50 overflow-hidden">
                                                <div className="p-4 space-y-3">
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div className="space-y-1 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-semibold text-slate-100">{source.name}</p>
                                                                {status && getSyncStatusBadge(status)}
                                                            </div>
                                                            <p className="text-xs text-slate-400 break-all">{source.url}</p>
                                                            <p className="text-xs text-slate-500">
                                                                Plex library: {source.plex_library || "(none)"}
                                                            </p>
                                                            {status && status.last_sync_time && (
                                                                <p className="text-xs text-slate-500">
                                                                    Last synced: {formatDate(status.last_sync_time)}
                                                                </p>
                                                            )}
                                                            {status && status.sync_status !== "never_synced" && (
                                                                <p className="text-xs text-slate-500">
                                                                    Matched {status.items_matched} of {status.items_total} items
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-2 flex-wrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => syncTraktSource(idx)}
                                                                disabled={syncingSource === idx}
                                                                className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60 flex items-center gap-1"
                                                            >
                                                                <RefreshCw className={`h-3 w-3 ${syncingSource === idx ? "animate-spin" : ""}`} />
                                                                {syncingSource === idx ? "Syncing…" : "Sync Now"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeTraktSource(idx)}
                                                                disabled={deletingSource === idx}
                                                                className="rounded-lg border border-rose-800 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/40 disabled:opacity-60"
                                                            >
                                                                {deletingSource === idx ? "Removing…" : "Remove"}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Missing Items Section */}
                                                    <div className="pt-3 border-t border-slate-800">
                                                        <button
                                                            type="button"
                                                            onClick={() => loadMissingItems(idx)}
                                                            disabled={isLoadingMissing}
                                                            className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-slate-100 transition disabled:opacity-50"
                                                        >
                                                            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                                                            Missing items
                                                        </button>

                                                        <div
                                                            className={`grid transition-all duration-300 ease-in-out ${
                                                                isExpanded && missingItems ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                                            }`}
                                                        >
                                                            <div className="overflow-hidden">
                                                                {missingItems && (() => {
                                                                    const ITEMS_PER_PAGE = 15;
                                                                    const currentPage = missingItemsPage.get(idx) || 0;
                                                                    const totalPages = Math.ceil(missingItems.length / ITEMS_PER_PAGE);
                                                                    const startIndex = currentPage * ITEMS_PER_PAGE;
                                                                    const endIndex = startIndex + ITEMS_PER_PAGE;
                                                                    const paginatedItems = missingItems.slice(startIndex, endIndex);

                                                                    return (
                                                                        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden">
                                                                            {missingItems.length === 0 ? (
                                                                                <p className="px-3 py-2 text-xs text-slate-400">
                                                                                    No missing items. All movies from this list were found in Plex!
                                                                                </p>
                                                                            ) : (
                                                                                <>
                                                                                    <div className="overflow-x-auto">
                                                                                        <table className="w-full text-xs">
                                                                                            <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-800">
                                                                                                <tr>
                                                                                                    <th className="px-3 py-2 text-left font-semibold">Title</th>
                                                                                                    <th className="px-3 py-2 text-left font-semibold">Year</th>
                                                                                                    <th className="px-3 py-2 text-left font-semibold">TMDB ID</th>
                                                                                                    <th className="px-3 py-2 text-left font-semibold">Last Seen</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody className="divide-y divide-slate-800">
                                                                                                {paginatedItems.map((item, itemIdx) => (
                                                                                                    <tr key={itemIdx} className="hover:bg-slate-900/30">
                                                                                                        <td className="px-3 py-2 text-slate-100">{item.title}</td>
                                                                                                        <td className="px-3 py-2 text-slate-300">{item.year || "—"}</td>
                                                                                                        <td className="px-3 py-2 text-slate-300 font-mono">{item.tmdb_id || "—"}</td>
                                                                                                        <td className="px-3 py-2 text-slate-400">{formatDate(item.last_seen)}</td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>

                                                                                    {totalPages > 1 && (
                                                                                        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800 bg-slate-900/30">
                                                                                            <p className="text-xs text-slate-400">
                                                                                                Showing {startIndex + 1}-{Math.min(endIndex, missingItems.length)} of {missingItems.length}
                                                                                            </p>
                                                                                            <div className="flex items-center gap-2">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        setMissingItemsPage(prev => {
                                                                                                            const newMap = new Map(prev);
                                                                                                            newMap.set(idx, Math.max(0, currentPage - 1));
                                                                                                            return newMap;
                                                                                                        });
                                                                                                    }}
                                                                                                    disabled={currentPage === 0}
                                                                                                    className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition"
                                                                                                    aria-label="Previous page"
                                                                                                >
                                                                                                    <ChevronLeft size={16} />
                                                                                                </button>
                                                                                                <span className="text-xs text-slate-400">
                                                                                                    Page {currentPage + 1} of {totalPages}
                                                                                                </span>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        setMissingItemsPage(prev => {
                                                                                                            const newMap = new Map(prev);
                                                                                                            newMap.set(idx, Math.min(totalPages - 1, currentPage + 1));
                                                                                                            return newMap;
                                                                                                        });
                                                                                                    }}
                                                                                                    disabled={currentPage >= totalPages - 1}
                                                                                                    className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition"
                                                                                                    aria-label="Next page"
                                                                                                >
                                                                                                    <ChevronRight size={16} />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </Tab.Panel>

                    {/* Letterboxd Tab */}
                    <Tab.Panel className="space-y-4 focus:outline-none">
                        {/* Letterboxd Lists Management */}
                        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-100">Letterboxd Lists</h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Letterboxd list sources that sync into Plex collections. No API key required - uses web scraping.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3">
                                <p className="text-xs text-amber-200">
                                    <strong>Note:</strong> Letterboxd integration uses web scraping since their API requires approval.
                                    Movies are matched by title and year, which may be less accurate than ID-based matching.
                                    Add sources via config.yaml, then sync them here.
                                </p>
                            </div>

                            {letterboxdSourcesMessage ? (
                                <div className="rounded-lg border border-emerald-700 bg-emerald-900/50 px-3 py-2 text-xs text-emerald-100">
                                    {letterboxdSourcesMessage}
                                </div>
                            ) : null}

                            {letterboxdSourcesError ? (
                                <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                                    {letterboxdSourcesError}
                                </div>
                            ) : null}

                            <div className="space-y-3">
                                {loadingLetterboxdSources ? (
                                    <p className="text-xs text-slate-400">Loading sources…</p>
                                ) : letterboxdSources.length === 0 ? (
                                    <p className="text-xs text-slate-400">No Letterboxd lists configured yet. Add them via config.yaml.</p>
                                ) : (
                                    letterboxdSources.map((source, idx) => {
                                        const status = letterboxdStatuses.get(idx);
                                        const missingItems = letterboxdMissingItems.get(idx);
                                        const isExpanded = expandedLetterboxdMissingItems.has(idx);
                                        const isLoadingMissing = loadingLetterboxdMissing.has(idx);

                                        return (
                                            <div key={`${source.name}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/50 overflow-hidden">
                                                <div className="p-4 space-y-3">
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div className="space-y-1 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-semibold text-slate-100">{source.name}</p>
                                                                {status && getLetterboxdSyncStatusBadge(status)}
                                                            </div>
                                                            <p className="text-xs text-slate-400 break-all">{source.url}</p>
                                                            <p className="text-xs text-slate-500">
                                                                Plex library: {source.plex_library || "(none)"}
                                                            </p>
                                                            {status && status.last_sync_time && (
                                                                <p className="text-xs text-slate-500">
                                                                    Last synced: {formatDate(status.last_sync_time)}
                                                                </p>
                                                            )}
                                                            {status && status.sync_status !== "never_synced" && (
                                                                <p className="text-xs text-slate-500">
                                                                    Matched {status.items_matched} of {status.items_total} items
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-2 flex-wrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => syncLetterboxdSource(idx)}
                                                                disabled={syncingLetterboxdSource === idx}
                                                                className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60 flex items-center gap-1"
                                                            >
                                                                <RefreshCw className={`h-3 w-3 ${syncingLetterboxdSource === idx ? "animate-spin" : ""}`} />
                                                                {syncingLetterboxdSource === idx ? "Syncing…" : "Sync Now"}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Missing Items Section */}
                                                    <div className="pt-3 border-t border-slate-800">
                                                        <button
                                                            type="button"
                                                            onClick={() => loadLetterboxdMissingItems(idx)}
                                                            disabled={isLoadingMissing}
                                                            className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-slate-100 transition disabled:opacity-50"
                                                        >
                                                            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                                                            Missing items
                                                        </button>

                                                        {isExpanded && (
                                                            <div className="mt-2 rounded-lg border border-slate-800/60 bg-slate-900/30 p-3">
                                                                {isLoadingMissing ? (
                                                                    <p className="text-xs text-slate-400">Loading missing items…</p>
                                                                ) : missingItems && missingItems.length > 0 ? (
                                                                    (() => {
                                                                        const itemsPerPage = 10;
                                                                        const currentPage = letterboxdMissingItemsPage.get(idx) || 0;
                                                                        const totalPages = Math.ceil(missingItems.length / itemsPerPage);
                                                                        const start = currentPage * itemsPerPage;
                                                                        const end = start + itemsPerPage;
                                                                        const paginatedItems = missingItems.slice(start, end);

                                                                        return (
                                                                            <div className="space-y-2">
                                                                                <div className="flex items-center justify-between mb-2">
                                                                                    <p className="text-xs text-slate-400">
                                                                                        {missingItems.length} {missingItems.length === 1 ? "item" : "items"} not found in Plex
                                                                                    </p>
                                                                                </div>
                                                                                <div className="space-y-1.5">
                                                                                    {paginatedItems.map((item, i) => (
                                                                                        <div
                                                                                            key={`${item.slug}-${i}`}
                                                                                            className="flex items-start justify-between gap-3 rounded-md border border-slate-800/40 bg-slate-950/40 px-3 py-2"
                                                                                        >
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <p className="text-xs font-medium text-slate-200 truncate">
                                                                                                    {item.title}
                                                                                                    {item.year ? ` (${item.year})` : ""}
                                                                                                </p>
                                                                                                {item.letterboxd_url && (
                                                                                                    <a
                                                                                                        href={item.letterboxd_url}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="text-xs text-primary/80 hover:text-primary underline truncate block"
                                                                                                    >
                                                                                                        View on Letterboxd →
                                                                                                    </a>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
                                                                                                <span>Seen {item.times_seen}x</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                {totalPages > 1 && (
                                                                                    <div className="flex items-center justify-center gap-3 pt-2">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setLetterboxdMissingItemsPage(prev => {
                                                                                                    const newMap = new Map(prev);
                                                                                                    newMap.set(idx, Math.max(0, currentPage - 1));
                                                                                                    return newMap;
                                                                                                });
                                                                                            }}
                                                                                            disabled={currentPage === 0}
                                                                                            className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition"
                                                                                            aria-label="Previous page"
                                                                                        >
                                                                                            <ChevronLeft size={16} />
                                                                                        </button>
                                                                                        <span className="text-xs text-slate-400">
                                                                                            Page {currentPage + 1} of {totalPages}
                                                                                        </span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setLetterboxdMissingItemsPage(prev => {
                                                                                                    const newMap = new Map(prev);
                                                                                                    newMap.set(idx, Math.min(totalPages - 1, currentPage + 1));
                                                                                                    return newMap;
                                                                                                });
                                                                                            }}
                                                                                            disabled={currentPage >= totalPages - 1}
                                                                                            className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition"
                                                                                            aria-label="Next page"
                                                                                        >
                                                                                            <ChevronRight size={16} />
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()
                                                                ) : (
                                                                    <p className="text-xs text-emerald-400">All items found in Plex!</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </Tab.Panel>

                    {/* Future: Overseerr Tab */}
                    <Tab.Panel className="space-y-4 focus:outline-none">
                        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6">
                            <p className="text-sm text-slate-400">Overseerr integration coming soon...</p>
                        </div>
                    </Tab.Panel>
                </Tab.Panels>
            </Tab.Group>
        </div>
    );
}
