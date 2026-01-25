import { useState, useEffect, useCallback, useMemo } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import {
    widgetRegistry,
    defaultVisibleWidgets,
    STATUS_BAR_MAX_WIDGETS,
    type WidgetSection,
} from "../widgets/registry";

const STORAGE_KEY = "dashboard.layout";
const LAYOUT_VERSION = 2;

// V1 schema (for migration)
interface WidgetVisibilityV1 {
    id: string;
    visible: boolean;
}

interface DashboardLayoutConfigV1 {
    version: number;
    widgets: WidgetVisibilityV1[];
}

// V2 schema (current)
interface SectionConfig {
    order: string[];  // Widget IDs in display order
    hidden: string[]; // Widget IDs that are hidden
}

interface DashboardLayoutConfigV2 {
    version: number;
    statusBar: SectionConfig;
    main: SectionConfig;
}

interface IntegrationStatus {
    tautulli: boolean;
    seerr: boolean;
}

// Get all widget IDs for a section from registry
function getRegistryWidgetIds(section: WidgetSection): string[] {
    return Object.values(widgetRegistry)
        .filter((w) => w.section === section)
        .map((w) => w.id);
}

// Get default hidden widgets for a section
function getDefaultHiddenForSection(section: WidgetSection): string[] {
    return getRegistryWidgetIds(section).filter(
        (id) => !defaultVisibleWidgets.includes(id)
    );
}

function getDefaultConfig(): DashboardLayoutConfigV2 {
    return {
        version: LAYOUT_VERSION,
        statusBar: {
            order: getRegistryWidgetIds("status-bar"),
            hidden: getDefaultHiddenForSection("status-bar"),
        },
        main: {
            order: getRegistryWidgetIds("main"),
            hidden: getDefaultHiddenForSection("main"),
        },
    };
}

// Migrate v1 config to v2
function migrateV1toV2(v1Config: DashboardLayoutConfigV1): DashboardLayoutConfigV2 {
    const statusBarWidgets = v1Config.widgets.filter(
        (w) => widgetRegistry[w.id]?.section === "status-bar"
    );
    const mainWidgets = v1Config.widgets.filter(
        (w) => widgetRegistry[w.id]?.section === "main"
    );

    return {
        version: LAYOUT_VERSION,
        statusBar: {
            order: statusBarWidgets.map((w) => w.id),
            hidden: statusBarWidgets.filter((w) => !w.visible).map((w) => w.id),
        },
        main: {
            order: mainWidgets.map((w) => w.id),
            hidden: mainWidgets.filter((w) => !w.visible).map((w) => w.id),
        },
    };
}

// Ensure config has all widgets from registry (handles new widgets added later)
function ensureAllWidgets(config: DashboardLayoutConfigV2): DashboardLayoutConfigV2 {
    const statusBarIds = getRegistryWidgetIds("status-bar");
    const mainIds = getRegistryWidgetIds("main");

    // Add any new status bar widgets
    for (const id of statusBarIds) {
        if (!config.statusBar.order.includes(id)) {
            config.statusBar.order.push(id);
            config.statusBar.hidden.push(id); // Default new widgets to hidden
        }
    }

    // Add any new main widgets
    for (const id of mainIds) {
        if (!config.main.order.includes(id)) {
            config.main.order.push(id);
            config.main.hidden.push(id); // Default new widgets to hidden
        }
    }

    // Remove widgets that no longer exist in registry
    config.statusBar.order = config.statusBar.order.filter((id) => widgetRegistry[id]);
    config.statusBar.hidden = config.statusBar.hidden.filter((id) => widgetRegistry[id]);
    config.main.order = config.main.order.filter((id) => widgetRegistry[id]);
    config.main.hidden = config.main.hidden.filter((id) => widgetRegistry[id]);

    return config;
}

function loadFromStorage(): DashboardLayoutConfigV2 | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const parsed = JSON.parse(stored);

        // Handle v1 migration
        if (parsed.version === 1 && parsed.widgets) {
            const migrated = migrateV1toV2(parsed as DashboardLayoutConfigV1);
            return ensureAllWidgets(migrated);
        }

        // Handle v2
        if (parsed.version === LAYOUT_VERSION) {
            return ensureAllWidgets(parsed as DashboardLayoutConfigV2);
        }

        // Unknown version - reset to defaults
        return null;
    } catch {
        return null;
    }
}

function saveToStorage(config: DashboardLayoutConfigV2): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
        // Ignore storage errors
    }
}

export function useDashboardLayout(integrationStatus: IntegrationStatus) {
    const [config, setConfig] = useState<DashboardLayoutConfigV2>(() => {
        return loadFromStorage() ?? getDefaultConfig();
    });

    const [isEditMode, setIsEditMode] = useState(false);

    // Persist changes to localStorage
    useEffect(() => {
        saveToStorage(config);
    }, [config]);

    const toggleEditMode = useCallback(() => {
        setIsEditMode((prev) => !prev);
    }, []);

    const toggleVisibility = useCallback((widgetId: string) => {
        const widget = widgetRegistry[widgetId];
        if (!widget) return;

        const section = widget.section === "status-bar" ? "statusBar" : "main";

        setConfig((prev) => {
            const sectionConfig = prev[section];
            const isCurrentlyHidden = sectionConfig.hidden.includes(widgetId);

            return {
                ...prev,
                [section]: {
                    ...sectionConfig,
                    hidden: isCurrentlyHidden
                        ? sectionConfig.hidden.filter((id) => id !== widgetId)
                        : [...sectionConfig.hidden, widgetId],
                },
            };
        });
    }, []);

    const setVisibility = useCallback((widgetId: string, visible: boolean) => {
        const widget = widgetRegistry[widgetId];
        if (!widget) return;

        const section = widget.section === "status-bar" ? "statusBar" : "main";

        setConfig((prev) => {
            const sectionConfig = prev[section];
            const isCurrentlyHidden = sectionConfig.hidden.includes(widgetId);

            if (visible && isCurrentlyHidden) {
                // Make visible (remove from hidden)
                return {
                    ...prev,
                    [section]: {
                        ...sectionConfig,
                        hidden: sectionConfig.hidden.filter((id) => id !== widgetId),
                    },
                };
            } else if (!visible && !isCurrentlyHidden) {
                // Hide (add to hidden)
                return {
                    ...prev,
                    [section]: {
                        ...sectionConfig,
                        hidden: [...sectionConfig.hidden, widgetId],
                    },
                };
            }

            return prev;
        });
    }, []);

    const resetToDefaults = useCallback(() => {
        const defaultConfig = getDefaultConfig();
        setConfig(defaultConfig);
        setIsEditMode(false);
    }, []);

    // Reorder widgets within a section
    const reorderWidgets = useCallback(
        (section: WidgetSection, activeId: string, overId: string) => {
            const sectionKey = section === "status-bar" ? "statusBar" : "main";

            setConfig((prev) => {
                const sectionConfig = prev[sectionKey];
                const oldIndex = sectionConfig.order.indexOf(activeId);
                const newIndex = sectionConfig.order.indexOf(overId);

                if (oldIndex === -1 || newIndex === -1) return prev;

                const newOrder = arrayMove(sectionConfig.order, oldIndex, newIndex);

                return {
                    ...prev,
                    [sectionKey]: {
                        ...sectionConfig,
                        order: newOrder,
                    },
                };
            });
        },
        []
    );

    const reorderStatusBarWidgets = useCallback(
        (activeId: string, overId: string) => {
            reorderWidgets("status-bar", activeId, overId);
        },
        [reorderWidgets]
    );

    const reorderMainWidgets = useCallback(
        (activeId: string, overId: string) => {
            reorderWidgets("main", activeId, overId);
        },
        [reorderWidgets]
    );

    // Check if a widget is available (integration enabled if required)
    const isWidgetAvailable = useCallback(
        (widgetId: string): boolean => {
            const widget = widgetRegistry[widgetId];
            if (!widget) return false;

            if (widget.requiresIntegration) {
                return integrationStatus[widget.requiresIntegration] ?? false;
            }

            return true;
        },
        [integrationStatus]
    );

    // Get visibility map for quick lookups
    const visibilityMap = useMemo(() => {
        const map: Record<string, boolean> = {};

        for (const id of config.statusBar.order) {
            map[id] = !config.statusBar.hidden.includes(id);
        }
        for (const id of config.main.order) {
            map[id] = !config.main.hidden.includes(id);
        }

        return map;
    }, [config]);

    // Count enabled status bar widgets
    const enabledStatusBarCount = useMemo(() => {
        return config.statusBar.order.filter((id) => {
            return (
                !config.statusBar.hidden.includes(id) &&
                isWidgetAvailable(id)
            );
        }).length;
    }, [config.statusBar, isWidgetAvailable]);

    // Check if status bar is at max capacity
    const isStatusBarFull = enabledStatusBarCount >= STATUS_BAR_MAX_WIDGETS;

    // Check if a widget can be enabled (respects status bar limit)
    const canEnableWidget = useCallback(
        (widgetId: string): boolean => {
            const widget = widgetRegistry[widgetId];
            if (!widget) return false;

            // If it's already visible, it can be toggled off
            if (visibilityMap[widgetId]) return true;

            // If it's a status bar widget and we're at max, can't enable
            if (widget.section === "status-bar" && isStatusBarFull) {
                return false;
            }

            return true;
        },
        [visibilityMap, isStatusBarFull]
    );

    // Get visible widgets by section (respects order)
    const getVisibleWidgetsBySection = useCallback(
        (section: WidgetSection): string[] => {
            const sectionKey = section === "status-bar" ? "statusBar" : "main";
            const sectionConfig = config[sectionKey];

            return sectionConfig.order.filter((id) => {
                return (
                    !sectionConfig.hidden.includes(id) &&
                    isWidgetAvailable(id)
                );
            });
        },
        [config, isWidgetAvailable]
    );

    // Get list of visible widget IDs (only those that are both visible AND available)
    const visibleWidgets = useMemo(() => {
        return [
            ...getVisibleWidgetsBySection("status-bar"),
            ...getVisibleWidgetsBySection("main"),
        ];
    }, [getVisibleWidgetsBySection]);

    // Separate visible widgets by section
    const visibleStatusBarWidgets = getVisibleWidgetsBySection("status-bar");
    const visibleMainWidgets = getVisibleWidgetsBySection("main");

    // Full order arrays (including hidden, for DnD)
    const statusBarOrder = config.statusBar.order;
    const mainOrder = config.main.order;

    return {
        config,
        visibilityMap,
        visibleWidgets,
        visibleStatusBarWidgets,
        visibleMainWidgets,
        toggleVisibility,
        setVisibility,
        resetToDefaults,
        isWidgetAvailable,
        canEnableWidget,
        enabledStatusBarCount,
        isStatusBarFull,
        // New for drag-and-drop
        isEditMode,
        setIsEditMode,
        toggleEditMode,
        reorderStatusBarWidgets,
        reorderMainWidgets,
        statusBarOrder,
        mainOrder,
    };
}
