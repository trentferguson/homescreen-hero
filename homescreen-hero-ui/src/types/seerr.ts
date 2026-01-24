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

// Detailed media info for modal
export type SeerrMediaDetail = {
    mediaType: "movie" | "tv" | "unknown";
    title: string;
    posterPath: string | null;
    backdropPath: string | null;
    overview: string | null;
    releaseDate: string | null;
    voteAverage: number | null;
    tmdbId: number | null;
    rottenTomatoesCriticScore: number | null;
    rottenTomatoesAudienceScore: number | null;
};

// Detailed request for modal
export type SeerrRequestDetail = {
    id: number;
    media: SeerrMediaDetail;
    status: SeerrRequestStatus;
    statusLabel: string;
    createdAt: string;
    updatedAt: string | null;
    requestedBy: SeerrRequestedBy;
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

// Media status from Overseerr (different from request display status)
// 1=Unknown, 2=Pending, 3=Processing, 4=Partial, 5=Available
export type SeerrMediaStatus = 1 | 2 | 3 | 4 | 5;

export const SEERR_MEDIA_STATUS_LABELS: Record<SeerrMediaStatus, string> = {
    1: "Not Requested",
    2: "Requested",
    3: "Processing",
    4: "Partially Available",
    5: "Available",
};

export const SEERR_MEDIA_STATUS_COLORS: Record<SeerrMediaStatus, { bg: string; text: string; border: string }> = {
    1: { bg: "bg-slate-500/15", text: "text-slate-300", border: "ring-slate-500/30" },
    2: { bg: "bg-amber-500/15", text: "text-amber-300", border: "ring-amber-500/30" },
    3: { bg: "bg-purple-500/15", text: "text-purple-300", border: "ring-purple-500/30" },
    4: { bg: "bg-orange-500/15", text: "text-orange-300", border: "ring-orange-500/30" },
    5: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "ring-emerald-500/30" },
};

// Search result from API
export type SeerrSearchResult = {
    mediaType: "movie" | "tv";
    title: string;
    posterPath: string | null;
    releaseDate: string | null;
    voteAverage: number | null;
    tmdbId: number;
    mediaStatus: SeerrMediaStatus | null;
};

export type SeerrSearchResponse = {
    results: SeerrSearchResult[];
    totalResults: number;
    totalPages: number;
    page: number;
};

// Quality profiles for request creation
export type QualityProfile = {
    id: number;
    name: string;
};

export type RootFolder = {
    id: number;
    path: string;
};

export type ServiceInfo = {
    id: number;
    name: string;
    isDefault: boolean;
    profiles: QualityProfile[];
    rootFolders: RootFolder[];
};

export type ServicesResponse = {
    radarr: ServiceInfo[];
    sonarr: ServiceInfo[];
};

// Season info for TV requests
export type SeasonInfo = {
    seasonNumber: number;
    name: string;
    episodeCount: number;
    airDate: string | null;
    status: SeerrMediaStatus | null;
};

// Request creation payload
export type CreateRequestPayload = {
    mediaType: "movie" | "tv";
    mediaId: number;
    seasons?: number[];
    serverId?: number;
    profileId?: number;
    rootFolder?: string;
};

export type CreateRequestResponse = {
    success: boolean;
    message: string;
    requestId: number | null;
};
