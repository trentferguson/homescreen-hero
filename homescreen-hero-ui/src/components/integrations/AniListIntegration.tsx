import { useState, useCallback, useRef } from "react";
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

export function AniListIntegration() {
    const { enabledLibraries } = usePlexLibraries();

    const integration = useListIntegration<typeof emptySettings, AniListMissingItem>({
        integrationName: "anilist",
        initialSettings: emptySettings,
        hasSettings: false,
    });

    // Custom form state (username + list type instead of raw URL)
    const [username, setUsername] = useState("");
    const [listType, setListType] = useState("");
    const [collectionName, setCollectionName] = useState("");
    const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
    const [plexLibrary, setPlexLibrary] = useState("");

    // Dynamic list options fetched from AniList
    const [fetchedLists, setFetchedLists] = useState<ListTypeOption[] | undefined>(undefined);
    const [fetchingLists, setFetchingLists] = useState(false);
    const lastFetchedUsername = useRef("");

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

    return (
        <div className="space-y-4">
            {/* Add form */}
            <div className="flex gap-2 items-center flex-wrap">
                <input
                    type="text"
                    placeholder="Username"
                    className="w-46 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={handleUsernameBlur}
                    disabled={integration.savingSource || integration.loadingSources}
                />
                <ListTypeSelect
                    value={listType}
                    onChange={handleListTypeChange}
                    disabled={integration.savingSource || integration.loadingSources}
                    options={fetchedLists}
                    loading={fetchingLists}
                />
                <LibrarySelect
                    value={plexLibrary}
                    onChange={setPlexLibrary}
                    libraries={enabledLibraries}
                    disabled={integration.savingSource || integration.loadingSources}
                />
                <input
                    type="text"
                    placeholder="Collection name"
                    className="w-80 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                    value={collectionName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    disabled={integration.savingSource || integration.loadingSources}
                />
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={integration.savingSource || integration.loadingSources || !canAdd}
                    className="shrink-0 cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {integration.savingSource ? "Adding\u2026" : "Add List"}
                </button>
            </div>

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
