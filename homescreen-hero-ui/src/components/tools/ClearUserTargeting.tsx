import { useState, useEffect, useRef } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { fetchWithAuth } from "../../utils/api";
import Toast from "../Toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    DialogCloseButton,
} from "@/components/ui/dialog";

type ClearUserTargetingProps = {
    onClose: () => void;
};

type ClearResult = {
    labels_removed: number;
    collections_cleaned: number;
    filters_cleaned: number;
};

export default function ClearUserTargeting({ onClose }: ClearUserTargetingProps) {
    const [clearing, setClearing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState<ClearResult | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const confirmTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Reset confirm state after 3 seconds
    useEffect(() => {
        if (confirming) {
            confirmTimeout.current = setTimeout(() => setConfirming(false), 3000);
            return () => clearTimeout(confirmTimeout.current);
        }
    }, [confirming]);

    const handleClear = async () => {
        setClearing(true);
        try {
            const r = await fetchWithAuth("/api/admin/user-targeting/clear-all", {
                method: "POST",
            });
            if (!r.ok) {
                const text = await r.text();
                throw new Error(text || "Failed to clear targeting");
            }
            const data = await r.json();
            setResult({
                labels_removed: data.labels_removed,
                collections_cleaned: data.collections_cleaned,
                filters_cleaned: data.filters_cleaned,
            });
            setToast({ message: "All user targeting cleared", type: "success" });
        } catch (e) {
            setToast({ message: String(e), type: "error" });
        } finally {
            setClearing(false);
        }
    };

    return (
        <>
            <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
                <DialogContent className="!max-w-lg">
                    <DialogHeader>
                        <div>
                            <DialogTitle>Clear User Targeting</DialogTitle>
                            <DialogDescription>
                                Remove all user targeting labels and user filter settings.
                            </DialogDescription>
                        </div>
                        <DialogCloseButton />
                    </DialogHeader>

                    <div className="space-y-4 p-6">
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                                <p className="text-sm text-slate-300">
                                    Removes all per-user targeting labels from every collection and reset all user filter settings. Groups with <strong>Specific Users</strong> selected will re-apply labels on the next rotation.
                                </p>
                            </div>
                        </div>

                        {result && (
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                    <p className="text-sm font-medium text-emerald-300">Targeting cleared successfully</p>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center">
                                        <p className="text-lg font-semibold text-white">{result.labels_removed}</p>
                                        <p className="text-xs text-slate-400">label{result.labels_removed !== 1 ? "s" : ""} removed</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-semibold text-white">{result.collections_cleaned}</p>
                                        <p className="text-xs text-slate-400">collection{result.collections_cleaned !== 1 ? "s" : ""}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-semibold text-white">{result.filters_cleaned}</p>
                                        <p className="text-xs text-slate-400">filter{result.filters_cleaned !== 1 ? "s" : ""} cleaned</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                            {result ? "Done" : "Cancel"}
                        </button>
                        {!result && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirming) {
                                        setConfirming(false);
                                        handleClear();
                                    } else {
                                        setConfirming(true);
                                    }
                                }}
                                disabled={clearing}
                                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors flex items-center gap-2 ${
                                    confirming
                                        ? "bg-red-600 hover:bg-red-500"
                                        : "bg-amber-600 hover:bg-amber-500"
                                }`}
                            >
                                {clearing && <Loader2 className="h-4 w-4 animate-spin" />}
                                {clearing ? "Clearing..." : confirming ? "Click to Confirm" : "Clear All Targeting"}
                            </button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

{toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
}
