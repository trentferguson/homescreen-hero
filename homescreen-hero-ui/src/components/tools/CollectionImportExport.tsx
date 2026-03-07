import { useState, useEffect, useRef } from "react";
import {
    Download,
    Upload,
    Copy,
    Check,
    Loader2,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
} from "lucide-react";
import { Listbox } from "@headlessui/react";
import { fetchWithAuth } from "../../utils/api";
import Toast from "../Toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogCloseButton,
} from "@/components/ui/dialog";

type Library = {
    title: string;
    type: string;
};

type CollectionSummary = {
    title: string;
    library: string;
    item_count: number;
    smart?: boolean;
};

type PreviewResult = {
    original_name: string;
    final_name: string;
    name_changed: boolean;
    total_items: number;
    matched: number;
    missing: number;
    missing_items?: { title: string; year: number | null; type: string }[];
};

type ImportResult = {
    original_name: string;
    final_name: string;
    name_changed: boolean;
    total_items: number;
    matched: number;
    missing: number;
};

type CollectionImportExportProps = {
    onClose: () => void;
};

export default function CollectionImportExport({ onClose }: CollectionImportExportProps) {
    const [activeTab, setActiveTab] = useState<"export" | "import">("export");

    // Shared state
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        fetchWithAuth("/api/collections/libraries")
            .then((r) => r.json())
            .then((data) => setLibraries(data.libraries || []))
            .catch(() => {});
    }, []);

    return (
        <>
            <Dialog open onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <div>
                            <DialogTitle>Collection Import / Export</DialogTitle>
                            <DialogDescription>Share collections with others or import from a file or share code</DialogDescription>
                        </div>
                        <DialogCloseButton />
                    </DialogHeader>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-800/80">
                        <button
                            onClick={() => setActiveTab("export")}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                activeTab === "export"
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            Export
                        </button>
                        <button
                            onClick={() => setActiveTab("import")}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                activeTab === "import"
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            Import
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto max-h-[60vh] scrollbar-thin">
                        {activeTab === "export" ? (
                            <ExportTab libraries={libraries} setToast={setToast} />
                        ) : (
                            <ImportTab libraries={libraries} setToast={setToast} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
        </>
    );
}


// ============================================================================
// Export Tab
// ============================================================================

function ExportTab({
    libraries,
    setToast,
}: {
    libraries: Library[];
    setToast: (t: { message: string; type: "success" | "error" } | null) => void;
}) {
    const [selectedLibrary, setSelectedLibrary] = useState<string>("");
    const [collections, setCollections] = useState<CollectionSummary[]>([]);
    const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
    const [loadingCollections, setLoadingCollections] = useState(false);
    const [includeMetadata, setIncludeMetadata] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [copied, setCopied] = useState(false);

    // Load collections when library changes
    useEffect(() => {
        if (!selectedLibrary) {
            setCollections([]);
            setSelectedCollections(new Set());
            return;
        }
        setLoadingCollections(true);
        fetchWithAuth("/api/collections/all")
            .then((r) => r.json())
            .then((data) => {
                const filtered = (data.collections || []).filter(
                    (c: CollectionSummary) => c.library === selectedLibrary
                );
                setCollections(filtered);
                setSelectedCollections(new Set());
            })
            .catch(() => setCollections([]))
            .finally(() => setLoadingCollections(false));
    }, [selectedLibrary]);

    const toggleCollection = (title: string) => {
        setSelectedCollections((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedCollections.size === collections.length) {
            setSelectedCollections(new Set());
        } else {
            setSelectedCollections(new Set(collections.map((c) => c.title)));
        }
    };

    const doExport = async (mode: "download" | "share-code") => {
        if (selectedCollections.size === 0) return;
        setExporting(true);

        const endpoint = mode === "share-code"
            ? "/api/collections/io/export/share-code"
            : "/api/collections/io/export";

        try {
            const res = await fetchWithAuth(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    library: selectedLibrary,
                    collections: Array.from(selectedCollections),
                    include_metadata: includeMetadata,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();

            if (mode === "share-code") {
                await navigator.clipboard.writeText(data.share_code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                setToast({ message: "Share code copied to clipboard", type: "success" });
            } else {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const timestamp = new Date().toISOString().slice(0, 10);
                a.download = `collections_export_${timestamp}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setToast({ message: "Export downloaded", type: "success" });
            }
        } catch (e: unknown) {
            setToast({ message: e instanceof Error ? e.message : "Export failed", type: "error" });
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Library selector */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Library</label>
                <Listbox value={selectedLibrary} onChange={setSelectedLibrary}>
                    <div className="relative">
                        <Listbox.Button className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-slate-200 hover:border-slate-600 transition-colors">
                            <span>{selectedLibrary || "Select a library..."}</span>
                            <ChevronDown size={16} className="text-slate-400" />
                        </Listbox.Button>
                        <Listbox.Options className="absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 shadow-xl max-h-48 overflow-auto">
                            {libraries.map((lib) => (
                                <Listbox.Option
                                    key={lib.title}
                                    value={lib.title}
                                    className={({ active }) =>
                                        `px-4 py-2.5 text-sm cursor-pointer ${
                                            active ? "bg-slate-700 text-white" : "text-slate-300"
                                        }`
                                    }
                                >
                                    {lib.title}
                                </Listbox.Option>
                            ))}
                        </Listbox.Options>
                    </div>
                </Listbox>
            </div>

            {/* Collection list */}
            <div className={`grid transition-all duration-300 ease-in-out ${
                selectedLibrary ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}>
                <div className={selectedLibrary ? "overflow-visible" : "overflow-hidden"}>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-300">
                            Collections ({selectedCollections.size} selected)
                        </label>
                        <button
                            onClick={toggleAll}
                            className="text-xs text-primary hover:text-blue-400 transition-colors"
                        >
                            {selectedCollections.size === collections.length ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                    {loadingCollections ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={20} className="animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/30 divide-y divide-slate-800 scrollbar-thin">
                            {collections.map((col) => (
                                <label
                                    key={col.title}
                                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-800/50 transition-colors"
                                >
                                    <div
                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                                            selectedCollections.has(col.title)
                                                ? "bg-primary border-primary"
                                                : "border-slate-600"
                                        }`}
                                    >
                                        {selectedCollections.has(col.title) && (
                                            <Check size={12} className="text-white" />
                                        )}
                                    </div>
                                    <span className="text-sm text-slate-200 truncate">{col.title}</span>
                                    {col.smart && (
                                        <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 flex-shrink-0">
                                            Smart
                                        </span>
                                    )}
                                    <span className="text-xs text-slate-500 ml-auto flex-shrink-0">
                                        {col.item_count} items
                                    </span>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={selectedCollections.has(col.title)}
                                        onChange={() => toggleCollection(col.title)}
                                    />
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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

            {/* Smart collection warning */}
            <div className={`grid transition-all duration-300 ease-in-out ${
                collections.some((c) => c.smart && selectedCollections.has(c.title))
                    ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}>
                <div className="overflow-hidden">
                    <div className="flex items-start gap-2.5 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                        <span>
                            Smart collections will be exported as a snapshot of their current items. Importing will create regular collections.
                        </span>
                    </div>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
                <button
                    onClick={() => doExport("download")}
                    disabled={exporting || selectedCollections.size === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-sm font-medium hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                    {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Download .json
                </button>
                <button
                    onClick={() => doExport("share-code")}
                    disabled={exporting || selectedCollections.size === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
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
    );
}


// ============================================================================
// Import Tab
// ============================================================================

function ImportTab({
    libraries,
    setToast,
}: {
    libraries: Library[];
    setToast: (t: { message: string; type: "success" | "error" } | null) => void;
}) {
    const [selectedLibrary, setSelectedLibrary] = useState<string>("");
    const [importMode, setImportMode] = useState<"file" | "share-code">("file");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shareCode, setShareCode] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [previewing, setPreviewing] = useState(false);
    const [previewResults, setPreviewResults] = useState<PreviewResult[] | null>(null);
    const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);
    const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
    const [autoRequestResults, setAutoRequestResults] = useState<{ requested: number; skipped: number; already_exists: number; failed: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [autoRequest, setAutoRequest] = useState(false);

    const hasInput = importMode === "file" ? selectedFile !== null : shareCode.trim().length > 0;
    const canPreview = hasInput && selectedLibrary;

    const handlePreview = async () => {
        if (!canPreview) return;
        setPreviewing(true);
        setError(null);
        setPreviewResults(null);
        setImportResults(null);

        try {
            let res: Response;
            if (importMode === "file" && selectedFile) {
                const formData = new FormData();
                formData.append("file", selectedFile);
                res = await fetchWithAuth(
                    `/api/collections/io/import/preview?target_library=${encodeURIComponent(selectedLibrary)}`,
                    { method: "POST", body: formData }
                );
            } else {
                res = await fetchWithAuth("/api/collections/io/import/preview/share-code", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        share_code: shareCode.trim(),
                        target_library: selectedLibrary,
                    }),
                });
            }

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const collections = data.collections as PreviewResult[];
            setPreviewResults(collections);
            // Default-select collections that have at least one match
            setSelectedForImport(
                new Set(collections.filter((c) => c.matched > 0).map((c) => c.original_name))
            );
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Preview failed");
        } finally {
            setPreviewing(false);
        }
    };

    const handleImport = async () => {
        if (!canPreview) return;
        setImporting(true);
        setError(null);

        const selected = selectedForImport.size > 0 ? Array.from(selectedForImport) : undefined;

        try {
            let res: Response;
            if (importMode === "file" && selectedFile) {
                const formData = new FormData();
                formData.append("file", selectedFile);
                let url = `/api/collections/io/import/apply?target_library=${encodeURIComponent(selectedLibrary)}`;
                if (selected) {
                    url += selected.map((n) => `&selected_collections=${encodeURIComponent(n)}`).join("");
                }
                if (autoRequest) {
                    url += "&auto_request=true";
                }
                res = await fetchWithAuth(url, { method: "POST", body: formData });
            } else {
                res = await fetchWithAuth("/api/collections/io/import/apply/share-code", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        share_code: shareCode.trim(),
                        target_library: selectedLibrary,
                        selected_collections: selected,
                        auto_request: autoRequest,
                    }),
                });
            }

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setImportResults(data.collections);
            setAutoRequestResults(data.auto_request || null);
            setPreviewResults(null);

            const totalMatched = data.collections.reduce((s: number, c: ImportResult) => s + c.matched, 0);
            const totalMissing = data.collections.reduce((s: number, c: ImportResult) => s + c.missing, 0);
            let message = `Imported ${data.collections.length} collection(s): ${totalMatched} items matched, ${totalMissing} missing`;
            if (data.auto_request?.requested > 0) {
                message += `, ${data.auto_request.requested} requested via Seerr`;
            }
            setToast({
                message,
                type: totalMissing > 0 ? "error" : "success",
            });
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Import failed");
        } finally {
            setImporting(false);
        }
    };

    // Auto-detect share code paste
    const handlePaste = (text: string) => {
        setShareCode(text);
        if (text.startsWith("HSH:")) {
            setImportMode("share-code");
        }
    };

    return (
        <div className="space-y-5">
            {/* Target library */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Target Library</label>
                <Listbox value={selectedLibrary} onChange={setSelectedLibrary}>
                    <div className="relative">
                        <Listbox.Button className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-slate-200 hover:border-slate-600 transition-colors">
                            <span>{selectedLibrary || "Select a library..."}</span>
                            <ChevronDown size={16} className="text-slate-400" />
                        </Listbox.Button>
                        <Listbox.Options className="absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 shadow-xl max-h-48 overflow-auto">
                            {libraries.map((lib) => (
                                <Listbox.Option
                                    key={lib.title}
                                    value={lib.title}
                                    className={({ active }) =>
                                        `px-4 py-2.5 text-sm cursor-pointer ${
                                            active ? "bg-slate-700 text-white" : "text-slate-300"
                                        }`
                                    }
                                >
                                    {lib.title}
                                </Listbox.Option>
                            ))}
                        </Listbox.Options>
                    </div>
                </Listbox>
            </div>

            {/* Import mode toggle */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                        setSelectedFile(file);
                        setImportMode("file");
                        setPreviewResults(null);
                        setImportResults(null);
                        setError(null);
                    }
                }}
            />
            <div className="flex gap-2">
                <button
                    onClick={() => { setImportMode("file"); fileInputRef.current?.click(); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        importMode === "file"
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-600"
                    }`}
                >
                    <Upload size={14} />
                    {selectedFile ? selectedFile.name : "Upload File"}
                </button>
                <button
                    onClick={() => setImportMode("share-code")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        importMode === "share-code"
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-600"
                    }`}
                >
                    <Copy size={14} />
                    Paste Share Code
                </button>
            </div>

            {/* Share code input */}
            {importMode === "share-code" && (
                <textarea
                    value={shareCode}
                    onChange={(e) => handlePaste(e.target.value)}
                    placeholder="Paste HSH:... share code here"
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none font-mono"
                />
            )}

            {error && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Preview results */}
            {previewResults && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-slate-300">
                            Preview ({selectedForImport.size} of {previewResults.length} selected)
                        </h4>
                        <button
                            onClick={() => {
                                if (selectedForImport.size === previewResults.length) {
                                    setSelectedForImport(new Set());
                                } else {
                                    setSelectedForImport(new Set(previewResults.map((c) => c.original_name)));
                                }
                            }}
                            className="text-xs text-primary hover:text-blue-400 transition-colors"
                        >
                            {selectedForImport.size === previewResults.length ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-800/30 divide-y divide-slate-800">
                        {previewResults.map((col) => {
                            const isSelected = selectedForImport.has(col.original_name);
                            return (
                                <label
                                    key={col.original_name}
                                    className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
                                >
                                    <div
                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                                            isSelected
                                                ? "bg-primary border-primary"
                                                : "border-slate-600"
                                        }`}
                                    >
                                        {isSelected && <Check size={12} className="text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className={`text-sm font-medium ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                                                    {col.name_changed ? col.final_name : col.original_name}
                                                </span>
                                                {col.name_changed && (
                                                    <span className="ml-2 text-xs text-amber-400">(renamed)</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className="text-green-400">{col.matched} matched</span>
                                                {col.missing > 0 && (
                                                    <span className="text-amber-400">{col.missing} missing</span>
                                                )}
                                            </div>
                                        </div>
                                        {col.missing_items && col.missing_items.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {col.missing_items.map((item, i) => (
                                                    <p key={i} className="text-xs text-slate-500">
                                                        {item.title} {item.year ? `(${item.year})` : ""}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isSelected}
                                        onChange={() => {
                                            setSelectedForImport((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(col.original_name)) next.delete(col.original_name);
                                                else next.add(col.original_name);
                                                return next;
                                            });
                                        }}
                                    />
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Auto-request toggle (shown when preview has missing items) */}
            {previewResults && previewResults.some((c) => c.missing > 0) && (
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                            autoRequest
                                ? "bg-primary border-primary"
                                : "border-slate-600 group-hover:border-slate-500"
                        }`}
                    >
                        {autoRequest && <Check size={14} className="text-white" />}
                    </div>
                    <div>
                        <span className="text-sm text-slate-200">Auto-request missing items</span>
                        <p className="text-xs text-slate-500">Request missing items via Seerr after import</p>
                    </div>
                    <input
                        type="checkbox"
                        className="sr-only"
                        checked={autoRequest}
                        onChange={(e) => setAutoRequest(e.target.checked)}
                    />
                </label>
            )}

            {/* Import results */}
            {importResults && (
                <div className="space-y-3">
                    <h4 className="text-sm font-medium text-green-400 flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        Import Complete
                    </h4>
                    <div className="rounded-lg border border-slate-700 bg-slate-800/30 divide-y divide-slate-800">
                        {importResults.map((col) => (
                            <div key={col.final_name} className="px-4 py-3 flex items-center justify-between">
                                <span className="text-sm text-slate-200">{col.final_name}</span>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-green-400">{col.matched} added</span>
                                    {col.missing > 0 && (
                                        <span className="text-amber-400">{col.missing} missing</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {autoRequestResults && autoRequestResults.requested > 0 && (
                        <p className="text-xs text-primary">
                            {autoRequestResults.requested} item{autoRequestResults.requested !== 1 ? "s" : ""} requested via Seerr
                        </p>
                    )}
                </div>
            )}

            {/* Action buttons */}
            {!importResults && (
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={handlePreview}
                        disabled={!canPreview || previewing}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-sm font-medium hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {previewing ? <Loader2 size={16} className="animate-spin" /> : null}
                        Preview
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!canPreview || importing || (previewResults !== null && selectedForImport.size === 0)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        Import{previewResults && selectedForImport.size > 0 ? ` (${selectedForImport.size})` : ""}
                    </button>
                </div>
            )}
        </div>
    );
}
