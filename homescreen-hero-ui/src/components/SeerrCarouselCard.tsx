import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { timeAgo } from "../utils/dates";
import { Listbox } from "@headlessui/react";
import { ChevronDown, Check, ChevronLeft, ChevronRight, Film, Tv, CheckCircle, Loader2 } from "lucide-react";
import type { SeerrRequest, SeerrRequestStatus, SeerrRequestsResponse } from "../types/seerr";
import { SEERR_STATUS_OPTIONS, SEERR_STATUS_COLORS } from "../types/seerr";

// Carousel pages configuration (expandable for future pages)
const PAGES = [
    { id: "requests", title: "Recent Requests", subtitle: "Latest media requests from users" },
    // Future pages:
    // { id: "charts", title: "Request Analytics", subtitle: "Request trends over time" },
    // { id: "actions", title: "Quick Actions", subtitle: "Manage pending requests" },
] as const;

type PageId = (typeof PAGES)[number]["id"];

// Persist user's status filter preference
const STORAGE_KEY_STATUS_FILTER = "seerrCarousel.statusFilter";

function getStoredStatusFilter(): string {
    return localStorage.getItem(STORAGE_KEY_STATUS_FILTER) || "all";
}

function setStoredStatusFilter(status: string): void {
    localStorage.setItem(STORAGE_KEY_STATUS_FILTER, status);
}

function StatusPill({ status, label }: { status: SeerrRequestStatus; label: string }) {
    const colors = SEERR_STATUS_COLORS[status] || {
        bg: "bg-slate-500/15",
        text: "text-slate-300",
        border: "ring-slate-500/30"
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${colors.bg} ${colors.text} ${colors.border}`}>
            {label}
        </span>
    );
}

function MediaTypeIcon({ type }: { type: "movie" | "tv" | "unknown" }) {
    if (type === "movie") {
        return <Film className="h-3.5 w-3.5 text-slate-400" />;
    }
    return <Tv className="h-3.5 w-3.5 text-slate-400" />;
}

function SkeletonItem() {
    return (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/60 bg-slate-800/30 p-2.5 animate-pulse">
            <div className="mt-1 h-3.5 w-3.5 rounded bg-slate-700" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-slate-800" />
                <div className="h-2.5 w-1/2 rounded bg-slate-800" />
            </div>
        </div>
    );
}

export default function SeerrCarouselCard({ loading }: { loading?: boolean }) {
    const [requests, setRequests] = useState<SeerrRequest[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [seerrEnabled, setSeerrEnabled] = useState<boolean | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>(getStoredStatusFilter);
    const [activePage, setActivePage] = useState<PageId>("requests");
    const [approvingId, setApprovingId] = useState<number | null>(null);

    useEffect(() => {
        loadRequests();
    }, [statusFilter]);

    const loadRequests = async () => {
        setRequestsLoading(true);
        setError(null);

        try {
            // Check if Seerr is enabled
            const configResponse = await fetchWithAuth("/api/admin/config/seerr");
            if (!configResponse.ok) {
                throw new Error("Failed to load Seerr configuration");
            }
            const config = await configResponse.json();

            if (!config.enabled) {
                setSeerrEnabled(false);
                setRequestsLoading(false);
                return;
            }

            setSeerrEnabled(true);

            // Build query params - fetch up to 50 requests for scrollable list
            const params = new URLSearchParams({ take: "50" });
            if (statusFilter && statusFilter !== "all") {
                params.set("filter", statusFilter);
            }

            const response = await fetchWithAuth(`/api/admin/seerr/requests?${params}`);
            if (!response.ok) {
                throw new Error("Failed to load requests");
            }

            const data: SeerrRequestsResponse = await response.json();
            setRequests(data.requests);
            setTotalResults(data.totalResults);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load requests");
            setSeerrEnabled(true); // Still show the card but with error
        } finally {
            setRequestsLoading(false);
        }
    };

    const handleStatusChange = (status: string) => {
        setStatusFilter(status);
        setStoredStatusFilter(status);
    };

    const navigatePage = (direction: "prev" | "next") => {
        const currentIndex = PAGES.findIndex((p) => p.id === activePage);
        if (direction === "prev") {
            const newIndex = currentIndex === 0 ? PAGES.length - 1 : currentIndex - 1;
            setActivePage(PAGES[newIndex].id);
        } else {
            const newIndex = currentIndex === PAGES.length - 1 ? 0 : currentIndex + 1;
            setActivePage(PAGES[newIndex].id);
        }
    };

    const handleApprove = async (requestId: number) => {
        setApprovingId(requestId);
        try {
            const response = await fetchWithAuth(`/api/admin/seerr/requests/${requestId}/approve`, {
                method: "POST",
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to approve request");
            }
            // Update the request status locally to approved (status 2)
            setRequests((prev) =>
                prev.map((r) =>
                    r.id === requestId ? { ...r, status: 2 as const, statusLabel: "Approved" } : r
                )
            );
        } catch (err) {
            console.error("Failed to approve request:", err);
            // Could add toast notification here
        } finally {
            setApprovingId(null);
        }
    };

    const currentPageInfo = PAGES.find((p) => p.id === activePage)!;

    // Loading state
    if (loading || (requestsLoading && seerrEnabled === null)) {
        return (
            <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 p-5 space-y-4 transition-all duration-300">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Seerr Requests</h3>
                        <p className="text-sm text-slate-400 mt-0.5">Loading requests...</p>
                    </div>
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <SkeletonItem key={idx} />
                    ))}
                </div>
            </div>
        );
    }

    // Seerr not enabled state
    if (seerrEnabled === false) {
        return (
            <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 p-5 space-y-4 transition-all duration-300">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Seerr Requests</h3>
                        <p className="text-sm text-slate-400 mt-0.5">Recent media requests</p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 mb-3">
                        <Film className="w-6 h-6 text-slate-500" />
                    </div>
                    <p className="text-sm text-slate-400 mb-3">Seerr is not configured</p>
                    <a
                        href="/integrations"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                    >
                        Configure Seerr
                    </a>
                </div>
            </div>
        );
    }

    // Error state
    if (error && requests.length === 0) {
        return (
            <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 p-5 space-y-4 transition-all duration-300">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Seerr Requests</h3>
                        <p className="text-sm text-slate-400 mt-0.5">Recent media requests</p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <p className="text-sm text-red-400 mb-3">{error}</p>
                    <button
                        onClick={loadRequests}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Main render - Requests page
    return (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 p-5 space-y-4 transition-all duration-300 hover:bg-slate-800/30">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                        {currentPageInfo.title}
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {currentPageInfo.subtitle}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Status Filter Dropdown */}
                    <Listbox value={statusFilter} onChange={handleStatusChange}>
                        <div className="relative">
                            <Listbox.Button className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/50 bg-slate-800/30 text-slate-300 hover:text-white hover:border-primary/30 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 flex items-center gap-1.5 min-w-[110px]">
                                <span>
                                    {SEERR_STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label || "All Statuses"}
                                </span>
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                            </Listbox.Button>
                            <Listbox.Options className="absolute z-10 mt-1 right-0 w-36 border border-slate-700/50 bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 max-h-60 overflow-auto scrollbar-hover-only focus:outline-none">
                                {SEERR_STATUS_OPTIONS.map((option) => (
                                    <Listbox.Option
                                        key={String(option.value)}
                                        value={option.value}
                                        className="px-3 py-2 cursor-pointer transition-all duration-150 text-xs text-slate-300 hover:text-white hover:bg-primary/10 data-[selected]:bg-primary/20 data-[selected]:text-white flex items-center justify-between"
                                    >
                                        {({ selected }) => (
                                            <>
                                                <span className={selected ? "font-semibold" : ""}>
                                                    {option.label}
                                                </span>
                                                {selected && <Check className="h-3 w-3 text-primary" />}
                                            </>
                                        )}
                                    </Listbox.Option>
                                ))}
                            </Listbox.Options>
                        </div>
                    </Listbox>

                    {/* Navigation Arrows (hidden when only 1 page) */}
                    {PAGES.length > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigatePage("prev")}
                                className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all duration-200"
                                title="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => navigatePage("next")}
                                className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all duration-200"
                                title="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Requests List */}
            {requestsLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <SkeletonItem key={idx} />
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-400">
                    No requests found
                    {statusFilter !== "all" && " for this status"}
                </div>
            ) : (
                <ul className="space-y-2 max-h-[440px] overflow-y-auto scrollbar-hover-only pr-1">
                    {requests.map((request) => (
                        <li
                            key={request.id}
                            className="group flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-800/30 p-2.5 hover:border-slate-700 hover:bg-slate-800/50 transition-all duration-200"
                        >
                            {/* Media type icon */}
                            <div className="pt-1">
                                <MediaTypeIcon type={request.media.mediaType} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-white truncate" title={request.media.title}>
                                        {request.media.title}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        {/* Approve button for pending requests */}
                                        {request.status === 1 && (
                                            <button
                                                onClick={() => handleApprove(request.id)}
                                                disabled={approvingId === request.id}
                                                className="p-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                                title="Approve request"
                                            >
                                                {approvingId === request.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        )}
                                        <StatusPill status={request.status} label={request.statusLabel} />
                                    </div>
                                </div>

                                <div className="text-xs text-slate-400">
                                    <span>Requested by {request.requestedBy.username}</span>
                                    <span className="mx-1">·</span>
                                    <span>{timeAgo(request.createdAt)}</span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* Dot Indicators (hidden when only 1 page) */}
            {PAGES.length > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    {PAGES.map((page) => (
                        <button
                            key={page.id}
                            onClick={() => setActivePage(page.id)}
                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                activePage === page.id
                                    ? "bg-primary w-4"
                                    : "bg-slate-600 hover:bg-slate-500"
                            }`}
                            title={page.title}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
