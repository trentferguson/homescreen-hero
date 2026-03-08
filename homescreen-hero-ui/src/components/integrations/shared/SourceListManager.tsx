import { Fragment, type ReactNode } from "react";
import { RefreshCw, ChevronRight, ChevronLeft, ListPlus, Trash2 } from "lucide-react";
import { Switch } from "@headlessui/react";
import type { Source, SourceStatus, BaseMissingItem, PlexLibraryConfig } from "../../../types/integrations";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { LibrarySelect } from "./LibrarySelect";

// Grid column template shared by header and rows
const TABLE_GRID = "md:grid md:grid-cols-[minmax(0,2fr)_140px_150px_180px_80px] md:gap-x-4 md:items-center";

// ─── SourceList (reusable source list without the add form) ─────────────────

export interface SourceListProps<TMissing extends BaseMissingItem> {
    sources: Source[];
    statuses: Map<number, SourceStatus>;
    onSyncSource: (index: number) => void;
    onRemoveSource: (index: number) => void;
    onUpdateSource?: (index: number, source: Source) => void;
    loadingSources: boolean;
    syncingSource: number | null;
    deletingSource: number | null;
    missingItems: Map<number, TMissing[]>;
    expandedMissing: Set<number>;
    missingPages: Map<number, number>;
    loadingMissing: Set<number>;
    onToggleMissing: (index: number) => void;
    onSetMissingPage: (index: number, page: number) => void;
    renderMissingItem: (item: TMissing, index: number) => ReactNode;
    itemsPerPage?: number;
    showAutoRequest?: boolean;
}

export function SourceList<TMissing extends BaseMissingItem>(
    props: SourceListProps<TMissing>
) {
    const {
        sources,
        statuses,
        onSyncSource,
        onRemoveSource,
        onUpdateSource,
        loadingSources,
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
        showAutoRequest = false,
    } = props;

    if (loadingSources) {
        return <p className="text-xs text-slate-400">Loading sources…</p>;
    }

    if (sources.length === 0) {
        return (
            <div className="rounded-lg border border-slate-800/60 overflow-hidden">
                <SourceTableHeader showAutoRequest={showAutoRequest} />
                <div className="px-4 py-6 flex items-center justify-center gap-3">
                    <ListPlus className="h-6 w-6 text-slate-700" />
                    <p className="text-sm text-slate-400">No lists added yet</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-slate-800/60 overflow-hidden">
            <SourceTableHeader showAutoRequest={showAutoRequest} />
            {sources.map((source, idx) => {
                const status = statuses.get(idx);
                const missing = missingItems.get(idx);
                const isExpanded = expandedMissing.has(idx);
                const isLoadingMissing = loadingMissing.has(idx);
                const currentPage = missingPages.get(idx) || 0;

                return (
                    <Fragment key={`${source.name}-${idx}`}>
                        <SourceTableRow
                            source={source}
                            status={status}
                            onSync={() => onSyncSource(idx)}
                            onRemove={() => onRemoveSource(idx)}
                            onUpdate={onUpdateSource ? (s) => onUpdateSource(idx, s) : undefined}
                            isSyncing={syncingSource === idx}
                            isDeleting={deletingSource === idx}
                            isExpanded={isExpanded}
                            isLoadingMissing={isLoadingMissing}
                            onToggleMissing={() => onToggleMissing(idx)}
                            showAutoRequest={showAutoRequest}
                        />
                        {isExpanded && (
                            <ExpandedDetailRow
                                missingItems={missing}
                                isLoadingMissing={isLoadingMissing}
                                currentPage={currentPage}
                                itemsPerPage={itemsPerPage}
                                onSetPage={(page) => onSetMissingPage(idx, page)}
                                renderMissingItem={renderMissingItem}
                            />
                        )}
                    </Fragment>
                );
            })}
        </div>
    );
}

// ─── SourceListManager (add form + SourceList, used by Trakt/Letterboxd/MDBList) ─

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
    onUpdateSource?: (index: number, source: Source) => void;

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

    // Optional note (like Letterboxd's scraping disclaimer)
    note?: ReactNode;

    // Auto-request feature (Seerr)
    showAutoRequest?: boolean;
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
        onUpdateSource,
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
        note,
        showAutoRequest = false,
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
                    className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
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

            {/* Source list */}
            <SourceList
                sources={sources}
                statuses={statuses}
                onSyncSource={onSyncSource}
                onRemoveSource={onRemoveSource}
                onUpdateSource={onUpdateSource}
                loadingSources={loadingSources}
                syncingSource={syncingSource}
                deletingSource={deletingSource}
                missingItems={missingItems}
                expandedMissing={expandedMissing}
                missingPages={missingPages}
                loadingMissing={loadingMissing}
                onToggleMissing={onToggleMissing}
                onSetMissingPage={onSetMissingPage}
                renderMissingItem={renderMissingItem}
                itemsPerPage={itemsPerPage}
                showAutoRequest={showAutoRequest}
            />
        </div>
    );
}

// ─── Table Header ───────────────────────────────────────────────────────────

function SourceTableHeader({ showAutoRequest }: { showAutoRequest: boolean }) {
    return (
        <div className={`hidden ${TABLE_GRID} px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider border-b border-slate-800/60 bg-slate-900/30`}>
            <span>List Name & URL</span>
            <span>Plex Library</span>
            <span>Last Synced</span>
            <span>{showAutoRequest ? "Auto-Request" : "Matched"}</span>
            <span className="text-right">Actions</span>
        </div>
    );
}

// ─── Table Row ──────────────────────────────────────────────────────────────

interface SourceTableRowProps {
    source: Source;
    status: SourceStatus | undefined;
    onSync: () => void;
    onRemove: () => void;
    onUpdate?: (source: Source) => void;
    isSyncing: boolean;
    isDeleting: boolean;
    isExpanded: boolean;
    isLoadingMissing: boolean;
    onToggleMissing: () => void;
    showAutoRequest: boolean;
}

function SourceTableRow(props: SourceTableRowProps) {
    const {
        source,
        status,
        onSync,
        onRemove,
        onUpdate,
        isSyncing,
        isDeleting,
        isExpanded,
        isLoadingMissing,
        onToggleMissing,
        showAutoRequest,
    } = props;

    return (
        <>
            {/* Desktop row */}
            <div className={`hidden ${TABLE_GRID} px-4 py-3 border-b border-slate-800/40 hover:bg-slate-900/30 transition-colors`}>
                {/* List Name & URL */}
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-100 truncate">{source.name}</p>
                        {status && <SyncStatusBadge status={status.sync_status} />}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{source.url}</p>
                </div>

                {/* Plex Library */}
                <span className="text-xs text-slate-300 truncate">{source.plex_library || "(none)"}</span>

                {/* Last Synced */}
                <span className="text-xs text-slate-400">{formatDate(status?.last_sync_time ?? null)}</span>

                {/* Auto-Request / Matched */}
                <AutoRequestCell
                    source={source}
                    status={status}
                    showAutoRequest={showAutoRequest}
                    onUpdate={onUpdate}
                    isExpanded={isExpanded}
                    isLoadingMissing={isLoadingMissing}
                    onToggleMissing={onToggleMissing}
                />

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                    <button
                        type="button"
                        onClick={onSync}
                        disabled={isSyncing}
                        title="Sync now"
                        className="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-primary/10 transition disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={isDeleting}
                        title="Remove list"
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-50"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Mobile row */}
            <div className="md:hidden px-4 py-3 border-b border-slate-800/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">{source.name}</p>
                        {status && <SyncStatusBadge status={status.sync_status} />}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={onSync}
                            disabled={isSyncing}
                            title="Sync now"
                            className="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-primary/10 transition disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={isDeleting}
                            title="Remove list"
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <p className="text-xs text-slate-500 truncate">{source.url}</p>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-slate-400">{source.plex_library || "(none)"}</span>
                    <span className="text-xs text-slate-500">
                        Synced: {formatDate(status?.last_sync_time ?? null)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <AutoRequestCell
                        source={source}
                        status={status}
                        showAutoRequest={showAutoRequest}
                        onUpdate={onUpdate}
                        isExpanded={isExpanded}
                        isLoadingMissing={isLoadingMissing}
                        onToggleMissing={onToggleMissing}
                    />
                </div>
            </div>
        </>
    );
}

// ─── Auto-Request Cell ──────────────────────────────────────────────────────

interface AutoRequestCellProps {
    source: Source;
    status: SourceStatus | undefined;
    showAutoRequest: boolean;
    onUpdate?: (source: Source) => void;
    isExpanded: boolean;
    isLoadingMissing: boolean;
    onToggleMissing: () => void;
}

function AutoRequestCell(props: AutoRequestCellProps) {
    const { source, status, showAutoRequest, onUpdate, isExpanded, isLoadingMissing, onToggleMissing } = props;

    if (!showAutoRequest) {
        // No auto-request: just show the matched chip
        return (
            <MatchedChip
                status={status}
                isExpanded={isExpanded}
                isLoading={isLoadingMissing}
                onClick={onToggleMissing}
            />
        );
    }

    // Auto-request enabled: show toggle + matched chip or "Disabled"
    return (
        <div className="flex items-center gap-2">
            <Switch
                checked={source.auto_request ?? false}
                onChange={() => {
                    if (onUpdate) {
                        onUpdate({ ...source, auto_request: !source.auto_request });
                    }
                }}
                disabled={!onUpdate}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                    source.auto_request ? "bg-primary" : "bg-slate-600"
                } ${!onUpdate ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
                <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        source.auto_request ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                />
            </Switch>
            <MatchedChip
                status={status}
                isExpanded={isExpanded}
                isLoading={isLoadingMissing}
                onClick={onToggleMissing}
            />
        </div>
    );
}

// ─── Matched Chip ───────────────────────────────────────────────────────────

interface MatchedChipProps {
    status: SourceStatus | undefined;
    isExpanded: boolean;
    isLoading: boolean;
    onClick: () => void;
}

function MatchedChip({ status, isExpanded, isLoading, onClick }: MatchedChipProps) {
    if (!status || status.sync_status === "never_synced") {
        return <span className="text-xs text-slate-600">-</span>;
    }

    const allMatched = status.items_matched === status.items_total;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isLoading}
            className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition cursor-pointer ${
                allMatched
                    ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/60"
                    : "bg-amber-900/30 text-amber-300 border border-amber-800/40 hover:bg-amber-900/50"
            } disabled:opacity-50`}
        >
            <ChevronRight
                className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
            />
            {status.items_matched}/{status.items_total} matched
        </button>
    );
}

// ─── Expanded Detail Row ────────────────────────────────────────────────────

interface ExpandedDetailRowProps<TMissing> {
    missingItems: TMissing[] | undefined;
    isLoadingMissing: boolean;
    currentPage: number;
    itemsPerPage: number;
    onSetPage: (page: number) => void;
    renderMissingItem: (item: TMissing, index: number) => ReactNode;
}

function ExpandedDetailRow<TMissing extends BaseMissingItem>(
    props: ExpandedDetailRowProps<TMissing>
) {
    const { missingItems, isLoadingMissing, currentPage, itemsPerPage, onSetPage, renderMissingItem } = props;

    const totalPages = missingItems ? Math.ceil(missingItems.length / itemsPerPage) : 0;
    const paginatedItems =
        missingItems?.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage) || [];

    return (
        <div className="border-b border-slate-800/40 bg-slate-900/20 px-4 py-3">
            {isLoadingMissing ? (
                <p className="text-xs text-slate-400">Loading missing items…</p>
            ) : missingItems && missingItems.length > 0 ? (
                <div className="space-y-2">
                    <p className="text-xs text-slate-400 mb-2">
                        {missingItems.length} {missingItems.length === 1 ? "item" : "items"} not found
                        in Plex
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
                                onClick={() => onSetPage(Math.min(totalPages - 1, currentPage + 1))}
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
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateString: string | null): string {
    if (!dateString) return "Never";
    // Backend stores UTC but without a timezone suffix, so append Z
    const utcString = dateString.endsWith("Z") ? dateString : dateString + "Z";
    return new Date(utcString).toLocaleString();
}
