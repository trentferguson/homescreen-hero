import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { Activity, CheckCircle2, AlertCircle, XCircle, HelpCircle, RefreshCw } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogCloseButton,
    DialogFooter,
} from "./ui/dialog";

type IntegrationHealth = {
    name: string;
    enabled: boolean;
    ok: boolean;
    status: "online" | "offline" | "disabled" | "error";
    detail?: string;
    last_checked: string;
};

type IntegrationsHealthResponse = {
    total_integrations: number;
    enabled_count: number;
    healthy_count: number;
    unhealthy_count: number;
    overall_status: "all_healthy" | "some_issues" | "all_offline";
    integrations: IntegrationHealth[];
};

export default function IntegrationsHealthCard({ loading: parentLoading }: { loading?: boolean }) {
    const [data, setData] = useState<IntegrationsHealthResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);

    const loadHealth = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetchWithAuth("/api/admin/integrations/health");
            if (!response.ok) throw new Error("Failed to load integrations health");
            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load health data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHealth();
        const interval = setInterval(loadHealth, 5 * 60 * 1000); // 5 minutes
        return () => clearInterval(interval);
    }, []);

    const handleTestConnection = async (name: string) => {
        setTestingId(name);
        // Map integration names to existing health endpoints
        const endpointMap: Record<string, string> = {
            "Plex": "/api/health/plex",
            "Trakt": "/api/health/trakt",
            "Tautulli": "/api/health/tautulli",
            "MDBList": "/api/health/mdblist",
            "Seerr": "/api/health/seerr",
        };

        const endpoint = endpointMap[name];
        if (!endpoint) {
            setTestingId(null);
            return;
        }

        try {
            await fetchWithAuth(endpoint);
            // Refresh overall health after individual test
            await loadHealth();
        } catch (err) {
            console.error(`Failed to test ${name}:`, err);
        } finally {
            setTestingId(null);
        }
    };

    if (parentLoading || (loading && !data)) {
        return (
            <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 p-5 h-32 transition-all duration-300">
                <div className="relative h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="group relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-red-500/5 p-5 h-32 transition-all duration-300">
                <div className="relative h-full flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-red-400 mb-2">{error}</p>
                    <button onClick={loadHealth} className="px-3 py-1 text-xs font-medium text-white bg-primary hover:bg-primary-dark rounded-lg">Retry</button>
                </div>
            </div>
        );
    }

    const overall = data!;
    const statusColor =
        overall.overall_status === "all_healthy" ? "text-emerald-600 dark:text-emerald-400" :
            overall.overall_status === "some_issues" ? "text-amber-500 dark:text-amber-300" :
                "text-red-600 dark:text-red-400";

    const statusDotClass = [
        "w-4 h-4 rounded-full",
        overall.overall_status === "all_healthy" ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.65)]" :
            overall.overall_status === "some_issues" ? "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]" :
                "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.55)]"
    ].join(" ");

    const detailText =
        overall.overall_status === "all_healthy" ? "All systems online" :
            overall.overall_status === "some_issues" ? `${overall.healthy_count} of ${overall.enabled_count} online` :
                "All systems offline";

    // Border color based on status (matching integrations page)
    const borderColor =
        overall.overall_status === "all_healthy" ? "border-emerald-500/30" :
            overall.overall_status === "some_issues" ? "border-amber-500/30" :
                "border-red-500/30";

    // Gradient background based on status
    const gradientBg =
        overall.overall_status === "all_healthy" ? "from-emerald-500/5 via-slate-900/50 to-slate-900/50" :
            overall.overall_status === "some_issues" ? "from-amber-500/5 via-slate-900/50 to-slate-900/50" :
                "from-red-500/5 via-slate-900/50 to-slate-900/50";

    // Shadow color based on status
    const shadowColorClass =
        overall.overall_status === "all_healthy" ? "shadow-emerald-500/5" :
            overall.overall_status === "some_issues" ? "shadow-amber-500/5" :
                "shadow-red-500/5";

    return (
        <>
            <div
                className={`group relative overflow-hidden rounded-xl border ${borderColor} bg-gradient-to-br ${gradientBg} shadow-lg ${shadowColorClass} p-5 h-32 transition-all duration-300 hover:bg-slate-800/30 cursor-pointer`}
                onClick={() => setShowModal(true)}
            >
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity duration-200 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                </div>

                <div className="relative h-full flex items-center justify-between pointer-events-none">
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-400 mb-1">Integrations</div>
                        <div className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none text-white transition-all duration-200">
                            {overall.enabled_count}
                        </div>
                        <div className={`mt-2.5 font-semibold text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis ${statusColor}`}>
                            {detailText}
                        </div>
                    </div>

                    <div className="relative w-16 h-16 flex items-center justify-center justify-self-end shrink-0">
                        <div className="absolute -top-1 -right-0.5 z-10">
                            <div className={statusDotClass} />
                        </div>
                        <div className="text-slate-200 transition-transform duration-200 group-hover:scale-110">
                            <Activity size={40} strokeWidth={1.5} />
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={showModal} onOpenChange={(isOpen) => !isOpen && setShowModal(false)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <div className="flex flex-col gap-1">
                            <DialogTitle>Integrations Health</DialogTitle>
                            <DialogDescription>
                                {overall.healthy_count} of {overall.enabled_count} active integrations are healthy
                            </DialogDescription>
                        </div>
                        <DialogCloseButton />
                    </DialogHeader>

                    <div className="p-6 space-y-4 overflow-y-auto max-h-[50vh] scrollbar-hover-only">
                        {overall.integrations.map((int) => (
                            <IntegrationItem
                                key={int.name}
                                integration={int}
                                isTesting={testingId === int.name}
                                onTest={() => handleTestConnection(int.name)}
                            />
                        ))}
                    </div>

                    <DialogFooter className="justify-end">
                        <button
                            onClick={loadHealth}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh All
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function IntegrationItem({ integration, isTesting, onTest }: {
    integration: IntegrationHealth;
    isTesting: boolean;
    onTest: () => void;
}) {
    const StatusIcon =
        integration.status === "online" ? CheckCircle2 :
            integration.status === "disabled" ? HelpCircle :
                integration.status === "error" ? XCircle : AlertCircle;

    const statusColorClass =
        integration.status === "online" ? "text-emerald-500" :
            integration.status === "disabled" ? "text-slate-400" :
                "text-red-500";

    return (
        <div className={`p-4 rounded-xl border transition-all ${integration.enabled
            ? "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50"
            : "bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800/50"
            }`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${integration.status === "online" ? "bg-emerald-500/10" :
                        integration.status === "disabled" ? "bg-slate-500/10" : "bg-red-500/10"
                        }`}>
                        <StatusIcon className={`w-5 h-5 ${statusColorClass}`} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-white">{integration.name}</h4>
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${integration.status === "online" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                                integration.status === "disabled" ? "bg-slate-500/10 text-slate-500" :
                                    "bg-red-500/10 text-red-600 dark:text-red-400"
                                }`}>
                                {integration.status}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1" title={integration.detail}>
                            {integration.detail || (integration.enabled ? "Enabled" : "Disabled")}
                        </p>
                    </div>
                </div>

                {integration.enabled && (
                    <button
                        onClick={onTest}
                        disabled={isTesting}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
                    >
                        {isTesting ? "Testing..." : "Test Connection"}
                    </button>
                )}
            </div>
        </div>
    );
}
