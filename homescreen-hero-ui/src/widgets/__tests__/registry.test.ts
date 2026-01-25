import { describe, it, expect } from "vitest";
import {
    widgetRegistry,
    defaultVisibleWidgets,
    STATUS_BAR_MAX_WIDGETS,
    getWidgetsByCategory,
    getWidgetsBySection,
    getStatusBarWidgetIds,
} from "../registry";

describe("widgetRegistry", () => {
    it("has all required widget properties", () => {
        for (const [id, widget] of Object.entries(widgetRegistry)) {
            expect(widget.id).toBe(id);
            expect(widget.name).toBeTruthy();
            expect(widget.description).toBeTruthy();
            expect(["health", "analytics", "activity", "integrations"]).toContain(widget.category);
            expect(["status-bar", "main"]).toContain(widget.section);
        }
    });

    it("has exactly 4 status bar widgets", () => {
        const statusBarWidgets = Object.values(widgetRegistry).filter(
            (w) => w.section === "status-bar"
        );
        expect(statusBarWidgets.length).toBe(STATUS_BAR_MAX_WIDGETS);
    });

    it("has default visible widgets that exist in registry", () => {
        for (const id of defaultVisibleWidgets) {
            expect(widgetRegistry[id]).toBeDefined();
        }
    });
});

describe("getWidgetsByCategory", () => {
    it("groups widgets by their category", () => {
        const grouped = getWidgetsByCategory();

        expect(grouped.health.length).toBeGreaterThan(0);
        expect(grouped.activity.length).toBeGreaterThan(0);

        // Verify widgets are in correct category
        for (const widget of grouped.health) {
            expect(widget.category).toBe("health");
        }
    });

    it("includes all widgets from registry", () => {
        const grouped = getWidgetsByCategory();
        const totalGrouped =
            grouped.health.length +
            grouped.analytics.length +
            grouped.activity.length +
            grouped.integrations.length;

        expect(totalGrouped).toBe(Object.keys(widgetRegistry).length);
    });
});

describe("getWidgetsBySection", () => {
    it("groups widgets by their section", () => {
        const grouped = getWidgetsBySection();

        expect(grouped["status-bar"].length).toBe(STATUS_BAR_MAX_WIDGETS);
        expect(grouped.main.length).toBeGreaterThan(0);

        // Verify widgets are in correct section
        for (const widget of grouped["status-bar"]) {
            expect(widget.section).toBe("status-bar");
        }
        for (const widget of grouped.main) {
            expect(widget.section).toBe("main");
        }
    });
});

describe("getStatusBarWidgetIds", () => {
    it("returns only status bar widget IDs", () => {
        const ids = getStatusBarWidgetIds();

        expect(ids.length).toBe(STATUS_BAR_MAX_WIDGETS);

        for (const id of ids) {
            expect(widgetRegistry[id].section).toBe("status-bar");
        }
    });
});

describe("widget integration requirements", () => {
    it("tautulli widgets require tautulli integration", () => {
        const tautulliWidgets = Object.values(widgetRegistry).filter(
            (w) => w.requiresIntegration === "tautulli"
        );

        expect(tautulliWidgets.length).toBeGreaterThan(0);

        // These specific widgets should require tautulli
        expect(widgetRegistry["analytics"].requiresIntegration).toBe("tautulli");
        expect(widgetRegistry["most-active-users"].requiresIntegration).toBe("tautulli");
        expect(widgetRegistry["graph-carousel"].requiresIntegration).toBe("tautulli");
    });

    it("seerr widget requires seerr integration", () => {
        expect(widgetRegistry["seerr-carousel"].requiresIntegration).toBe("seerr");
    });

    it("core widgets do not require integrations", () => {
        expect(widgetRegistry["plex-health"].requiresIntegration).toBeUndefined();
        expect(widgetRegistry["rotation-status"].requiresIntegration).toBeUndefined();
        expect(widgetRegistry["active-collections"].requiresIntegration).toBeUndefined();
    });
});
