from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

from homescreen_hero.core.config.schema import (
    PlexSettings,
    RotationSettings,
    TraktSettings,
    TraktSource,
    LetterboxdSettings,
    LetterboxdSource,
    MDBListSettings,
    MDBListSource,
    AniListSettings,
    AniListSource,
    TautulliSettings,
    SeerrSettings,
    CollectionGroupConfig,
    DisplaySettings,
)


class ConfigFileResponse(BaseModel):
    path: str
    content: str


class ConfigSaveResponse(BaseModel):
    ok: bool
    path: str
    message: str
    env_override: bool


class ConfigUpdateRequest(BaseModel):
    content: str


class GroupValidationResult(BaseModel):
    name: str
    collections: List[str]
    ok: bool
    issues: List[str]


# Incoming payload for Plex settings updates.
class PlexConfigSaveRequest(PlexSettings):
    pass


# Incoming payload for Trakt settings updates.
class TraktConfigSaveRequest(TraktSettings):
    pass


# Incoming payload for Trakt source create/update operations.
class TraktSourcePayload(TraktSource):
    pass


# Incoming payload for Letterboxd settings updates.
class LetterboxdConfigSaveRequest(LetterboxdSettings):
    pass


# Incoming payload for Letterboxd source create/update operations.
class LetterboxdSourcePayload(LetterboxdSource):
    pass


# Incoming payload for MDBList settings updates.
class MDBListConfigSaveRequest(MDBListSettings):
    pass


# Incoming payload for MDBList source create/update operations.
class MDBListSourcePayload(MDBListSource):
    pass


# Incoming payload for AniList settings updates.
class AniListConfigSaveRequest(AniListSettings):
    pass


# Incoming payload for AniList source create/update operations.
class AniListSourcePayload(AniListSource):
    pass


# Incoming payload for Tautulli settings updates.
class TautulliConfigSaveRequest(TautulliSettings):
    pass


# Incoming payload for Seerr settings updates.
class SeerrConfigSaveRequest(SeerrSettings):
    pass


# Group payload used for create/update operations.
class CollectionGroupPayload(CollectionGroupConfig):
    pass


# Incoming payload for rotation settings updates.
class RotationConfigSaveRequest(RotationSettings):
    pass


# Incoming payload for display settings updates.
class DisplaySettingsSaveRequest(DisplaySettings):
    pass


# Incoming payload for reordering groups.
class GroupReorderRequest(BaseModel):
    ordered_group_names: List[str]


class CollectionSourcesResponse(BaseModel):
    class CollectionSource(BaseModel):
        name: str
        source: Literal["plex", "trakt", "letterboxd", "mdblist", "anilist"]
        detail: Optional[str] = None

    plex: List[CollectionSource]
    trakt: List[CollectionSource]
    letterboxd: List[CollectionSource]
    mdblist: List[CollectionSource]
    anilist: List[CollectionSource]


# Status information for a Trakt source including sync history.
class TraktSourceStatus(BaseModel):
    source_index: int
    name: str
    last_sync_time: Optional[datetime] = None
    sync_status: Literal["success", "error", "pending", "never_synced"]
    error_message: Optional[str] = None
    items_matched: int = 0
    items_total: int = 0


# Response from manual Trakt sync operation.
class TraktSyncResponse(BaseModel):
    ok: bool
    message: str
    items_total: int
    items_matched: int
    items_missing: int
    sync_time: datetime


# A Trakt item that wasn't found in Plex.
class TraktMissingItemOut(BaseModel):
    title: str
    year: Optional[int]
    trakt_id: Optional[int]
    slug: Optional[str]
    imdb_id: Optional[str]
    tmdb_id: Optional[int]
    first_seen: datetime
    last_seen: datetime
    times_seen: int


# Status information for a Letterboxd source including sync history.
class LetterboxdSourceStatus(BaseModel):
    source_index: int
    name: str
    last_sync_time: Optional[datetime] = None
    sync_status: Literal["success", "error", "pending", "never_synced"]
    error_message: Optional[str] = None
    items_matched: int = 0
    items_total: int = 0


# Response from manual Letterboxd sync operation.
class LetterboxdSyncResponse(BaseModel):
    ok: bool
    message: str
    items_total: int
    items_matched: int
    items_missing: int
    sync_time: datetime


# A Letterboxd item that wasn't found in Plex.
class LetterboxdMissingItemOut(BaseModel):
    title: str
    year: Optional[int]
    slug: str
    letterboxd_url: Optional[str]
    first_seen: datetime
    last_seen: datetime
    times_seen: int


# Status information for an MDBList source including sync history.
class MDBListSourceStatus(BaseModel):
    source_index: int
    name: str
    last_sync_time: Optional[datetime] = None
    sync_status: Literal["success", "error", "pending", "never_synced"]
    error_message: Optional[str] = None
    items_matched: int = 0
    items_total: int = 0


# Response from manual MDBList sync operation.
class MDBListSyncResponse(BaseModel):
    ok: bool
    message: str
    items_total: int
    items_matched: int
    items_missing: int
    sync_time: datetime


# An MDBList item that wasn't found in Plex.
class MDBListMissingItemOut(BaseModel):
    title: str
    year: Optional[int]
    imdb_id: Optional[str]
    tmdb_id: Optional[int]
    trakt_id: Optional[int]
    mdblist_id: Optional[str]
    first_seen: datetime
    last_seen: datetime
    times_seen: int


# Status information for an AniList source including sync history.
class AniListSourceStatus(BaseModel):
    source_index: int
    name: str
    last_sync_time: Optional[datetime] = None
    sync_status: Literal["success", "error", "pending", "never_synced"]
    error_message: Optional[str] = None
    items_matched: int = 0
    items_total: int = 0


# Response from manual AniList sync operation.
class AniListSyncResponse(BaseModel):
    ok: bool
    message: str
    items_total: int
    items_matched: int
    items_missing: int
    sync_time: datetime


# An AniList item that wasn't found in Plex.
class AniListMissingItemOut(BaseModel):
    title: str
    year: Optional[int]
    media_format: Optional[str]
    anilist_id: Optional[int]
    mal_id: Optional[int]
    tmdb_id: Optional[int]
    imdb_id: Optional[str]
    tvdb_id: Optional[int]
    first_seen: datetime
    last_seen: datetime
    times_seen: int


# Quick start setup endpoints
class ConfigExistsResponse(BaseModel):
    exists: bool
    is_configured: bool
    path: str


# Check which configuration values are provided via environment variables.
class EnvVarsResponse(BaseModel):
    plex_token_from_env: bool
    plex_url_from_env: bool
    auth_password_from_env: bool
    auth_secret_from_env: bool
    trakt_client_id_from_env: bool
    mdblist_api_key_from_env: bool
    tautulli_api_key_from_env: bool
    tautulli_url_from_env: bool
    seerr_api_key_from_env: bool
    seerr_url_from_env: bool


# Request payload for testing Trakt connection with provided credentials.
class TraktTestRequest(BaseModel):
    client_id: Optional[str] = None  # Falls back to HSH_TRAKT_CLIENT_ID env var
    base_url: str = "https://api.trakt.tv"


# Request payload for testing MDBList connection with provided credentials.
class MDBListTestRequest(BaseModel):
    api_key: Optional[str] = None  # Falls back to HSH_MDBLIST_API_KEY env var
    base_url: str = "https://api.mdblist.com"


# Request payload for testing Tautulli connection with provided credentials.
class TautulliTestRequest(BaseModel):
    api_key: Optional[str] = None  # Falls back to HSH_TAUTULLI_API_KEY env var
    base_url: str = "http://localhost:8181"  # Falls back to HSH_TAUTULLI_BASE_URL env var


# Request payload for testing Seerr connection with provided credentials.
class SeerrTestRequest(BaseModel):
    api_key: Optional[str] = None  # Falls back to HSH_SEERR_API_KEY env var
    base_url: str = "http://localhost:5055"  # Falls back to HSH_SEERR_BASE_URL env var


# Response for connection test endpoints.
class ConnectionTestResponse(BaseModel):
    ok: bool
    error: Optional[str] = None


# Incoming payload for quick start setup.
class QuickStartRequest(BaseModel):
    plex_url: str
    plex_token: str
    trakt_enabled: bool = False
    trakt_client_id: Optional[str] = None
    trakt_base_url: str = "https://api.trakt.tv"
    mdblist_enabled: bool = False
    mdblist_api_key: Optional[str] = None
    mdblist_base_url: str = "https://api.mdblist.com"
    tautulli_enabled: bool = False
    tautulli_api_key: Optional[str] = None
    tautulli_base_url: str = "http://localhost:8181"
    seerr_enabled: bool = False
    seerr_api_key: Optional[str] = None
    seerr_base_url: str = "http://localhost:5055"
    libraries: List[str] = []
    auth_enabled: bool = False
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None
    rotation_enabled: bool = False
    rotation_interval_hours: int = 12
    rotation_max_collections: int = 5
    rotation_strategy: str = "random"
    rotation_allow_repeats: bool = False


class ConfigValidateResponse(BaseModel):
    ok: bool
    message: str


class ConfigImportResponse(BaseModel):
    ok: bool
    message: str
    backup_path: Optional[str] = None
    env_override: bool


class BackupStatusResponse(BaseModel):
    exists: bool
    modified_at: Optional[str] = None
