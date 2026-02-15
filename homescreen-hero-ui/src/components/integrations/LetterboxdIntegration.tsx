import { useState } from "react";
import { ChevronRight, Film } from "lucide-react";
import Toast from "../Toast";
import { SourceList } from "./shared/SourceListManager";
import { LibrarySelect } from "./shared/LibrarySelect";
import { useListIntegration } from "../../hooks/integrations/useListIntegration";
import { usePlexLibraries } from "../../hooks/integrations/usePlexLibraries";
import type { LetterboxdMissingItem } from "../../types/integrations";

// Letterboxd has no settings - just sources
const emptySettings = {};

function formatDate(dateString: string | null): string {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
}

export function LetterboxdIntegration() {
    const [isExpanded, setIsExpanded] = useState(true);
    const { enabledLibraries } = usePlexLibraries();

    const integration = useListIntegration<typeof emptySettings, LetterboxdMissingItem>({
        integrationName: "letterboxd",
        initialSettings: emptySettings,
        hasSettings: false,
    });

    const canAdd = integration.newSource.name && integration.newSource.url && integration.newSource.plex_library;

    return (
        <>
        <div className="space-y-4">
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 overflow-hidden shadow-lg shadow-primary/5">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition"
                >
                    <div className="text-left flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 border border-primary/20 mt-0.5">
                            <Film className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">Letterboxd Lists</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Sync your Letterboxd lists to Plex collections.
                            </p>
                        </div>
                    </div>
                    <ChevronRight
                        className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : ""
                        }`}
                    />
                </button>

                <div
                    className={`grid transition-all duration-300 ease-in-out ${
                        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                >
                    <div className="overflow-hidden">
                        <div className="px-6 pb-6 space-y-4 border-t border-slate-800">
                            <div className="pt-4 space-y-4">
                                {/* Add source form */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="grid gap-3 md:grid-cols-3 flex-1">
                                        <input
                                            type="text"
                                            placeholder="Friendly name"
                                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                            value={integration.newSource.name}
                                            onChange={(e) => integration.setNewSource({ ...integration.newSource, name: e.target.value })}
                                            disabled={integration.savingSource || integration.loadingSources}
                                        />
                                        <input
                                            type="url"
                                            placeholder="https://letterboxd.com/username/list/listname/"
                                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                                            value={integration.newSource.url}
                                            onChange={(e) => integration.setNewSource({ ...integration.newSource, url: e.target.value })}
                                            disabled={integration.savingSource || integration.loadingSources}
                                        />
                                        <LibrarySelect
                                            value={integration.newSource.plex_library}
                                            onChange={(value) => integration.setNewSource({ ...integration.newSource, plex_library: value })}
                                            libraries={enabledLibraries}
                                            disabled={integration.savingSource || integration.loadingSources}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => integration.addSource()}
                                        disabled={integration.savingSource || integration.loadingSources || !canAdd}
                                        className="cursor-pointer rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        {integration.savingSource ? "Adding…" : "Add List"}
                                    </button>
                                </div>

                                {/* Note */}
                                <div className="rounded-lg border border-blue-700/50 bg-blue-900/20 px-4 py-3">
                                    <p className="text-xs text-blue-200">
                                        <strong>Note:</strong> Letterboxd integration uses web scraping since their
                                        API requires approval. Movies are matched by title and year, which may be
                                        less accurate than ID-based matching.
                                    </p>
                                </div>

                                {/* Source list */}
                                <SourceList<LetterboxdMissingItem>
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
                                                <p className="text-xs font-medium text-slate-200 truncate">
                                                    {item.title}
                                                    {item.year ? ` (${item.year})` : ""}
                                                </p>
                                                {item.letterboxd_url && (
                                                    <a
                                                        href={item.letterboxd_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline"
                                                    >
                                                        View on Letterboxd
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
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {integration.toast && (
            <Toast
                message={integration.toast.message}
                type={integration.toast.type}
                onClose={integration.clearToast}
            />
        )}
        </>
    );
}
