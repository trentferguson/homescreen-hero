import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePlexLibraries } from "../usePlexLibraries";

vi.mock("../../../utils/api", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "../../../utils/api";

const mockFetchWithAuth = vi.mocked(fetchWithAuth);

const mockPlexSettings = {
    base_url: "http://localhost:32400",
    token: "abc123",
    libraries: [
        { name: "Movies", enabled: true },
        { name: "TV Shows", enabled: true },
        { name: "Music", enabled: false },
        { name: "Photos", enabled: false },
    ],
};

describe("usePlexLibraries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("starts in loading state with empty defaults", () => {
        mockFetchWithAuth.mockResolvedValue({
            ok: true,
            json: async () => mockPlexSettings,
        } as Response);

        const { result } = renderHook(() => usePlexLibraries());

        expect(result.current.loading).toBe(true);
        expect(result.current.plexSettings.base_url).toBe("");
        expect(result.current.plexSettings.libraries).toEqual([]);
    });

    it("loads plex settings from API", async () => {
        mockFetchWithAuth.mockResolvedValue({
            ok: true,
            json: async () => mockPlexSettings,
        } as Response);

        const { result } = renderHook(() => usePlexLibraries());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.plexSettings.base_url).toBe("http://localhost:32400");
        expect(result.current.plexSettings.token).toBe("abc123");
        expect(result.current.plexSettings.libraries).toHaveLength(4);
    });

    it("filters to only enabled libraries", async () => {
        mockFetchWithAuth.mockResolvedValue({
            ok: true,
            json: async () => mockPlexSettings,
        } as Response);

        const { result } = renderHook(() => usePlexLibraries());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.enabledLibraries).toHaveLength(2);
        expect(result.current.enabledLibraries.map((l) => l.name)).toEqual(["Movies", "TV Shows"]);
    });

    it("handles API error gracefully", async () => {
        mockFetchWithAuth.mockResolvedValue({
            ok: false,
            text: async () => "Unauthorized",
        } as Response);

        const { result } = renderHook(() => usePlexLibraries());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Should have default empty settings (silently fails)
        expect(result.current.plexSettings.base_url).toBe("");
        expect(result.current.enabledLibraries).toHaveLength(0);
    });

    it("handles network error gracefully", async () => {
        mockFetchWithAuth.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => usePlexLibraries());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.plexSettings.libraries).toEqual([]);
    });

    it("calls the correct API endpoint", async () => {
        mockFetchWithAuth.mockResolvedValue({
            ok: true,
            json: async () => mockPlexSettings,
        } as Response);

        renderHook(() => usePlexLibraries());

        expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/admin/config/plex");
    });
});
