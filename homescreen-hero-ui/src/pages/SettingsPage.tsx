import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { Bell, Shield, SlidersHorizontal, Check, ChevronDown } from "lucide-react";
import { Switch, Listbox } from "@headlessui/react";
import FieldRow from "../components/FieldRow";
import FormSection from "../components/FormSection";
import TestConnectionCta from "../components/TestConnectionCta";

const tabs = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "integrations", label: "Integrations", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
] as const;

type TabId = (typeof tabs)[number]["id"];

type PlexLibraryConfig = { name: string; enabled: boolean };
type PlexSettings = { base_url: string; token: string; libraries: PlexLibraryConfig[] };
type AvailableLibrary = { title: string; type: string };
type TraktSettings = { enabled: boolean; client_id: string; base_url: string; sources?: TraktSource[] };
type TraktSource = { name: string; url: string; plex_library: string };
type RotationSettings = {
    enabled: boolean;
    interval_hours: number;
    max_collections: number;
    strategy: string;
    allow_repeats: boolean;
};
type ConfigSaveResponse = { ok: boolean; path: string; message: string; env_override: boolean };
type HealthComponent = { ok: boolean; error?: string | null };

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>("general");
    const [plexTestStatus, setPlexTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [traktTestStatus, setTraktTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
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
    const [traktSettings, setTraktSettings] = useState<TraktSettings>({
        enabled: false,
        client_id: "",
        base_url: "https://api.trakt.tv",
    });
    const [traktSources, setTraktSources] = useState<TraktSource[]>([]);
    const [loadingTrakt, setLoadingTrakt] = useState(true);
    const [loadingTraktSources, setLoadingTraktSources] = useState(true);
    const [savingTrakt, setSavingTrakt] = useState(false);
    const [savingSource, setSavingSource] = useState(false);
    const [deletingSource, setDeletingSource] = useState<number | null>(null);
    const [traktError, setTraktError] = useState<string | null>(null);
    const [traktMessage, setTraktMessage] = useState<string | null>(null);
    const [traktSourcesError, setTraktSourcesError] = useState<string | null>(null);
    const [traktSourcesMessage, setTraktSourcesMessage] = useState<string | null>(null);

    const [newSource, setNewSource] = useState<TraktSource>({
        name: "",
        url: "",
        plex_library: "",
    });

    const tabDescription = useMemo(() => {
        switch (activeTab) {
            case "general":
                return "Control the basics without directly editing the YAML config.";
            case "integrations":
                return "Manage connected services like Plex with credential-safe forms.";
            case "notifications":
                return "Fine-tune how the app keeps you informed.";
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

    const handleTraktTestConnection = async () => {
        try {
            setTraktTestStatus("testing");

            const r = await fetchWithAuth("/api/health/trakt");
            if (!r.ok) {
                throw new Error(await r.text());
            }

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

    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/trakt")
            .then(async (r) => {
                if (!r.ok) {
                    throw new Error(await r.text());
                }
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

    useEffect(() => {
        let isMounted = true;
        fetchWithAuth("/api/admin/config/trakt/sources")
            .then(async (r) => {
                if (!r.ok) {
                    throw new Error(await r.text());
                }
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

            if (!r.ok) {
                throw new Error(await r.text());
            }

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

            if (!r.ok) {
                throw new Error(await r.text());
            }

            await fetchWithAuth("/api/admin/config/trakt/sources")
                .then((resp) => resp.json())
                .then((data: TraktSource[]) => setTraktSources(data || []));

            const data: ConfigSaveResponse = await r.json();
            setTraktSourcesMessage(data.message);
        } catch (e) {
            setTraktSourcesError(String(e));
        } finally {
            setDeletingSource(null);
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

            if (!r.ok) {
                throw new Error(await r.text());
            }

            const data: ConfigSaveResponse = await r.json();
            setTraktMessage(data.message);
        } catch (e) {
            setTraktError(String(e));
        } finally {
            setSavingTrakt(false);
        }
    }

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
                        title="Trakt"
                        description="Keep Trakt lists in sync without hand-editing the config file."
                        actions={
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="hidden sm:inline">Your secrets stay in the browser until saved.</span>
                                <button
                                    type="button"
                                    onClick={saveTraktSettings}
                                    disabled={savingTrakt || loadingTrakt}
                                    className="rounded-lg border border-slate-700 px-3 py-1 font-semibold text-slate-100 transition disabled:opacity-60"
                                >
                                    {savingTrakt ? "Saving…" : "Save Trakt Settings"}
                                </button>
                            </div>
                        }
                    >
                        <FieldRow
                            label="Enable Trakt"
                            description="Toggle syncing Trakt lists to your Plex collections."
                        >
                            <Switch
                                checked={traktSettings.enabled}
                                onChange={() =>
                                    setTraktSettings((prev) => ({
                                        ...prev,
                                        enabled: !prev.enabled,
                                    }))
                                }
                                className="relative inline-flex h-6 w-11 items-center rounded-full transition data-[checked]:bg-primary bg-slate-600"
                            >
                                <span className="inline-block h-5 w-5 transform rounded-full bg-white transition data-[checked]:translate-x-5 translate-x-1" />
                            </Switch>
                        </FieldRow>

                        <FieldRow
                            label="Client ID"
                            description="Found in your Trakt application settings."
                        >
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

                        <FieldRow
                            label="Base URL"
                            description="Override only if you self-host the Trakt API."
                        >
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

                        <TestConnectionCta
                            service="Trakt"
                            status={traktTestStatus}
                            onTest={handleTraktTestConnection}
                            message="Run a dry connection test without restarting the service."
                        />

                        <div className="mt-6 space-y-3 rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-base font-semibold text-slate-100">Trakt lists</p>
                                    <p className="text-xs text-slate-400">Add or remove Trakt list sources that sync into Plex collections.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addTraktSource}
                                    disabled={savingSource || loadingTraktSources}
                                    className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 transition disabled:opacity-60"
                                >
                                    {savingSource ? "Adding…" : "Add list"}
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
                                                <div className="px-3 py-2 text-xs text-slate-500">
                                                    No enabled Plex libraries configured.
                                                </div>
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

                            <div className="space-y-2">
                                {loadingTraktSources ? (
                                    <p className="text-xs text-slate-400">Loading sources…</p>
                                ) : traktSources.length === 0 ? (
                                    <p className="text-xs text-slate-400">No Trakt lists added yet.</p>
                                ) : (
                                    <ul className="divide-y divide-slate-800 border border-slate-800/80 rounded-lg">
                                        {traktSources.map((source, idx) => (
                                            <li key={`${source.name}-${idx}`} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-slate-100">{source.name}</p>
                                                    <p className="text-xs text-slate-400 break-all">{source.url}</p>
                                                    <p className="text-xs text-slate-500">Plex library: {source.plex_library || "(none)"}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeTraktSource(idx)}
                                                    disabled={deletingSource === idx}
                                                    className="self-start rounded-lg border border-rose-800 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/40 disabled:opacity-60"
                                                >
                                                    {deletingSource === idx ? "Removing…" : "Remove"}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

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
        </div>
    );
}