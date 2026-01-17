import type { ReactNode } from "react";
import { RefreshCw, ChevronRight, ChevronLeft } from "lucide-react";
import type { Source, SourceStatus, BaseMissingItem, PlexLibraryConfig } from "../../../types/integrations";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { LibrarySelect } from "./LibrarySelect";

interface SourceListManagerProps<TMissing extends BaseMissingItem> {
    // Header
    title: string;
    description: string;
    urlPlaceholder: string;

    // Data
    sources: Source[];
    statuses: Map<number, SourceStatus>;
    libraries: PlexLibraryConfig[];

    // New source form
    newSource: Source;
    onNewSourceChange: (source: Source) => void;
    onAddSource: () => void;

    // Actions
    onSyncSource: (index: number) => void;
    onRemoveSource: (index: number) => void;

    // Loading states
    loadingSources: boolean;
    savingSource: boolean;
    syncingSource: number | null;
    deletingSource: number | null;

    // Missing items
    missingItems: Map<number, TMissing[]>;
    expandedMissing: Set<number>;
    missingPages: Map<number, number>;
    loadingMissing: Set<number>;
    onToggleMissing: (index: number) => void;
    onSetMissingPage: (index: number, page: number) => void;

    // Missing items render (integration-specific)
    renderMissingItem: (item: TMissing, index: number) => ReactNode;
    itemsPerPage?: number;

    // Messages
    error: string | null;
    message: string | null;

    // Optional note (like Letterboxd's scraping disclaimer)
    note?: ReactNode;
}

function formatDate(dateString: string | null): string {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
}

export function SourceListManager<TMissing extends BaseMissingItem>(
    props: SourceListManagerProps<TMissing>
) {
    const {
        title,
        description,
        urlPlaceholder,
        sources,
        statuses,
        libraries,
        newSource,
        onNewSourceChange,
        onAddSource,
        onSyncSource,
        onRemoveSource,
        loadingSources,
        savingSource,
        syncingSource,
        deletingSource,
        missingItems,
        expandedMissing,
        missingPages,
        loadingMissing,
        onToggleMissing,
        onSetMissingPage,
        renderMissingItem,
        itemsPerPage = 10,
        error,
        message,
        note,
    } = props;

    const canAdd = newSource.name && newSource.url && newSource.plex_library;

    return (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{description}</p>
                </div>
                <button
                    type="button"
                    onClick={onAddSource}
                    disabled={savingSource || loadingSources || !canAdd}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
                >
                    {savingSource ? "Adding…" : "Add List"}
                </button>
            </div>

            {/* Add source form */}
            <div className="grid gap-3 md:grid-cols-3">
                <input
                    type="text"
                    placeholder="Friendly name"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                    value={newSource.name}
                    onChange={(e) => onNewSourceChange({ ...newSource, name: e.target.value })}
                    disabled={savingSource || loadingSources}
                />
                <input
                    type="url"
                    placeholder={urlPlaceholder}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                    value={newSource.url}
                    onChange={(e) => onNewSourceChange({ ...newSource, url: e.target.value })}
                    disabled={savingSource || loadingSources}
                />
                <LibrarySelect
                    value={newSource.plex_library}
                    onChange={(value) => onNewSourceChange({ ...newSource, plex_library: value })}
                    libraries={libraries}
                    disabled={savingSource || loadingSources}
                />
            </div>

            {/* Optional note */}
            {note}

            {/* Messages */}
            {message && (
                <div className="rounded-lg border border-emerald-700 bg-emerald-900/50 px-3 py-2 text-xs text-emerald-100">
                    {message}
                </div>
            )}
            {error && (
                <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                    {error}
                </div>
            )}

            {/* Source list */}
            <div className="space-y-3">
                {loadingSources ? (
                    <p className="text-xs text-slate-400">Loading sources…</p>
                ) : sources.length === 0 ? (
                    <p className="text-xs text-slate-400">
                        No lists added yet. Use the form above to add your first list.
                    </p>
                ) : (
                    sources.map((source, idx) => {
                        const status = statuses.get(idx);
                        const missing = missingItems.get(idx);
                        const isExpanded = expandedMissing.has(idx);
                        const isLoadingMissing = loadingMissing.has(idx);
                        const currentPage = missingPages.get(idx) || 0;

                        return (
                            <SourceCard
                                key={`${source.name}-${idx}`}
                                source={source}
                                status={status}
                                onSync={() => onSyncSource(idx)}
                                onRemove={() => onRemoveSource(idx)}
                                isSyncing={syncingSource === idx}
                                isDeleting={deletingSource === idx}
                                missingItems={missing}
                                isExpanded={isExpanded}
                                isLoadingMissing={isLoadingMissing}
                                currentPage={currentPage}
                                itemsPerPage={itemsPerPage}
                                onToggleMissing={() => onToggleMissing(idx)}
                                onSetPage={(page) => onSetMissingPage(idx, page)}
                                renderMissingItem={renderMissingItem}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
}

// Internal SourceCard component
interface SourceCardProps<TMissing> {
    source: Source;
    status: SourceStatus | undefined;
    onSync: () => void;
    onRemove: () => void;
    isSyncing: boolean;
    isDeleting: boolean;
    missingItems: TMissing[] | undefined;
    isExpanded: boolean;
    isLoadingMissing: boolean;
    currentPage: number;
    itemsPerPage: number;
    onToggleMissing: () => void;
    onSetPage: (page: number) => void;
    renderMissingItem: (item: TMissing, index: number) => ReactNode;
}

function SourceCard<TMissing extends BaseMissingItem>(props: SourceCardProps<TMissing>) {
    const {
        source,
        status,
        onSync,
        onRemove,
        isSyncing,
        isDeleting,
        missingItems,
        isExpanded,
        isLoadingMissing,
        currentPage,
        itemsPerPage,
        onToggleMissing,
        onSetPage,
        renderMissingItem,
    } = props;

    const totalPages = missingItems ? Math.ceil(missingItems.length / itemsPerPage) : 0;
    const paginatedItems =
        missingItems?.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage) || [];

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 overflow-hidden">
            <div className="p-4 space-y-3">
                {/* Source info and actions */}
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-100">{source.name}</p>
                            {status && <SyncStatusBadge status={status.sync_status} />}
                        </div>
                        <p className="text-xs text-slate-400 break-all">{source.url}</p>
                        <p className="text-xs text-slate-500">
                            Plex library: {source.plex_library || "(none)"}
                        </p>
                        {status?.last_sync_time && (
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
                            onClick={onSync}
                            disabled={isSyncing}
                            className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60 flex items-center gap-1"
                        >
                            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                            {isSyncing ? "Syncing…" : "Sync Now"}
                        </button>
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={isDeleting}
                            className="rounded-lg border border-rose-800 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/40 disabled:opacity-60"
                        >
                            {isDeleting ? "Removing…" : "Remove"}
                        </button>
                    </div>
                </div>

                {/* Missing items section */}
                <div className="pt-3 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onToggleMissing}
                        disabled={isLoadingMissing}
                        className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-slate-100 transition disabled:opacity-50"
                    >
                        <ChevronRight
                            className={`h-4 w-4 transition-transform duration-200 ${
                                isExpanded ? "rotate-90" : ""
                            }`}
                        />
                        Missing items
                    </button>

                    {isExpanded && (
                        <div className="mt-2 rounded-lg border border-slate-800/60 bg-slate-900/30 p-3">
                            {isLoadingMissing ? (
                                <p className="text-xs text-slate-400">Loading missing items…</p>
                            ) : missingItems && missingItems.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-400 mb-2">
                                        {missingItems.length}{" "}
                                        {missingItems.length === 1 ? "item" : "items"} not found in
                                        Plex
                                    </p>
                                    <div className="space-y-1.5">
                                        {paginatedItems.map((item, i) => renderMissingItem(item, i))}
                                    </div>
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => onSetPage(Math.max(0, currentPage - 1))}
                                                disabled={currentPage === 0}
                                                className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                aria-label="Previous page"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <span className="text-xs text-slate-400">
                                                Page {currentPage + 1} of {totalPages}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onSetPage(Math.min(totalPages - 1, currentPage + 1))
                                                }
                                                disabled={currentPage >= totalPages - 1}
                                                className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                aria-label="Next page"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-emerald-400">All items found in Plex!</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
