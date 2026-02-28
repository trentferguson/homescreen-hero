import { useState, useCallback } from "react";
import { Listbox, Switch } from "@headlessui/react";
import { Check, ChevronDown, Minus, Plus, Wifi, WifiOff } from "lucide-react";
import FieldRow from "../FieldRow";
import Toast from "../Toast";
import { ConfigPanel } from "./shared/ConfigPanel";
import { SourceList } from "./shared/SourceListManager";
import { LibrarySelect } from "./shared/LibrarySelect";
import { ListTypeSelect } from "./shared/ListTypeSelect";
import type { ListTypeOption } from "./shared/ListTypeSelect";
import { useListIntegration } from "../../hooks/integrations/useListIntegration";
import { usePlexLibraries } from "../../hooks/integrations/usePlexLibraries";
import type { MALSettings, MALMissingItem } from "../../types/integrations";

const initialSettings: MALSettings = {
    enabled: false,
    client_id: "",
};

function formatDate(dateString: string | null): string {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
    tv: "TV",
    ova: "OVA",
    ona: "ONA",
    movie: "Movie",
    special: "Special",
    tv_special: "TV Special",
    music: "Music",
};

const STATUS_OPTIONS: ListTypeOption[] = [
    { value: "watching", label: "Watching" },
    { value: "completed", label: "Completed" },
    { value: "on_hold", label: "On Hold" },
    { value: "dropped", label: "Dropped" },
    { value: "plan_to_watch", label: "Plan to Watch" },
];

const RANKING_OPTIONS: ListTypeOption[] = [
    { value: "all", label: "Top Anime" },
    { value: "airing", label: "Top Airing" },
    { value: "upcoming", label: "Top Upcoming" },
    { value: "bypopularity", label: "Most Popular" },
    { value: "favorite", label: "Most Favorited" },
];

const SEASON_OPTIONS: ListTypeOption[] = [
    { value: "winter", label: "Winter" },
    { value: "spring", label: "Spring" },
    { value: "summer", label: "Summer" },
    { value: "fall", label: "Fall" },
];

// Capitalize first letter
function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function MaxItemsStepper({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
    return (
        <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
            <span className="pl-2.5 text-xs text-slate-500 whitespace-nowrap select-none">Max</span>
            <button
                type="button"
                disabled={disabled || value <= 10}
                onClick={() => onChange(Math.max(10, value - 10))}
                className="flex items-center justify-center h-9 w-8 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <Minus className="h-3.5 w-3.5" />
            </button>
            <input
                type="number"
                min={10}
                max={500}
                step={10}
                value={value}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
                onBlur={() => onChange(Math.max(10, Math.min(500, value || 100)))}
                disabled={disabled}
                className="w-10 text-center text-sm font-semibold text-white tabular-nums bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Max items"
            />
            <button
                type="button"
                disabled={disabled || value >= 500}
                onClick={() => onChange(Math.min(500, value + 10))}
                className="flex items-center justify-center h-9 w-8 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <Plus className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

export function MALIntegration() {
    const { enabledLibraries } = usePlexLibraries();

    const integration = useListIntegration<MALSettings, MALMissingItem>({
        integrationName: "mal",
        initialSettings,
        hasSettings: true,
        healthEndpoint: "/api/health/mal",
    });

    // Mode toggle: user lists vs rankings vs seasonal
    const [mode, setMode] = useState<"user" | "ranking" | "seasonal">("user");

    // User list form state
    const [username, setUsername] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [collectionName, setCollectionName] = useState("");
    const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
    const [plexLibrary, setPlexLibrary] = useState("");

    // Ranking form state
    const [rankingType, setRankingType] = useState("");
    const [rankingCollectionName, setRankingCollectionName] = useState("");
    const [rankingNameManuallyEdited, setRankingNameManuallyEdited] = useState(false);
    const [rankingPlexLibrary, setRankingPlexLibrary] = useState("");
    const [rankingMaxItems, setRankingMaxItems] = useState(100);

    // Seasonal form state
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: currentYear - 2000 + 2 }, (_, i) => currentYear + 1 - i);
    const [seasonYear, setSeasonYear] = useState(currentYear);
    const [season, setSeason] = useState("");
    const [seasonCollectionName, setSeasonCollectionName] = useState("");
    const [seasonNameManuallyEdited, setSeasonNameManuallyEdited] = useState(false);
    const [seasonPlexLibrary, setSeasonPlexLibrary] = useState("");
    const [seasonMaxItems, setSeasonMaxItems] = useState(100);

    // User list handlers
    const handleStatusChange = useCallback(
        (value: string) => {
            setStatusFilter(value);
            if (!nameManuallyEdited) {
                if (!value) {
                    setCollectionName(username.trim() ? `${username.trim()}'s Anime` : "");
                } else {
                    const option = STATUS_OPTIONS.find((o) => o.value === value);
                    setCollectionName(option ? option.label : capitalize(value));
                }
            }
        },
        [nameManuallyEdited, username]
    );

    const canAddUser = username.trim() && collectionName.trim() && plexLibrary;

    const handleAddUser = useCallback(async () => {
        if (!canAddUser) return;

        const trimmedUsername = username.trim();
        const url = `https://myanimelist.net/animelist/${trimmedUsername}${statusFilter ? `?status=${statusFilter}` : ""}`;

        const ok = await integration.addSource({
            name: collectionName.trim(),
            url,
            plex_library: plexLibrary,
        });

        if (ok) {
            setUsername("");
            setStatusFilter("");
            setCollectionName("");
            setNameManuallyEdited(false);
            setPlexLibrary("");
        }
    }, [canAddUser, username, statusFilter, collectionName, plexLibrary, integration]);

    // Ranking handlers
    const handleRankingTypeChange = useCallback(
        (value: string) => {
            setRankingType(value);
            if (!rankingNameManuallyEdited) {
                const option = RANKING_OPTIONS.find((o) => o.value === value);
                setRankingCollectionName(option ? `MAL ${option.label}` : "");
            }
        },
        [rankingNameManuallyEdited]
    );

    const canAddRanking = rankingType && rankingCollectionName.trim() && rankingPlexLibrary;

    const handleAddRanking = useCallback(async () => {
        if (!canAddRanking) return;

        const url = `mal://ranking/${rankingType}`;
        const ok = await integration.addSource({
            name: rankingCollectionName.trim(),
            url,
            plex_library: rankingPlexLibrary,
            max_items: rankingMaxItems,
        });

        if (ok) {
            setRankingType("");
            setRankingCollectionName("");
            setRankingNameManuallyEdited(false);
            setRankingPlexLibrary("");
            setRankingMaxItems(100);
        }
    }, [canAddRanking, rankingType, rankingCollectionName, rankingPlexLibrary, rankingMaxItems, integration]);

    // Seasonal handlers
    const handleSeasonChange = useCallback(
        (value: string) => {
            setSeason(value);
            if (!seasonNameManuallyEdited) {
                setSeasonCollectionName(value ? `MAL ${capitalize(value)} ${seasonYear}` : "");
            }
        },
        [seasonNameManuallyEdited, seasonYear]
    );

    const canAddSeasonal = season && seasonCollectionName.trim() && seasonPlexLibrary;

    const handleAddSeasonal = useCallback(async () => {
        if (!canAddSeasonal) return;

        const url = `mal://season/${seasonYear}/${season}`;
        const ok = await integration.addSource({
            name: seasonCollectionName.trim(),
            url,
            plex_library: seasonPlexLibrary,
            max_items: seasonMaxItems,
        });

        if (ok) {
            setSeason("");
            setSeasonCollectionName("");
            setSeasonNameManuallyEdited(false);
            setSeasonPlexLibrary("");
            setSeasonMaxItems(100);
        }
    }, [canAddSeasonal, season, seasonYear, seasonCollectionName, seasonPlexLibrary, seasonMaxItems, integration]);

    const formDisabled = integration.savingSource || integration.loadingSources;

    return (
        <div className="space-y-4">
            {/* Settings panel */}
            <ConfigPanel
                title="MAL Configuration"
                description="Configure your MyAnimeList API credentials."
            >
                <FieldRow
                    label="Enable MAL"
                    description="Toggle syncing MAL anime lists to your Plex collections."
                >
                    <div className="flex justify-end">
                        <Switch
                            checked={integration.settings.enabled}
                            onChange={() =>
                                integration.setSettings((prev) => ({
                                    ...prev,
                                    enabled: !prev.enabled,
                                }))
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                                integration.settings.enabled ? "bg-primary" : "bg-slate-600"
                            }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                                    integration.settings.enabled ? "translate-x-5" : "translate-x-0.5"
                                }`}
                            />
                        </Switch>
                    </div>
                </FieldRow>

                <FieldRow
                    label="Client ID"
                    description="Found in your MAL API application settings."
                >
                    <input
                        type="password"
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                        value={integration.settings.client_id}
                        onChange={(e) =>
                            integration.setSettings((prev) => ({
                                ...prev,
                                client_id: e.target.value,
                            }))
                        }
                        disabled={integration.loadingSettings}
                    />
                </FieldRow>

                {/* Test connection CTA */}
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 mt-6">
                    <div className="flex items-center gap-3">
                        <span
                            className={`rounded-full p-2 ${
                                integration.testStatus === "success"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : integration.testStatus === "error"
                                      ? "bg-rose-500/15 text-rose-400"
                                      : "bg-amber-500/15 text-amber-400"
                            }`}
                        >
                            {integration.testStatus === "success" ? (
                                <Wifi size={18} />
                            ) : (
                                <WifiOff size={18} />
                            )}
                        </span>
                        <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-white">Test MAL connection</p>
                            <p className="text-xs text-slate-400">
                                Run a dry connection test without restarting the service.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={integration.saveSettings}
                            disabled={integration.savingSettings || integration.loadingSettings}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {integration.savingSettings ? "Saving\u2026" : "Save Settings"}
                        </button>
                        <button
                            type="button"
                            onClick={integration.testConnection}
                            disabled={integration.testStatus === "testing"}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-semibold px-3 py-2 transition disabled:opacity-70"
                        >
                            {integration.testStatus === "testing"
                                ? "Testing\u2026"
                                : integration.testStatus === "success"
                                  ? "Retest"
                                  : "Test connection"}
                        </button>
                    </div>
                </div>
            </ConfigPanel>

            {/* Mode toggle */}
            <div className="flex gap-1 rounded-lg bg-slate-800/50 p-1 w-fit">
                {(["user", "ranking", "seasonal"] as const).map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                            mode === m
                                ? "bg-primary text-white"
                                : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        {m === "user" ? "User Lists" : m === "ranking" ? "Rankings" : "Seasonal"}
                    </button>
                ))}
            </div>

            {/* Add form — user lists */}
            {mode === "user" && (
                <div className="flex gap-2 items-center flex-wrap">
                    <input
                        type="text"
                        placeholder="Username"
                        className="w-46 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={formDisabled}
                    />
                    <ListTypeSelect
                        value={statusFilter}
                        onChange={handleStatusChange}
                        disabled={formDisabled}
                        options={STATUS_OPTIONS}
                    />
                    <LibrarySelect
                        value={plexLibrary}
                        onChange={setPlexLibrary}
                        libraries={enabledLibraries}
                        disabled={formDisabled}
                    />
                    <input
                        type="text"
                        placeholder="Collection name"
                        className="w-80 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                        value={collectionName}
                        onChange={(e) => {
                            setCollectionName(e.target.value);
                            setNameManuallyEdited(true);
                        }}
                        disabled={formDisabled}
                    />
                    <button
                        type="button"
                        onClick={handleAddUser}
                        disabled={formDisabled || !canAddUser}
                        className="shrink-0 cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {integration.savingSource ? "Adding\u2026" : "Add List"}
                    </button>
                </div>
            )}

            {/* Add form — rankings */}
            {mode === "ranking" && (
                <div className="flex gap-2 items-center flex-wrap">
                    <ListTypeSelect
                        value={rankingType}
                        onChange={handleRankingTypeChange}
                        disabled={formDisabled}
                        options={RANKING_OPTIONS}
                        showAllOption={false}
                    />
                    <LibrarySelect
                        value={rankingPlexLibrary}
                        onChange={setRankingPlexLibrary}
                        libraries={enabledLibraries}
                        disabled={formDisabled}
                    />
                    <MaxItemsStepper
                        value={rankingMaxItems}
                        onChange={setRankingMaxItems}
                        disabled={formDisabled}
                    />
                    <input
                        type="text"
                        placeholder="Collection name"
                        className="w-80 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                        value={rankingCollectionName}
                        onChange={(e) => {
                            setRankingCollectionName(e.target.value);
                            setRankingNameManuallyEdited(true);
                        }}
                        disabled={formDisabled}
                    />
                    <button
                        type="button"
                        onClick={handleAddRanking}
                        disabled={formDisabled || !canAddRanking}
                        className="shrink-0 cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {integration.savingSource ? "Adding\u2026" : "Add List"}
                    </button>
                </div>
            )}

            {/* Add form — seasonal */}
            {mode === "seasonal" && (
                <div className="flex gap-2 items-center flex-wrap">
                    <Listbox
                        value={seasonYear}
                        onChange={(yr: number) => {
                            setSeasonYear(yr);
                            if (!seasonNameManuallyEdited && season) {
                                setSeasonCollectionName(`MAL ${capitalize(season)} ${yr}`);
                            }
                        }}
                        disabled={formDisabled}
                    >
                        <div className="relative w-24">
                            <Listbox.Button className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:opacity-60 flex items-center justify-between">
                                <span>{seasonYear}</span>
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                            </Listbox.Button>
                            <Listbox.Options className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg focus:outline-none max-h-48 overflow-auto scrollbar-thin">
                                {yearOptions.map((yr) => (
                                    <Listbox.Option
                                        key={yr}
                                        value={yr}
                                        className="cursor-pointer px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 data-[selected]:bg-primary/20 data-[selected]:font-semibold flex items-center justify-between gap-3"
                                    >
                                        {({ selected: isSelected }) => (
                                            <>
                                                <span>{yr}</span>
                                                {isSelected && <Check className="h-4 w-4 text-primary" />}
                                            </>
                                        )}
                                    </Listbox.Option>
                                ))}
                            </Listbox.Options>
                        </div>
                    </Listbox>
                    <ListTypeSelect
                        value={season}
                        onChange={handleSeasonChange}
                        disabled={formDisabled}
                        options={SEASON_OPTIONS}
                        showAllOption={false}
                    />
                    <LibrarySelect
                        value={seasonPlexLibrary}
                        onChange={setSeasonPlexLibrary}
                        libraries={enabledLibraries}
                        disabled={formDisabled}
                    />
                    <MaxItemsStepper
                        value={seasonMaxItems}
                        onChange={setSeasonMaxItems}
                        disabled={formDisabled}
                    />
                    <input
                        type="text"
                        placeholder="Collection name"
                        className="w-80 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                        value={seasonCollectionName}
                        onChange={(e) => {
                            setSeasonCollectionName(e.target.value);
                            setSeasonNameManuallyEdited(true);
                        }}
                        disabled={formDisabled}
                    />
                    <button
                        type="button"
                        onClick={handleAddSeasonal}
                        disabled={formDisabled || !canAddSeasonal}
                        className="shrink-0 cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {integration.savingSource ? "Adding\u2026" : "Add List"}
                    </button>
                </div>
            )}

            {/* Source list */}
            <SourceList<MALMissingItem>
                sources={integration.sources}
                statuses={integration.statuses}
                onSyncSource={integration.syncSource}
                onRemoveSource={integration.removeSource}
                loadingSources={integration.loadingSources}
                syncingSource={integration.syncingSource}
                deletingSource={integration.deletingSource}
                missingItems={integration.missingItems}
                expandedMissing={integration.expandedMissing}
                missingPages={integration.missingPages}
                loadingMissing={integration.loadingMissing}
                onToggleMissing={integration.toggleMissingItems}
                onSetMissingPage={integration.setMissingPage}
                renderMissingItem={(item, i) => (
                    <div
                        key={i}
                        className="flex items-start justify-between gap-3 rounded-md border border-slate-800/40 bg-slate-950/40 px-3 py-2"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-medium text-slate-200 truncate">
                                    {item.title}
                                    {item.year ? ` (${item.year})` : ""}
                                </p>
                                {item.media_type && (
                                    <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                                        {MEDIA_TYPE_LABELS[item.media_type] ?? item.media_type}
                                    </span>
                                )}
                            </div>
                            {item.mal_id && (
                                <a
                                    href={`https://myanimelist.net/anime/${item.mal_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                >
                                    View on MAL
                                </a>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                            {formatDate(item.last_seen)}
                        </div>
                    </div>
                )}
            />

            {integration.toast && (
                <Toast
                    message={integration.toast.message}
                    type={integration.toast.type}
                    onClose={integration.clearToast}
                />
            )}
        </div>
    );
}
