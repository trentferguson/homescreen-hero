// Display status codes (computed from request status + media status)
// 1=Pending, 2=Approved, 3=Declined, 4=Available, 5=Processing, 6=Partial
export type SeerrRequestStatus = 1 | 2 | 3 | 4 | 5 | 6;

export type SeerrRequestedBy = {
    username: string;
    avatar: string | null;
};

export type SeerrMedia = {
    mediaType: "movie" | "tv" | "unknown";
    title: string;
    posterPath: string | null;
};

export type SeerrRequest = {
    id: number;
    media: SeerrMedia;
    status: SeerrRequestStatus;
    statusLabel: string;
    createdAt: string;
    requestedBy: SeerrRequestedBy;
};

export type SeerrRequestsResponse = {
    requests: SeerrRequest[];
    totalResults: number;
};

// Status filter options for dropdown (string values for API)
export const SEERR_STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "available", label: "Available" },
    { value: "processing", label: "Processing" },
    { value: "unavailable", label: "Unavailable" },
    { value: "failed", label: "Failed" },
    { value: "deleted", label: "Deleted" },
    { value: "completed", label: "Completed" },
] as const;

// Status color mapping for pills (matches computed display status)
export const SEERR_STATUS_COLORS: Record<SeerrRequestStatus, { bg: string; text: string; border: string }> = {
    1: { bg: "bg-amber-500/15", text: "text-amber-300", border: "ring-amber-500/30" },      // Pending
    2: { bg: "bg-blue-500/15", text: "text-blue-300", border: "ring-blue-500/30" },         // Approved
    3: { bg: "bg-rose-500/15", text: "text-rose-300", border: "ring-rose-500/30" },         // Declined
    4: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "ring-emerald-500/30" }, // Available
    5: { bg: "bg-purple-500/15", text: "text-purple-300", border: "ring-purple-500/30" },   // Processing
    6: { bg: "bg-orange-500/15", text: "text-orange-300", border: "ring-orange-500/30" },   // Partial
};
