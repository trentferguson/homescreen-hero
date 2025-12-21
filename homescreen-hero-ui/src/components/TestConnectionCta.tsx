import { Wifi, WifiOff } from "lucide-react";

interface TestConnectionCtaProps {
    service: string;
    status: "idle" | "testing" | "success" | "error";
    onTest: () => void;
    message?: string;
}

export default function TestConnectionCta({ service, status, onTest, message }: TestConnectionCtaProps) {
    const isTesting = status === "testing";
    const isSuccess = status === "success";
    const Icon = isSuccess ? Wifi : WifiOff;

    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-4 py-3">
            <div className="flex items-center gap-3">
                <span
                    className={`rounded-full p-2 ${isSuccess
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                >
                    <Icon size={18} />
                </span>
                <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Test {service} connection</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {message ?? "Verify credentials without touching the live config file."}
                    </p>
                </div>
            </div>

            <button
                type="button"
                onClick={onTest}
                disabled={isTesting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-semibold px-3 py-2 transition disabled:opacity-70"
            >
                {isTesting ? "Testing…" : isSuccess ? "Retest" : "Test connection"}
            </button>
        </div>
    );
}