import { useState } from "react";
import { Download, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import { fetchWithAuth } from "../utils/api";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogCloseButton,
} from "./ui/dialog";

type ExportCollectionDialogProps = {
    open: boolean;
    onClose: () => void;
    library: string;
    collectionTitle: string;
    isSmart?: boolean;
};

export default function ExportCollectionDialog({
    open,
    onClose,
    library,
    collectionTitle,
    isSmart = false,
}: ExportCollectionDialogProps) {
    const [includeMetadata, setIncludeMetadata] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDownloadJson = async () => {
        setExporting(true);
        setError(null);
        try {
            const res = await fetchWithAuth("/api/collections/io/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    library,
                    collections: [collectionTitle],
                    include_metadata: includeMetadata,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();

            // Trigger file download
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const safeName = collectionTitle.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_");
            a.download = `${safeName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Export failed");
        } finally {
            setExporting(false);
        }
    };

    const handleCopyShareCode = async () => {
        setExporting(true);
        setError(null);
        try {
            const res = await fetchWithAuth("/api/collections/io/export/share-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    library,
                    collections: [collectionTitle],
                    include_metadata: includeMetadata,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            await navigator.clipboard.writeText(data.share_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Export failed");
        } finally {
            setExporting(false);
        }
    };

    const handleClose = () => {
        setError(null);
        setCopied(false);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Export Collection</DialogTitle>
                    <DialogCloseButton />
                </DialogHeader>

                <div className="p-6 space-y-5">
                    <p className="text-sm text-slate-400">
                        Export "{collectionTitle}" to share with others or back up.
                    </p>

                    {isSmart && (
                        <div className="flex items-start gap-2.5 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                            <span>
                                This is a smart collection. The export will be a snapshot of the current items, not the filter rules. Importing will create a regular collection.
                            </span>
                        </div>
                    )}

                    {/* Metadata toggle */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                includeMetadata
                                    ? "bg-primary border-primary"
                                    : "border-slate-600 group-hover:border-slate-500"
                            }`}
                        >
                            {includeMetadata && <Check size={14} className="text-white" />}
                        </div>
                        <div>
                            <span className="text-sm text-slate-200">Include metadata</span>
                            <p className="text-xs text-slate-500">Summary, labels, and sort order</p>
                        </div>
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={includeMetadata}
                            onChange={(e) => setIncludeMetadata(e.target.checked)}
                        />
                    </label>

                    {error && (
                        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleDownloadJson}
                            disabled={exporting}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-sm font-medium hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Download .json
                        </button>
                        <button
                            onClick={handleCopyShareCode}
                            disabled={exporting}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {copied ? (
                                <>
                                    <Check size={16} />
                                    Copied!
                                </>
                            ) : exporting ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <>
                                    <Copy size={16} />
                                    Copy Share Code
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
