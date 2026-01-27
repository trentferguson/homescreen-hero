import { Switch } from "@headlessui/react";
import { Wifi, WifiOff } from "lucide-react";
import FieldRow from "../FieldRow";
import { ConfigPanel } from "./shared/ConfigPanel";
import { useTautulliConfig } from "../../hooks/integrations/useTautulliConfig";

export function TautulliIntegration() {
    const config = useTautulliConfig();

    return (
        <ConfigPanel
            title="Tautulli Configuration"
            description="Configure your Tautulli API credentials and analytics settings."
            defaultExpanded
        >
            <FieldRow
                label="Enable Tautulli"
                description="Toggle analytics collection from Tautulli."
            >
                <div className="flex justify-end">
                    <Switch
                        checked={config.settings.enabled}
                        onChange={() =>
                            config.setSettings((prev) => ({
                                ...prev,
                                enabled: !prev.enabled,
                            }))
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                            config.settings.enabled ? "bg-primary" : "bg-slate-600"
                        }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                                config.settings.enabled ? "translate-x-5" : "translate-x-0.5"
                            }`}
                        />
                    </Switch>
                </div>
            </FieldRow>

            <FieldRow
                label="Base URL"
                description="Your Tautulli instance URL (e.g., http://localhost:8181)."
            >
                <input
                    type="text"
                    placeholder="http://localhost:8181"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                    value={config.settings.base_url}
                    onChange={(e) =>
                        config.setSettings((prev) => ({
                            ...prev,
                            base_url: e.target.value,
                        }))
                    }
                    disabled={config.loading}
                />
            </FieldRow>

            <FieldRow
                label="API Key"
                description="Found in Tautulli Settings → Web Interface → API."
            >
                <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                    value={config.settings.api_key}
                    onChange={(e) =>
                        config.setSettings((prev) => ({
                            ...prev,
                            api_key: e.target.value,
                        }))
                    }
                    disabled={config.loading}
                />
            </FieldRow>

            <FieldRow
                label="Collect on Rotation"
                description="Automatically collect analytics after each rotation."
            >
                <div className="flex justify-end">
                    <Switch
                        checked={config.settings.collect_on_rotation}
                        onChange={() =>
                            config.setSettings((prev) => ({
                                ...prev,
                                collect_on_rotation: !prev.collect_on_rotation,
                            }))
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                            config.settings.collect_on_rotation ? "bg-primary" : "bg-slate-600"
                        }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                                config.settings.collect_on_rotation
                                    ? "translate-x-5"
                                    : "translate-x-0.5"
                            }`}
                        />
                    </Switch>
                </div>
            </FieldRow>

            <FieldRow
                label="Collection Interval (hours)"
                description="How often to collect analytics snapshots (in hours)."
            >
                <input
                    type="number"
                    min="1"
                    placeholder="24"
                    className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
                    value={config.settings.collect_interval_hours}
                    onChange={(e) =>
                        config.setSettings((prev) => ({
                            ...prev,
                            collect_interval_hours: parseInt(e.target.value) || 24,
                        }))
                    }
                    disabled={config.loading}
                />
            </FieldRow>

            {config.message && (
                <div className="rounded-lg border border-emerald-700 bg-emerald-900/50 px-3 py-2 text-xs text-emerald-100">
                    {config.message}
                </div>
            )}

            {config.error && (
                <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                    {config.error}
                </div>
            )}

            {/* Test connection CTA */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 mt-6">
                <div className="flex items-center gap-3">
                    <span
                        className={`rounded-full p-2 ${
                            config.testStatus === "success"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : config.testStatus === "error"
                                  ? "bg-rose-500/15 text-rose-400"
                                  : "bg-amber-500/15 text-amber-400"
                        }`}
                    >
                        {config.testStatus === "success" ? (
                            <Wifi size={18} />
                        ) : (
                            <WifiOff size={18} />
                        )}
                    </span>
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-white">Test Tautulli connection</p>
                        <p className="text-xs text-slate-400">
                            Run a dry connection test to verify credentials
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={config.saving || config.loading}
                        onClick={config.saveSettings}
                        className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {config.saving ? "Saving..." : "Save Settings"}
                    </button>
                    <button
                        type="button"
                        disabled={
                            config.testStatus === "testing" ||
                            !config.settings.api_key ||
                            config.loading
                        }
                        onClick={config.testConnection}
                        className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {config.testStatus === "testing" ? "Testing..." : "Test connection"}
                    </button>
                </div>
            </div>
        </ConfigPanel>
    );
}
