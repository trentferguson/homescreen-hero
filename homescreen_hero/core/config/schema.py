from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DateRange(BaseModel):
    # Represents a yearly date window like 11-20 to 12-26.
    start: str = Field(..., description="Start date in MM-DD format, e.g. '11-20'")
    end: str = Field(..., description="End date in MM-DD format, e.g. '12-26'")


class PlexSettings(BaseModel):
    # Plex connection details.
    base_url: str = Field(..., description="Base URL of your Plex server")
    token: Optional[str] = Field(
        default=None,
        description="Plex API token (can be set via HSH_PLEX_TOKEN env var)",
    )
    library_name: str = Field(..., description="Name of the Plex library to use")


class RotationSettings(BaseModel):
    # Global settings for how rotations are performed.
    enabled: bool = Field(default=True)
    interval_hours: int = Field(
        default=12,
        ge=1,
        description="How often to rotate featured collections (in hours)",
    )
    max_collections: int = Field(
        default=5,
        ge=1,
        description="Global cap on how many collections are featured at once",
    )
    strategy: str = Field(
        default="random",
        description="Selection strategy: 'random', 'weighted', etc.",
    )
    allow_repeats: bool = Field(
        default=False,
        description="Allow same collection to appear in consecutive rotations",
    )


class CollectionGroupConfig(BaseModel):
    name: str = Field(..., description="Name of this group (e.g. 'Christmas')")
    enabled: bool = Field(default=True)
    min_picks: int = Field(
        default=0,
        ge=0,
        description="Minimum number of collections to pick from this group per rotation",
    )
    max_picks: int = Field(
        default=1,
        ge=0,
        description="Maximum number of collections to pick from this group per rotation",
    )
    weight: int = Field(
        default=1,
        ge=1,
        description="Relative priority of this group vs other groups (future use)",
    )
    min_gap_rotations: int = Field(
        default=0,
        ge=0,
        description="Minimum number of rotations that must pass before reusing a collection from this group",
    )
    visibility_home: bool = Field(
        default=True,
        description="Promote collections to server admin's Home page",
    )
    visibility_shared: bool = Field(
        default=False,
        description="Promote collections to shared users' Home pages",
    )
    visibility_recommended: bool = Field(
        default=False,
        description="Promote collections to Library Recommended section",
    )
    date_range: Optional[DateRange] = Field(
        default=None,
        description="Optional yearly date window when this group is active",
    )
    collections: List[str] = Field(
        ...,
        min_items=1,
        description="List of Plex collection names belonging to this group",
    )


class LoggingSettings(BaseModel):
    level: str = Field(
        default="INFO",
        description="Logging level name (e.g. DEBUG, INFO, WARNING, ERROR)",
    )


class AuthSettings(BaseModel):
    # Authentication settings
    enabled: bool = Field(
        default=False,
        description="Whether authentication is required",
    )
    username: str = Field(
        default="admin",
        description="Username for authentication",
    )
    password: Optional[str] = Field(
        default=None,
        description="Password (can be set via HSH_AUTH_PASSWORD env var)",
    )
    secret_key: Optional[str] = Field(
        default=None,
        description="Secret key for JWT token signing (can be set via HSH_AUTH_SECRET_KEY env var)",
    )
    token_expire_days: int = Field(
        default=30,
        ge=1,
        description="Number of days before JWT tokens expire",
    )


class TraktSource(BaseModel):
    name: str
    url: str
    plex_library: str


class TraktSettings(BaseModel):
    # Trakt connection details.
    enabled: bool = Field(
        default=False,
        description="Whether Trakt integration is enabled",
    )
    client_id: Optional[str] = Field(
        default=None,
        description="Trakt application client id (can be set via HSH_TRAKT_CLIENT_ID env var)",
    )
    base_url: str = Field(
        "https://api.trakt.tv",
        description="Base URL for Trakt API",
    )
    sources: List[TraktSource] = Field(default_factory=list)


class AppConfig(BaseModel):
    # Root application configuration, loaded from config.yaml.
    plex: PlexSettings
    rotation: RotationSettings
    groups: List[CollectionGroupConfig]
    trakt: Optional[TraktSettings] = None
    logging: LoggingSettings = LoggingSettings()
    auth: Optional[AuthSettings] = None


class GroupSelectionResult(BaseModel):
    # Explanation of how a single group contributed to a rotation
    group_name: str
    active: bool
    min_picks: int
    max_picks: int

    available_collections: List[str] = Field(
        default_factory=list,
        description="Collections considered for this group BEFORE sampling",
    )
    chosen_collections: List[str] = Field(
        default_factory=list,
        description="Collections actually selected from this group",
    )

    picked_count: int = 0
    reason_skipped: Optional[str] = Field(
        default=None,
        description="If the group didn't contribute any picks, why?",
    )


class RotationResult(BaseModel):
    # Full explanation of a rotation decision.
    selected_collections: List[str]
    groups: List[GroupSelectionResult]
    max_global: int
    remaining_global: int
    today: date


class RotationExecution(BaseModel):
    # Represents one actual execution of a rotation against Plex
    rotation: RotationResult
    applied_collections: List[str]
    dry_run: bool
    simulation_id: Optional[int] = None


class RotationRecordOut(BaseModel):
    id: int
    created_at: datetime
    success: bool
    error_message: Optional[str] = None
    featured_collections: List[str]


class CollectionUsageOut(BaseModel):
    collection_name: str
    times_used: int
    last_rotation_id: Optional[int] = None
    last_rotated_at: Optional[datetime] = None


class ClearHistoryResponse(BaseModel):
    ok: bool
    message: str


class HealthComponent(BaseModel):
    ok: bool
    error: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    ok: bool
    components: Dict[str, HealthComponent]
