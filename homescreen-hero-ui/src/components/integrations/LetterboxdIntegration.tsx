import { SourceListManager } from "./shared/SourceListManager";
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
    const { enabledLibraries } = usePlexLibraries();

    const integration = useListIntegration<typeof emptySettings, LetterboxdMissingItem>({
        integrationName: "letterboxd",
        initialSettings: emptySettings,
        hasSettings: false,
    });

    return (
        <SourceListManager<LetterboxdMissingItem>
            title="Letterboxd Lists"
            description="Add or remove Letterboxd list sources that sync into Plex collections."
            urlPlaceholder="https://letterboxd.com/username/list/listname/"
            sources={integration.sources}
            statuses={integration.statuses}
            libraries={enabledLibraries}
            newSource={integration.newSource}
            onNewSourceChange={integration.setNewSource}
            onAddSource={integration.addSource}
            onSyncSource={integration.syncSource}
            onRemoveSource={integration.removeSource}
            loadingSources={integration.loadingSources}
            savingSource={integration.savingSource}
            syncingSource={integration.syncingSource}
            deletingSource={integration.deletingSource}
            missingItems={integration.missingItems}
            expandedMissing={integration.expandedMissing}
            missingPages={integration.missingPages}
            loadingMissing={integration.loadingMissing}
            onToggleMissing={integration.toggleMissingItems}
            onSetMissingPage={integration.setMissingPage}
            error={integration.sourcesError}
            message={integration.sourcesMessage}
            note={
                <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3">
                    <p className="text-xs text-amber-200">
                        <strong>Note:</strong> Letterboxd integration uses web scraping since their
                        API requires approval. Movies are matched by title and year, which may be
                        less accurate than ID-based matching.
                    </p>
                </div>
            }
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
    );
}
