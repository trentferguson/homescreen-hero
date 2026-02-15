import { Switch } from "@headlessui/react";
import { Wifi, WifiOff } from "lucide-react";
import FieldRow from "../FieldRow";
import Toast from "../Toast";
import { ConfigPanel } from "./shared/ConfigPanel";
import { SourceListManager } from "./shared/SourceListManager";
import { useListIntegration } from "../../hooks/integrations/useListIntegration";
import { usePlexLibraries } from "../../hooks/integrations/usePlexLibraries";
import type { MDBListSettings, MDBListMissingItem } from "../../types/integrations";

const initialSettings: MDBListSettings = {
    enabled: false,
    api_key: "",
    base_url: "https://api.mdblist.com",
};

function formatDate(dateString: string | null): string {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
}

export function MDBListIntegration() {
    const { enabledLibraries } = usePlexLibraries();

    const integration = useListIntegration<MDBListSettings, MDBListMissingItem>({
        integrationName: "mdblist",
        initialSettings,
        hasSettings: true,
        healthEndpoint: "/api/health/mdblist",
    });

    return (
        <div className="space-y-4">
            {/* Configuration */}
            <ConfigPanel
                title="MDBList Configuration"
                description="Configure your MDBList API credentials and settings."
            >
                <FieldRow
                    label="Enable MDBList"
                    description="Toggle syncing MDBList lists to your Plex collections."
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

                <FieldRow label="API Key" description="Found in your MDBList account settings.">
                    <input
                        type="password"
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                        value={integration.settings.api_key}
                        onChange={(e) =>
                            integration.setSettings((prev) => ({
                                ...prev,
                                api_key: e.target.value,
                            }))
                        }
                        disabled={integration.loadingSettings}
                    />
                </FieldRow>

                <FieldRow
                    label="Base URL"
                    description="Override only if you self-host the MDBList API."
                >
                    <input
                        type="url"
                        placeholder="https://api.mdblist.com"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                        value={integration.settings.base_url}
                        onChange={(e) =>
                            integration.setSettings((prev) => ({
                                ...prev,
                                base_url: e.target.value,
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
                            <p className="text-sm font-semibold text-white">
                                Test MDBList connection
                            </p>
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
                            {integration.savingSettings ? "Saving…" : "Save Settings"}
                        </button>
                        <button
                            type="button"
                            onClick={integration.testConnection}
                            disabled={integration.testStatus === "testing"}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-semibold px-3 py-2 transition disabled:opacity-70"
                        >
                            {integration.testStatus === "testing"
                                ? "Testing…"
                                : integration.testStatus === "success"
                                  ? "Retest"
                                  : "Test connection"}
                        </button>
                    </div>
                </div>
            </ConfigPanel>

            {/* Source List */}
            <SourceListManager<MDBListMissingItem>
                title="MDBList Lists"
                description="Add or remove MDBList list sources that sync into Plex collections."
                urlPlaceholder="https://mdblist.com/lists/username/listname"
                sources={integration.sources}
                statuses={integration.statuses}
                libraries={enabledLibraries}
                newSource={integration.newSource}
                onNewSourceChange={integration.setNewSource}
                onAddSource={() => integration.addSource()}
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
                            <div className="flex gap-2 mt-1 text-xs text-slate-500 font-mono flex-wrap">
                                {item.imdb_id && <span>IMDb: {item.imdb_id}</span>}
                                {item.tmdb_id && <span>TMDb: {item.tmdb_id}</span>}
                                {item.trakt_id && <span>Trakt: {item.trakt_id}</span>}
                            </div>
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
