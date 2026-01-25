import { useState, useEffect, useCallback, useMemo } from "react";
import {
    widgetRegistry,
    defaultVisibleWidgets,
    STATUS_BAR_MAX_WIDGETS,
    type WidgetSection,
} from "../widgets/registry";

const STORAGE_KEY = "dashboard.layout";
const LAYOUT_VERSION = 1;

export interface WidgetVisibility {
    id: string;
    visible: boolean;
}

interface DashboardLayoutConfig {
    version: number;
    widgets: WidgetVisibility[];
}

interface IntegrationStatus {
    tautulli: boolean;
    seerr: boolean;
}

function getDefaultConfig(): DashboardLayoutConfig {
    return {
        version: LAYOUT_VERSION,
        widgets: Object.keys(widgetRegistry).map((id) => ({
            id,
            visible: defaultVisibleWidgets.includes(id),
        })),
    };
}

function loadFromStorage(): DashboardLayoutConfig | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const parsed: DashboardLayoutConfig = JSON.parse(stored);

        // Version mismatch - reset to defaults
        if (parsed.version !== LAYOUT_VERSION) {
            return null;
        }

        // Ensure all widgets from registry exist in config (handles new widgets added later)
        const existingIds = new Set(parsed.widgets.map((w) => w.id));
        const registryIds = Object.keys(widgetRegistry);

        for (const id of registryIds) {
            if (!existingIds.has(id)) {
                // New widget added to registry - default to hidden
                parsed.widgets.push({ id, visible: false });
            }
        }

        // Filter out widgets that no longer exist in registry
        parsed.widgets = parsed.widgets.filter((w) => widgetRegistry[w.id]);

        return parsed;
    } catch {
        return null;
    }
}

function saveToStorage(config: DashboardLayoutConfig): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
        // Ignore storage errors
    }
}

export function useDashboardLayout(integrationStatus: IntegrationStatus) {
    const [config, setConfig] = useState<DashboardLayoutConfig>(() => {
        return loadFromStorage() ?? getDefaultConfig();
    });

    // Persist changes to localStorage
    useEffect(() => {
        saveToStorage(config);
    }, [config]);

    const toggleVisibility = useCallback((widgetId: string) => {
        setConfig((prev) => ({
            ...prev,
            widgets: prev.widgets.map((w) =>
                w.id === widgetId ? { ...w, visible: !w.visible } : w
            ),
        }));
    }, []);

    const setVisibility = useCallback((widgetId: string, visible: boolean) => {
        setConfig((prev) => ({
            ...prev,
            widgets: prev.widgets.map((w) =>
                w.id === widgetId ? { ...w, visible } : w
            ),
        }));
    }, []);

    const resetToDefaults = useCallback(() => {
        const defaultConfig = getDefaultConfig();
        setConfig(defaultConfig);
    }, []);

    // Get visibility map for quick lookups
    const visibilityMap = config.widgets.reduce<Record<string, boolean>>(
        (acc, w) => {
            acc[w.id] = w.visible;
            return acc;
        },
        {}
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

    // Count enabled status bar widgets
    const enabledStatusBarCount = useMemo(() => {
        return config.widgets.filter((w) => {
            const widget = widgetRegistry[w.id];
            return widget?.section === "status-bar" && w.visible && isWidgetAvailable(w.id);
        }).length;
    }, [config.widgets, isWidgetAvailable]);

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

    // Get visible widgets by section
    const getVisibleWidgetsBySection = useCallback(
        (section: WidgetSection): string[] => {
            return config.widgets
                .filter((w) => {
                    const widget = widgetRegistry[w.id];
                    return (
                        widget?.section === section &&
                        w.visible &&
                        isWidgetAvailable(w.id)
                    );
                })
                .map((w) => w.id);
        },
        [config.widgets, isWidgetAvailable]
    );

    // Get list of visible widget IDs (only those that are both visible AND available)
    const visibleWidgets = config.widgets
        .filter((w) => w.visible && isWidgetAvailable(w.id))
        .map((w) => w.id);

    // Separate visible widgets by section
    const visibleStatusBarWidgets = getVisibleWidgetsBySection("status-bar");
    const visibleMainWidgets = getVisibleWidgetsBySection("main");

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
    };
}
