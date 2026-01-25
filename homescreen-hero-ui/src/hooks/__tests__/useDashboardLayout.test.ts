import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboardLayout } from "../useDashboardLayout";

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("useDashboardLayout", () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe("initial state", () => {
        it("loads default config when localStorage is empty", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            // Default status bar widgets should be visible
            expect(result.current.visibilityMap["plex-health"]).toBe(true);
            expect(result.current.visibilityMap["rotation-status"]).toBe(true);
            expect(result.current.visibilityMap["active-collections"]).toBe(true);
        });

        it("starts with edit mode disabled", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            expect(result.current.isEditMode).toBe(false);
        });
    });

    describe("toggleEditMode", () => {
        it("toggles edit mode on and off", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            expect(result.current.isEditMode).toBe(false);

            act(() => {
                result.current.toggleEditMode();
            });
            expect(result.current.isEditMode).toBe(true);

            act(() => {
                result.current.toggleEditMode();
            });
            expect(result.current.isEditMode).toBe(false);
        });
    });

    describe("toggleVisibility", () => {
        it("hides a visible widget", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            expect(result.current.visibilityMap["plex-health"]).toBe(true);

            act(() => {
                result.current.toggleVisibility("plex-health");
            });

            expect(result.current.visibilityMap["plex-health"]).toBe(false);
        });

        it("shows a hidden widget", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: true, seerr: false })
            );

            // Analytics is hidden by default
            expect(result.current.visibilityMap["analytics"]).toBe(false);

            act(() => {
                result.current.toggleVisibility("analytics");
            });

            expect(result.current.visibilityMap["analytics"]).toBe(true);
        });

        it("ignores invalid widget IDs", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            const beforeMap = { ...result.current.visibilityMap };

            act(() => {
                result.current.toggleVisibility("non-existent-widget");
            });

            expect(result.current.visibilityMap).toEqual(beforeMap);
        });
    });

    describe("isWidgetAvailable", () => {
        it("returns true for widgets without integration requirements", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            expect(result.current.isWidgetAvailable("plex-health")).toBe(true);
            expect(result.current.isWidgetAvailable("rotation-status")).toBe(true);
            expect(result.current.isWidgetAvailable("active-collections")).toBe(true);
        });

        it("returns false for tautulli widgets when tautulli is disabled", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            expect(result.current.isWidgetAvailable("analytics")).toBe(false);
            expect(result.current.isWidgetAvailable("most-active-users")).toBe(false);
            expect(result.current.isWidgetAvailable("graph-carousel")).toBe(false);
        });

        it("returns true for tautulli widgets when tautulli is enabled", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: true, seerr: false })
            );

            expect(result.current.isWidgetAvailable("analytics")).toBe(true);
            expect(result.current.isWidgetAvailable("most-active-users")).toBe(true);
            expect(result.current.isWidgetAvailable("graph-carousel")).toBe(true);
        });

        it("returns false for seerr widget when seerr is disabled", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            expect(result.current.isWidgetAvailable("seerr-carousel")).toBe(false);
        });

        it("returns true for seerr widget when seerr is enabled", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: true })
            );

            expect(result.current.isWidgetAvailable("seerr-carousel")).toBe(true);
        });

        it("returns false for non-existent widgets", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            expect(result.current.isWidgetAvailable("fake-widget")).toBe(false);
        });
    });

    describe("visibleStatusBarWidgets and visibleMainWidgets", () => {
        it("filters out unavailable widgets", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            // Tautulli widgets should not appear in visible lists
            expect(result.current.visibleMainWidgets).not.toContain("analytics");
            expect(result.current.visibleMainWidgets).not.toContain("most-active-users");
            expect(result.current.visibleMainWidgets).not.toContain("seerr-carousel");
        });

        it("includes available widgets when integration is enabled", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: true, seerr: true })
            );

            // Enable the widgets first (they're hidden by default)
            act(() => {
                result.current.toggleVisibility("analytics");
                result.current.toggleVisibility("seerr-carousel");
            });

            expect(result.current.visibleMainWidgets).toContain("analytics");
            expect(result.current.visibleMainWidgets).toContain("seerr-carousel");
        });
    });

    describe("resetToDefaults", () => {
        it("restores default visibility settings", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            // Hide a default-visible widget
            act(() => {
                result.current.toggleVisibility("plex-health");
            });
            expect(result.current.visibilityMap["plex-health"]).toBe(false);

            // Reset
            act(() => {
                result.current.resetToDefaults();
            });

            expect(result.current.visibilityMap["plex-health"]).toBe(true);
        });

        it("disables edit mode on reset", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            act(() => {
                result.current.toggleEditMode();
            });
            expect(result.current.isEditMode).toBe(true);

            act(() => {
                result.current.resetToDefaults();
            });

            expect(result.current.isEditMode).toBe(false);
        });
    });

    describe("persistence", () => {
        it("saves config to localStorage on changes", () => {
            const { result } = renderHook(() =>
                useDashboardLayout({ tautulli: false, seerr: false })
            );

            act(() => {
                result.current.toggleVisibility("plex-health");
            });

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                "dashboard.layout",
                expect.any(String)
            );
        });
    });
});
