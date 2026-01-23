// Shared integration types

export type SyncStatus = "success" | "error" | "pending" | "never_synced";
export type TestStatus = "idle" | "testing" | "success" | "error";

// Generic source (identical for Trakt, Letterboxd, MDBList)
export interface Source {
    name: string;
    url: string;
    plex_library: string;
}

// Generic source status (identical for all list-based integrations)
export interface SourceStatus {
    source_index: number;
    name: string;
    last_sync_time: string | null;
    sync_status: SyncStatus;
    error_message: string | null;
    items_matched: number;
    items_total: number;
}

// Base missing item (shared fields)
export interface BaseMissingItem {
    title: string;
    year: number | null;
    first_seen: string;
    last_seen: string;
    times_seen: number;
}

// Trakt-specific missing item
export interface TraktMissingItem extends BaseMissingItem {
    trakt_id: number | null;
    slug: string | null;
    imdb_id: string | null;
    tmdb_id: number | null;
}

// Letterboxd-specific missing item
export interface LetterboxdMissingItem extends BaseMissingItem {
    slug: string;
    letterboxd_url: string | null;
}

// MDBList-specific missing item
export interface MDBListMissingItem extends BaseMissingItem {
    imdb_id: string | null;
    tmdb_id: number | null;
    trakt_id: number | null;
    mdblist_id: string | null;
}

// Settings types
export interface TraktSettings {
    enabled: boolean;
    client_id: string;
    base_url: string;
    sources?: Source[];
}

export interface MDBListSettings {
    enabled: boolean;
    api_key: string;
    base_url: string;
    sources?: Source[];
}

export interface TautulliSettings {
    enabled: boolean;
    api_key: string;
    base_url: string;
    collect_on_rotation: boolean;
    collect_interval_hours: number;
}

export interface SeerrSettings {
    enabled: boolean;
    api_key: string;
    base_url: string;
}

export interface PlexLibraryConfig {
    name: string;
    enabled: boolean;
}

export interface PlexSettings {
    base_url: string;
    token: string;
    libraries: PlexLibraryConfig[];
}

// API response types
export interface ConfigSaveResponse {
    ok: boolean;
    path: string;
    message: string;
    env_override: boolean;
}

export interface HealthComponent {
    ok: boolean;
    error?: string | null;
}
