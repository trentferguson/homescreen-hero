import { useState, useEffect } from "react";
import { fetchWithAuth } from "../utils/api";
import { timeAgo } from "../utils/dates";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogCloseButton,
} from "./ui/dialog";
import { ConfirmDialog } from "./ui/confirm-dialog";
import {
    Film,
    Tv,
    Star,
    Calendar,
    User,
    CheckCircle,
    XCircle,
    Trash2,
    Loader2,
    ExternalLink,
} from "lucide-react";
import type { SeerrRequest, SeerrRequestDetail, SeerrRequestStatus } from "../types/seerr";
import { SEERR_STATUS_COLORS } from "../types/seerr";

type Props = {
    request: SeerrRequest | null;
    open: boolean;
    onClose: () => void;
    onStatusChange: (requestId: number, newStatus: SeerrRequestStatus, newLabel: string) => void;
    onDelete: (requestId: number) => void;
    seerrBaseUrl?: string;
};

function StatusPill({ status, label }: { status: SeerrRequestStatus; label: string }) {
    const colors = SEERR_STATUS_COLORS[status] || {
        bg: "bg-slate-500/15",
        text: "text-slate-300",
        border: "ring-slate-500/30",
    };
    return (
        <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ${colors.bg} ${colors.text} ${colors.border}`}
        >
            {label}
        </span>
    );
}

export default function SeerrRequestModal({
    request,
    open,
    onClose,
    onStatusChange,
    onDelete,
    seerrBaseUrl,
}: Props) {
    const [detail, setDetail] = useState<SeerrRequestDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    useEffect(() => {
        if (open && request) {
            loadDetail(request.id);
        } else {
            setDetail(null);
            setError(null);
        }
    }, [open, request?.id]);

    const loadDetail = async (requestId: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetchWithAuth(`/api/admin/seerr/requests/${requestId}`);
            if (!response.ok) {
                throw new Error("Failed to load request details");
            }
            const data: SeerrRequestDetail = await response.json();
            setDetail(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load details");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!request) return;
        setActionLoading("approve");
        try {
            const response = await fetchWithAuth(`/api/admin/seerr/requests/${request.id}/approve`, {
                method: "POST",
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to approve request");
            }
            onStatusChange(request.id, 2, "Approved");
            if (detail) {
                setDetail({ ...detail, status: 2, statusLabel: "Approved" });
            }
        } catch (err) {
            console.error("Failed to approve:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDecline = async () => {
        if (!request) return;
        setActionLoading("decline");
        try {
            const response = await fetchWithAuth(`/api/admin/seerr/requests/${request.id}/decline`, {
                method: "POST",
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to decline request");
            }
            onStatusChange(request.id, 3, "Declined");
            if (detail) {
                setDetail({ ...detail, status: 3, statusLabel: "Declined" });
            }
        } catch (err) {
            console.error("Failed to decline:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteClick = () => {
        setConfirmDeleteOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!request) return;
        setConfirmDeleteOpen(false);
        setActionLoading("delete");
        try {
            const response = await fetchWithAuth(`/api/admin/seerr/requests/${request.id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to delete request");
            }
            onDelete(request.id);
            onClose();
        } catch (err) {
            console.error("Failed to delete:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const posterUrl = detail?.media.posterPath
        ? `https://image.tmdb.org/t/p/w300${detail.media.posterPath}`
        : null;

    const backdropUrl = detail?.media.backdropPath
        ? `https://image.tmdb.org/t/p/w1280${detail.media.backdropPath}`
        : null;

    // Determine if actions should be shown based on status
    const isPending = (detail?.status || request?.status) === 1;
    const currentStatus = detail?.status || request?.status || 1;
    const currentLabel = detail?.statusLabel || request?.statusLabel || "Unknown";

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden">
                {/* Backdrop Image */}
                {backdropUrl && (
                    <div className="relative h-40 overflow-hidden">
                        <img
                            src={backdropUrl}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
                    </div>
                )}

                <DialogHeader className={backdropUrl ? "absolute top-0 left-0 right-0 border-b-0 bg-transparent" : ""}>
                    <div className="flex-1" />
                    <DialogCloseButton />
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : error ? (
                    <div className="text-center py-16">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={() => request && loadDetail(request.id)}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                        >
                            Retry
                        </button>
                    </div>
                ) : detail ? (
                    <div className={`p-6 ${backdropUrl ? "pt-2" : ""}`}>
                        <div className="flex gap-5">
                            {/* Poster */}
                            <div className="flex-shrink-0">
                                {posterUrl ? (
                                    <img
                                        src={posterUrl}
                                        alt={detail.media.title}
                                        className="w-32 h-48 object-cover rounded-lg shadow-lg"
                                    />
                                ) : (
                                    <div className="w-32 h-48 rounded-lg bg-slate-800 flex items-center justify-center">
                                        {detail.media.mediaType === "movie" ? (
                                            <Film className="h-12 w-12 text-slate-600" />
                                        ) : (
                                            <Tv className="h-12 w-12 text-slate-600" />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 space-y-3">
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <DialogTitle className="text-xl">
                                            {detail.media.title}
                                        </DialogTitle>
                                        <StatusPill status={currentStatus} label={currentLabel} />
                                    </div>

                                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                                        <span className="inline-flex items-center gap-1.5">
                                            {detail.media.mediaType === "movie" ? (
                                                <Film className="h-4 w-4" />
                                            ) : (
                                                <Tv className="h-4 w-4" />
                                            )}
                                            {detail.media.mediaType === "movie" ? "Movie" : "TV Show"}
                                        </span>

                                        {detail.media.releaseDate && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Calendar className="h-4 w-4" />
                                                {new Date(detail.media.releaseDate).getFullYear()}
                                            </span>
                                        )}

                                        {detail.media.voteAverage != null && detail.media.voteAverage > 0 && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Star className="h-4 w-4 text-yellow-400" />
                                                {detail.media.voteAverage.toFixed(1)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {detail.media.overview && (
                                    <p className="text-sm text-slate-300 line-clamp-3">
                                        {detail.media.overview}
                                    </p>
                                )}

                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <User className="h-4 w-4" />
                                    <span>
                                        Requested by <span className="text-white">{detail.requestedBy.username}</span>
                                    </span>
                                    <span className="text-slate-600">·</span>
                                    <span>{timeAgo(detail.createdAt)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-800">
                            <div className="flex items-center gap-2">
                                {isPending && (
                                    <>
                                        <button
                                            onClick={handleApprove}
                                            disabled={actionLoading !== null}
                                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {actionLoading === "approve" ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <CheckCircle className="h-4 w-4" />
                                            )}
                                            Approve
                                        </button>
                                        <button
                                            onClick={handleDecline}
                                            disabled={actionLoading !== null}
                                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 hover:border-rose-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {actionLoading === "decline" ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <XCircle className="h-4 w-4" />
                                            )}
                                            Decline
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleDeleteClick}
                                    disabled={actionLoading !== null}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-500/15 text-slate-400 border border-slate-500/30 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {actionLoading === "delete" ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                    Delete
                                </button>
                            </div>

                            {seerrBaseUrl && detail.media.tmdbId && (
                                <a
                                    href={`${seerrBaseUrl}/${detail.media.mediaType}/${detail.media.tmdbId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-white transition-all"
                                >
                                    Open in Overseerr
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            )}
                        </div>
                    </div>
                ) : null}
            </DialogContent>

            <ConfirmDialog
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
                title="Delete Request"
                description={`Are you sure you want to delete the request for "${detail?.media.title || request?.media.title}"? This action cannot be undone.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={handleDeleteConfirm}
                variant="danger"
            />
        </Dialog>
    );
}
