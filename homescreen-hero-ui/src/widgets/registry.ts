export type WidgetCategory = "health" | "analytics" | "activity" | "integrations";
export type WidgetSection = "status-bar" | "main";
export type RequiredIntegration = "tautulli" | "seerr";

export interface WidgetDefinition {
    id: string;
    name: string;
    description: string;
    category: WidgetCategory;
    section: WidgetSection;
    requiresIntegration?: RequiredIntegration;
    colSpan?: number; // 1 = single column, 2 = two columns, 4 = full width
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
    // Status bar widgets (max 4 visible)
    "plex-health": {
        id: "plex-health",
        name: "Plex Health",
        description: "Plex server connection status",
        category: "health",
        section: "status-bar",
    },
    "active-streams": {
        id: "active-streams",
        name: "Active Streams",
        description: "Currently active Plex streams",
        category: "activity",
        section: "status-bar",
    },
    "integrations-health": {
        id: "integrations-health",
        name: "Integrations Health",
        description: "Status of all configured integrations",
        category: "health",
        section: "status-bar",
    },
    "rotation-status": {
        id: "rotation-status",
        name: "Rotation Status",
        description: "Auto-rotation scheduler status and countdown",
        category: "health",
        section: "status-bar",
    },

    // Main grid widgets
    "active-collections": {
        id: "active-collections",
        name: "Active Collections",
        description: "Currently featured collections on your Plex home",
        category: "activity",
        section: "main",
        colSpan: 4,
    },
    "analytics": {
        id: "analytics",
        name: "Top Collections",
        description: "Most played collections from Tautulli",
        category: "analytics",
        section: "main",
        requiresIntegration: "tautulli",
    },
    "most-active-users": {
        id: "most-active-users",
        name: "Most Active Users",
        description: "Top users by play count",
        category: "analytics",
        section: "main",
        requiresIntegration: "tautulli",
    },
    "graph-carousel": {
        id: "graph-carousel",
        name: "Analytics Graphs",
        description: "Streaming activity charts and visualizations",
        category: "analytics",
        section: "main",
        requiresIntegration: "tautulli",
        colSpan: 2,
    },
    "recent-rotations": {
        id: "recent-rotations",
        name: "Recent Rotations",
        description: "History of collection rotations",
        category: "activity",
        section: "main",
        colSpan: 2,
    },
    "seerr-carousel": {
        id: "seerr-carousel",
        name: "Seerr Requests",
        description: "Recent media requests and quick search",
        category: "integrations",
        section: "main",
        requiresIntegration: "seerr",
        colSpan: 2,
    },
};

// Section configuration
export const STATUS_BAR_MAX_WIDGETS = 4;

export const sectionInfo: Record<WidgetSection, { label: string; order: number; description?: string }> = {
    "status-bar": { label: "Status Bar", order: 1, description: "Top row (max 4)" },
    main: { label: "Main Dashboard", order: 2 },
};

// Category display order and labels
export const categoryInfo: Record<WidgetCategory, { label: string; order: number }> = {
    health: { label: "Health & Status", order: 1 },
    activity: { label: "Activity", order: 2 },
    analytics: { label: "Analytics", order: 3 },
    integrations: { label: "Integrations", order: 4 },
};

// Default visible widgets (Status bar + Active Collections)
export const defaultVisibleWidgets = [
    "plex-health",
    "active-streams",
    "integrations-health",
    "rotation-status",
    "active-collections",
];

// Get widgets grouped by category
export function getWidgetsByCategory(): Record<WidgetCategory, WidgetDefinition[]> {
    const grouped: Record<WidgetCategory, WidgetDefinition[]> = {
        health: [],
        analytics: [],
        activity: [],
        integrations: [],
    };

    for (const widget of Object.values(widgetRegistry)) {
        grouped[widget.category].push(widget);
    }

    return grouped;
}

// Get widgets grouped by section
export function getWidgetsBySection(): Record<WidgetSection, WidgetDefinition[]> {
    const grouped: Record<WidgetSection, WidgetDefinition[]> = {
        "status-bar": [],
        main: [],
    };

    for (const widget of Object.values(widgetRegistry)) {
        grouped[widget.section].push(widget);
    }

    return grouped;
}

// Get all status bar widget IDs
export function getStatusBarWidgetIds(): string[] {
    return Object.values(widgetRegistry)
        .filter((w) => w.section === "status-bar")
        .map((w) => w.id);
}
