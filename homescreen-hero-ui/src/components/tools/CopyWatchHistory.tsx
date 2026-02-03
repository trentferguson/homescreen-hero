import { useState, useEffect } from "react";
import {
    Loader2,
    Check,
    ChevronDown,
    Users,
    ArrowRight,
    AlertCircle,
    CheckCircle2,
    Film,
    Tv,
    ArrowLeft,
    CirclePlus,
    RefreshCw,
} from "lucide-react";
import { Listbox } from "@headlessui/react";
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

type HomeUser = {
    id: number;
    username: string;
    title: string;
    thumb: string | null;
    is_admin: boolean;
};

type ConflictMode = "only_add" | "mirror";

type PreviewCounts = {
    movies_to_mark_watched: number;
    movies_to_mark_unwatched: number;
    episodes_to_mark_watched: number;
    episodes_to_mark_unwatched: number;
    shows_affected: number;
};

type Step = "configure" | "preview" | "applying" | "complete";

type CopyWatchHistoryProps = {
    onClose: () => void;
};

const conflictModes: { value: ConflictMode; label: string; description: string; icon: typeof CirclePlus }[] = [
    {
        value: "only_add",
        label: "Add Only",
        description: "Mark items as watched that the source user has seen. Never removes existing watch history.",
        icon: CirclePlus,
    },
    {
        value: "mirror",
        label: "Mirror",
        description: "Make the target's history identical to the source. Items the source hasn't watched will be marked unwatched.",
        icon: RefreshCw,
    },
];

export default function CopyWatchHistory({ onClose }: CopyWatchHistoryProps) {
    // Step management
    const [step, setStep] = useState<Step>("configure");

    // Configuration state
    const [users, setUsers] = useState<HomeUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [sourceUser, setSourceUser] = useState<HomeUser | null>(null);
    const [targetUser, setTargetUser] = useState<HomeUser | null>(null);
    const [conflictMode, setConflictMode] = useState<ConflictMode>("only_add");

    // Preview state
    const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Apply state
    const [applyResult, setApplyResult] = useState<{
        success: boolean;
        movies_updated: number;
        episodes_updated: number;
        errors: string[];
    } | null>(null);

    // Toast
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Fetch home users on mount
    useEffect(() => {
        fetchWithAuth("/api/tools/home-users")
            .then((r) => r.json())
            .then((data) => {
                setUsers(data.users || []);
                // Auto-select first user as source if available
                if (data.users?.length > 0) {
                    setSourceUser(data.users[0]);
                }
            })
            .catch((e) => {
                console.error("Failed to fetch home users:", e);
                setToast({ message: "Failed to load Plex Home users", type: "error" });
            })
            .finally(() => setLoadingUsers(false));
    }, []);

    // Generate preview
    const handlePreview = async () => {
        if (!sourceUser || !targetUser) return;

        setLoadingPreview(true);
        try {
            const response = await fetchWithAuth("/api/tools/copy-watch-history/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_user: sourceUser.username,
                    target_user: targetUser.username,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Failed to generate preview");
            }

            const data = await response.json();
            setPreviewCounts(data.counts);
            setStep("preview");
        } catch (e) {
            setToast({ message: `Preview failed: ${e instanceof Error ? e.message : String(e)}`, type: "error" });
        } finally {
            setLoadingPreview(false);
        }
    };

    // Apply changes
    const handleApply = async () => {
        if (!sourceUser || !targetUser) return;

        setStep("applying");

        try {
            const response = await fetchWithAuth("/api/tools/copy-watch-history/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_user: sourceUser.username,
                    target_user: targetUser.username,
                    conflict_mode: conflictMode,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Failed to apply changes");
            }

            const data = await response.json();
            setApplyResult(data);
            setStep("complete");
        } catch (e) {
            setToast({ message: `Apply failed: ${e instanceof Error ? e.message : String(e)}`, type: "error" });
            setStep("preview");
        }
    };

    // Validation
    const canPreview = sourceUser && targetUser && sourceUser.id !== targetUser.id && !loadingPreview;

    // Get available target users (exclude source)
    const availableTargetUsers = users.filter((u) => u.id !== sourceUser?.id);

    // Render user selector
    const renderUserSelector = (
        label: string,
        value: HomeUser | null,
        onChange: (user: HomeUser) => void,
        availableUsers: HomeUser[],
        disabled: boolean = false,
        dashed: boolean = false
    ) => (
        <div className="space-y-2 w-full min-w-0">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</label>
            <Listbox value={value ?? undefined} onChange={onChange} disabled={disabled}>
                <div className="relative">
                    <Listbox.Button
                        className={`flex w-full items-center gap-3 rounded-lg border ${dashed && !value ? "border-dashed border-slate-600" : "border-slate-700"} bg-slate-800/60 px-4 py-3 text-left text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/70 transition-colors ${
                            disabled ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    >
                        {value ? (
                            <>
                                {value.thumb ? (
                                    <img
                                        src={value.thumb}
                                        alt={value.title}
                                        className="h-8 w-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                                        <Users className="h-4 w-4 text-slate-400" />
                                    </div>
                                )}
                                <div className="flex-1 flex items-center">
                                    <span className="font-medium text-white">{value.title}</span>
                                    {value.is_admin && (
                                        <span className="ml-2 text-xs text-primary">(Admin)</span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700/50">
                                    <Users className="h-4 w-4 text-slate-500" />
                                </div>
                                <div className="flex-1 flex items-center">
                                    <p className="text-slate-500">Select a user...</p>
                                </div>
                            </>
                        )}
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                    </Listbox.Button>
                    <Listbox.Options className="absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg focus:outline-none max-h-60 overflow-auto">
                        {availableUsers.map((user) => (
                            <Listbox.Option
                                key={user.id}
                                value={user}
                                className="flex cursor-pointer items-center gap-3 px-4 py-2 text-white hover:bg-slate-700 data-[selected]:bg-primary"
                            >
                                {({ selected }) => (
                                    <>
                                        {user.thumb ? (
                                            <img
                                                src={user.thumb}
                                                alt={user.title}
                                                className="h-8 w-8 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                                                <Users className="h-4 w-4 text-slate-400" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <span className="font-medium text-white">{user.title}</span>
                                            {user.is_admin && (
                                                <span className="ml-2 text-xs text-primary">(Admin)</span>
                                            )}
                                        </div>
                                        {selected && <Check className="h-4 w-4 text-white" />}
                                    </>
                                )}
                            </Listbox.Option>
                        ))}
                    </Listbox.Options>
                </div>
            </Listbox>
        </div>
    );

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="!max-w-3xl">
                {/* Header */}
                <DialogHeader>
                    <div>
                        <DialogTitle>Copy Watch History</DialogTitle>
                        <DialogDescription>
                            Sync watched status between your home media users.
                        </DialogDescription>
                    </div>
                    <DialogCloseButton />
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hover-only">
                    {loadingUsers ? (
                        <div className="flex items-center justify-center py-12 text-slate-400">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Loading users...
                        </div>
                    ) : users.length < 2 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <AlertCircle className="h-8 w-8 mb-3 text-amber-400" />
                            <p className="font-medium text-white">Not enough users</p>
                            <p className="text-sm text-slate-500 mt-1 text-center">
                                You need at least 2 Plex Home users to copy watch history.
                            </p>
                        </div>
                    ) : step === "configure" ? (
                        <div className="space-y-6">
                            {/* User selectors */}
                            <div className="flex items-end gap-3">
                                {renderUserSelector(
                                    "Copy From (Source)",
                                    sourceUser,
                                    (user) => {
                                        setSourceUser(user);
                                        // Clear target if it was the same as new source
                                        if (targetUser?.id === user.id) {
                                            setTargetUser(null);
                                        }
                                    },
                                    users,
                                    false,
                                    false
                                )}
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary mb-2">
                                    <ArrowRight className="h-4 w-4 text-white" />
                                </div>
                                {renderUserSelector(
                                    "Copy To (Target)",
                                    targetUser,
                                    setTargetUser,
                                    availableTargetUsers,
                                    !sourceUser,
                                    true
                                )}
                            </div>

                            {/* Conflict mode */}
                            <div className="space-y-3">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Conflict Resolution Strategy
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    {conflictModes.map((mode) => {
                                        const Icon = mode.icon;
                                        const isSelected = conflictMode === mode.value;
                                        return (
                                            <button
                                                key={mode.value}
                                                type="button"
                                                onClick={() => setConflictMode(mode.value)}
                                                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                                                    isSelected
                                                        ? "border-primary bg-primary/10"
                                                        : "border-slate-800/60 bg-slate-900/30 hover:border-slate-700"
                                                }`}
                                            >
                                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg mb-3 ${
                                                    isSelected ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-400"
                                                }`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <p className="font-medium text-white text-sm mb-1">{mode.label}</p>
                                                <p className="text-xs text-slate-400 leading-relaxed">{mode.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : step === "preview" && previewCounts ? (
                        <div className="space-y-6">
                            {/* Preview summary */}
                            <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Preview Summary</h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Movies */}
                                    <div className="flex items-center gap-3 rounded-lg bg-slate-800/40 p-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                                            <Film className="h-5 w-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-white">
                                                {previewCounts.movies_to_mark_watched}
                                            </p>
                                            <p className="text-sm text-slate-400">Movies to mark watched</p>
                                        </div>
                                    </div>

                                    {/* Episodes */}
                                    <div className="flex items-center gap-3 rounded-lg bg-slate-800/40 p-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20">
                                            <Tv className="h-5 w-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-white">
                                                {previewCounts.episodes_to_mark_watched}
                                            </p>
                                            <p className="text-sm text-slate-400">Episodes to mark watched</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Mirror mode - show items to unwatch */}
                                {conflictMode === "mirror" &&
                                    (previewCounts.movies_to_mark_unwatched > 0 ||
                                        previewCounts.episodes_to_mark_unwatched > 0) && (
                                        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5" />
                                                <div>
                                                    <p className="font-medium text-amber-200">
                                                        Items will be marked unwatched
                                                    </p>
                                                    <p className="text-sm text-amber-300/80 mt-1">
                                                        {previewCounts.movies_to_mark_unwatched} movie
                                                        {previewCounts.movies_to_mark_unwatched !== 1 ? "s" : ""} and{" "}
                                                        {previewCounts.episodes_to_mark_unwatched} episode
                                                        {previewCounts.episodes_to_mark_unwatched !== 1 ? "s" : ""} will
                                                        be marked as unwatched to mirror the source user.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                {/* Shows affected */}
                                {previewCounts.shows_affected > 0 && (
                                    <p className="mt-4 text-sm text-slate-400">
                                        Across {previewCounts.shows_affected} TV show
                                        {previewCounts.shows_affected !== 1 ? "s" : ""}
                                    </p>
                                )}

                                {/* No changes */}
                                {previewCounts.movies_to_mark_watched === 0 &&
                                    previewCounts.episodes_to_mark_watched === 0 &&
                                    previewCounts.movies_to_mark_unwatched === 0 &&
                                    previewCounts.episodes_to_mark_unwatched === 0 && (
                                        <div className="mt-4 flex items-center gap-2 text-slate-400">
                                            <CheckCircle2 className="h-5 w-5 text-green-400" />
                                            <span>Watch history is already in sync - no changes needed!</span>
                                        </div>
                                    )}
                            </div>
                        </div>
                    ) : step === "applying" ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                            <p className="text-lg font-medium text-white">Applying changes...</p>
                            <p className="text-sm text-slate-400 mt-1">This may take a while for large libraries</p>
                        </div>
                    ) : step === "complete" && applyResult ? (
                        <div className="space-y-6">
                            {/* Result summary */}
                            <div
                                className={`rounded-xl border p-6 ${
                                    applyResult.success
                                        ? "border-green-500/30 bg-green-500/10"
                                        : "border-amber-500/30 bg-amber-500/10"
                                }`}
                            >
                                <div className="flex items-start gap-4">
                                    {applyResult.success ? (
                                        <CheckCircle2 className="h-8 w-8 text-green-400" />
                                    ) : (
                                        <AlertCircle className="h-8 w-8 text-amber-400" />
                                    )}
                                    <div>
                                        <h3
                                            className={`text-lg font-semibold ${
                                                applyResult.success ? "text-green-200" : "text-amber-200"
                                            }`}
                                        >
                                            {applyResult.success
                                                ? "Watch history copied successfully!"
                                                : "Completed with some errors"}
                                        </h3>
                                        <p className="text-slate-300 mt-2">
                                            Updated {applyResult.movies_updated} movie
                                            {applyResult.movies_updated !== 1 ? "s" : ""} and{" "}
                                            {applyResult.episodes_updated} episode
                                            {applyResult.episodes_updated !== 1 ? "s" : ""}.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Errors list */}
                            {applyResult.errors.length > 0 && (
                                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                                    <p className="font-medium text-red-200 mb-2">
                                        {applyResult.errors.length} error
                                        {applyResult.errors.length !== 1 ? "s" : ""} occurred:
                                    </p>
                                    <ul className="text-sm text-red-300/80 space-y-1 max-h-40 overflow-auto">
                                        {applyResult.errors.map((error, i) => (
                                            <li key={i}>- {error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <DialogFooter className="py-4 px-6">
                    {step === "configure" && (
                        <>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <AlertCircle className="h-3.5 w-3.5" />
                                <span>This action cannot be easily undone.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePreview}
                                    disabled={!canPreview}
                                    className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    {loadingPreview ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>
                                            Preview Changes
                                            <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {step === "preview" && (
                        <>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <AlertCircle className="h-3.5 w-3.5" />
                                <span>This action cannot be easily undone.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep("configure")}
                                    className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    disabled={
                                        previewCounts?.movies_to_mark_watched === 0 &&
                                        previewCounts?.episodes_to_mark_watched === 0 &&
                                        previewCounts?.movies_to_mark_unwatched === 0 &&
                                        previewCounts?.episodes_to_mark_unwatched === 0
                                    }
                                    className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Confirm & Apply
                                </button>
                            </div>
                        </>
                    )}

                    {step === "complete" && (
                        <>
                            <div />
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-blue-600 transition-colors"
                            >
                                Done
                            </button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </Dialog>
    );
}
