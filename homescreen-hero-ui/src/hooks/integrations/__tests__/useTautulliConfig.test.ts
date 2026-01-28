import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useTautulliConfig } from "../useTautulliConfig";

vi.mock("../../../utils/api", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "../../../utils/api";

const mockFetchWithAuth = vi.mocked(fetchWithAuth);

const mockSettings = {
    enabled: true,
    api_key: "test-key-123",
    base_url: "http://localhost:8181",
    collect_on_rotation: true,
    collect_interval_hours: 24,
};

describe("useTautulliConfig", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("loading settings", () => {
        it("starts in loading state with defaults", () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            expect(result.current.loading).toBe(true);
            expect(result.current.settings.enabled).toBe(false);
            expect(result.current.settings.base_url).toBe("http://localhost:8181");
        });

        it("loads settings from API", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.settings.enabled).toBe(true);
            expect(result.current.settings.api_key).toBe("test-key-123");
            expect(result.current.settings.collect_on_rotation).toBe(true);
            expect(result.current.settings.collect_interval_hours).toBe(24);
        });

        it("applies defaults for missing fields", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => ({ enabled: true, api_key: "key" }),
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.settings.base_url).toBe("http://localhost:8181");
            expect(result.current.settings.collect_on_rotation).toBe(true);
            expect(result.current.settings.collect_interval_hours).toBe(24);
        });

        it("sets error on API failure", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                text: async () => "Unauthorized",
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.error).toBeTruthy();
        });
    });

    describe("saveSettings", () => {
        it("posts settings to API", async () => {
            // Initial load
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Mock the save response
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => ({ ok: true, path: "/config", message: "Saved!", env_override: false }),
            } as Response);

            await act(async () => {
                await result.current.saveSettings();
            });

            expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/admin/config/tautulli", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: expect.any(String),
            });
            expect(result.current.message).toBe("Saved!");
            expect(result.current.saving).toBe(false);
        });

        it("sets error on save failure", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                text: async () => "Validation error",
            } as Response);

            await act(async () => {
                await result.current.saveSettings();
            });

            expect(result.current.error).toBeTruthy();
            expect(result.current.saving).toBe(false);
        });
    });

    describe("testConnection", () => {
        it("transitions through testing -> success on healthy response", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => ({ ok: true }),
            } as Response);

            await act(async () => {
                await result.current.testConnection();
            });

            expect(result.current.testStatus).toBe("success");
            expect(result.current.error).toBeNull();
        });

        it("sets error status when health check returns ok: false", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => ({ ok: false, error: "Connection refused" }),
            } as Response);

            await act(async () => {
                await result.current.testConnection();
            });

            expect(result.current.testStatus).toBe("error");
            expect(result.current.error).toBe("Connection refused");
        });

        it("handles network error during test", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchWithAuth.mockRejectedValue(new Error("Network error"));

            await act(async () => {
                await result.current.testConnection();
            });

            expect(result.current.testStatus).toBe("error");
            expect(result.current.error).toBeTruthy();
        });
    });

    describe("clearMessages", () => {
        it("clears error and message", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                text: async () => "Error",
            } as Response);

            const { result } = renderHook(() => useTautulliConfig());

            await waitFor(() => {
                expect(result.current.error).toBeTruthy();
            });

            act(() => {
                result.current.clearMessages();
            });

            expect(result.current.error).toBeNull();
            expect(result.current.message).toBeNull();
        });
    });
});
