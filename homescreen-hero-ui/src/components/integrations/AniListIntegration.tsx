import { useState, useCallback, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { SourceList } from "./shared/SourceListManager";
import { LibrarySelect } from "./shared/LibrarySelect";
import { ListTypeSelect } from "./shared/ListTypeSelect";
import type { ListTypeOption } from "./shared/ListTypeSelect";
import { useListIntegration } from "../../hooks/integrations/useListIntegration";
import { usePlexLibraries } from "../../hooks/integrations/usePlexLibraries";
import { fetchWithAuth } from "../../utils/api";
import type { AniListMissingItem } from "../../types/integrations";

const emptySettings = {};

function formatDate(dateString: string | null): string {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
}

const FORMAT_LABELS: Record<string, string> = {
    TV: "TV",
    TV_SHORT: "Short",
    MOVIE: "Movie",
    SPECIAL: "Special",
    OVA: "OVA",
    ONA: "ONA",
};

// Capitalize first letter for auto-generated collection name
function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

const BROWSE_LIST_OPTIONS: ListTypeOption[] = [
    { value: "trending", label: "Trending" },
    { value: "popular", label: "Popular" },
    { value: "top-100", label: "Top 100" },
    { value: "most-favorited", label: "Most Favorited" },
    { value: "this-season", label: "This Season" },
    { value: "next-season", label: "Next Season" },
];

export function AniListIntegration() {
    const { enabledLibraries } = usePlexLibraries();

    const integration = useListIntegration<typeof emptySettings, AniListMissingItem>({
        integrationName: "anilist",
        initialSettings: emptySettings,
        hasSettings: false,
    });

    // Mode toggle: user lists vs browse lists
    const [mode, setMode] = useState<"user" | "browse">("user");

    // User list form state
    const [username, setUsername] = useState("");
    const [listType, setListType] = useState("");
    const [collectionName, setCollectionName] = useState("");
    const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
    const [plexLibrary, setPlexLibrary] = useState("");

    // Dynamic list options fetched from AniList
    const [fetchedLists, setFetchedLists] = useState<ListTypeOption[] | undefined>(undefined);
    const [fetchingLists, setFetchingLists] = useState(false);
    const lastFetchedUsername = useRef("");

    // Browse list form state
    const [browseSort, setBrowseSort] = useState("");
    const [browseCollectionName, setBrowseCollectionName] = useState("");
    const [browseNameManuallyEdited, setBrowseNameManuallyEdited] = useState(false);
    const [browsePlexLibrary, setBrowsePlexLibrary] = useState("");
    const [browseMaxItems, setBrowseMaxItems] = useState(100);

    const fetchUserLists = useCallback(async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === lastFetchedUsername.current) return;

        lastFetchedUsername.current = trimmed;
        setFetchingLists(true);
        try {
            const r = await fetchWithAuth(
                `/api/admin/config/anilist/user-lists?username=${encodeURIComponent(trimmed)}`
            );
            if (r.ok) {
                const data = await r.json();
                setFetchedLists(data.lists || []);
            } else {
                // On error, clear dynamic lists (falls back to defaults)
                setFetchedLists(undefined);
            }
        } catch {
            setFetchedLists(undefined);
        } finally {
            setFetchingLists(false);
        }
    }, []);

    const handleUsernameBlur = useCallback(() => {
        fetchUserLists(username);
    }, [username, fetchUserLists]);

    const handleListTypeChange = useCallback(
        (value: string) => {
            setListType(value);
            // Auto-fill collection name from the selected label
            if (!nameManuallyEdited) {
                if (!value) {
                    setCollectionName("");
                } else {
                    // Find the label from fetched or default options
                    const option = fetchedLists?.find((o) => o.value === value);
                    setCollectionName(option ? option.label : capitalize(value));
                }
            }
        },
        [nameManuallyEdited, fetchedLists]
    );

    const handleNameChange = useCallback((value: string) => {
        setCollectionName(value);
        setNameManuallyEdited(true);
    }, []);

    const canAdd = username.trim() && collectionName.trim() && plexLibrary;

    const handleAdd = useCallback(async () => {
        if (!canAdd) return;

        const trimmedUsername = username.trim();
        const url = listType
            ? `https://anilist.co/user/${trimmedUsername}/animelist/${encodeURIComponent(listType)}`
            : `https://anilist.co/user/${trimmedUsername}/animelist`;

        await integration.addSource({
            name: collectionName.trim(),
            url,
            plex_library: plexLibrary,
        });

        // Reset form on success
        setUsername("");
        setListType("");
        setCollectionName("");
        setNameManuallyEdited(false);
        setPlexLibrary("");
        setFetchedLists(undefined);
        lastFetchedUsername.current = "";
    }, [canAdd, username, listType, collectionName, plexLibrary, integration]);

    // Browse list handlers
    const handleBrowseSortChange = useCallback(
        (value: string) => {
            setBrowseSort(value);
            if (!browseNameManuallyEdited) {
                const option = BROWSE_LIST_OPTIONS.find((o) => o.value === value);
                setBrowseCollectionName(option ? `AniList ${option.label}` : "");
            }
        },
        [browseNameManuallyEdited]
    );

    const canAddBrowse = browseSort && browseCollectionName.trim() && browsePlexLibrary;

    const handleAddBrowse = useCallback(async () => {
        if (!canAddBrowse) return;

        const url = `anilist://browse/${browseSort}`;
        await integration.addSource({
            name: browseCollectionName.trim(),
            url,
            plex_library: browsePlexLibrary,
            max_items: browseMaxItems,
        });

        // Reset form
        setBrowseSort("");
        setBrowseCollectionName("");
        setBrowseNameManuallyEdited(false);
        setBrowsePlexLibrary("");
        setBrowseMaxItems(100);
    }, [canAddBrowse, browseSort, browseCollectionName, browsePlexLibrary, browseMaxItems, integration]);

    const formDisabled = integration.savingSource || integration.loadingSources;

    return (
        <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-1 rounded-lg bg-slate-800/50 p-1 w-fit">
                <button
                    type="button"
                    onClick={() => setMode("user")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                        mode === "user"
                            ? "bg-primary text-white"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    User Lists
                </button>
                <button
                    type="button"
                    onClick={() => setMode("browse")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                        mode === "browse"
                            ? "bg-primary text-white"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    Public Lists
                </button>
            </div>

            {/* Add form — user lists */}
            {mode === "user" ? (
                <div className="flex gap-2 items-center flex-wrap">
                    <input
                        type="text"
                        placeholder="Username"
                        className="w-46 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onBlur={handleUsernameBlur}
                        disabled={formDisabled}
                    />
                    <ListTypeSelect
                        value={listType}
                        onChange={handleListTypeChange}
                        disabled={formDisabled}
                        options={fetchedLists}
                        loading={fetchingLists}
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
                        onChange={(e) => handleNameChange(e.target.value)}
                        disabled={formDisabled}
                    />
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={formDisabled || !canAdd}
                        className="shrink-0 cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {integration.savingSource ? "Adding\u2026" : "Add List"}
                    </button>
                </div>
            ) : (
                /* Add form — browse lists */
                <div className="flex gap-2 items-center flex-wrap">
                    <ListTypeSelect
                        value={browseSort}
                        onChange={handleBrowseSortChange}
                        disabled={formDisabled}
                        options={BROWSE_LIST_OPTIONS}
                        showAllOption={false}
                    />
                    <LibrarySelect
                        value={browsePlexLibrary}
                        onChange={setBrowsePlexLibrary}
                        libraries={enabledLibraries}
                        disabled={formDisabled}
                    />
                    <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
                        <span className="pl-2.5 text-xs text-slate-500 whitespace-nowrap select-none">Max</span>
                        <button
                            type="button"
                            disabled={formDisabled || browseMaxItems <= 10}
                            onClick={() => setBrowseMaxItems((v) => Math.max(10, v - 10))}
                            className="flex items-center justify-center h-9 w-8 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                            type="number"
                            min={10}
                            max={500}
                            step={10}
                            value={browseMaxItems}
                            onChange={(e) => setBrowseMaxItems(Number(e.target.value) || 0)}
                            onBlur={() => {
                                setBrowseMaxItems((v) => Math.max(10, Math.min(500, v || 100)));
                            }}
                            disabled={formDisabled}
                            className="w-10 text-center text-sm font-semibold text-white tabular-nums bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="Max items"
                        />
                        <button
                            type="button"
                            disabled={formDisabled || browseMaxItems >= 500}
                            onClick={() => setBrowseMaxItems((v) => Math.min(500, v + 10))}
                            className="flex items-center justify-center h-9 w-8 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="Collection name"
                        className="w-80 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                        value={browseCollectionName}
                        onChange={(e) => {
                            setBrowseCollectionName(e.target.value);
                            setBrowseNameManuallyEdited(true);
                        }}
                        disabled={formDisabled}
                    />
                    <button
                        type="button"
                        onClick={handleAddBrowse}
                        disabled={formDisabled || !canAddBrowse}
                        className="shrink-0 cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {integration.savingSource ? "Adding\u2026" : "Add List"}
                    </button>
                </div>
            )}

            {/* Info note */}
            <div className="rounded-lg border border-blue-700/50 bg-blue-900/20 px-4 py-3">
                <p className="text-xs text-blue-200">
                    <strong>Note:</strong> AniList items are matched to Plex using the{" "}
                    <a
                        href="https://github.com/Fribb/anime-lists"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-100"
                    >
                        anime-lists
                    </a>{" "}
                    ID mapping database, with a fallback to title/year matching. Point your
                    source at a show library for anime series, or a movie library for anime
                    films.
                </p>
            </div>

            {/* Messages */}
            {integration.sourcesMessage && (
                <div className="rounded-lg border border-emerald-700 bg-emerald-900/50 px-3 py-2 text-xs text-emerald-100">
                    {integration.sourcesMessage}
                </div>
            )}
            {integration.sourcesError && (
                <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                    {integration.sourcesError}
                </div>
            )}

            {/* Source list */}
            <SourceList<AniListMissingItem>
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
                                {item.media_format && (
                                    <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                                        {FORMAT_LABELS[item.media_format] ?? item.media_format}
                                    </span>
                                )}
                            </div>
                            {item.anilist_id && (
                                <a
                                    href={`https://anilist.co/anime/${item.anilist_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                >
                                    View on AniList
                                </a>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                            {formatDate(item.last_seen)}
                        </div>
                    </div>
                )}
            />
        </div>
    );
}
