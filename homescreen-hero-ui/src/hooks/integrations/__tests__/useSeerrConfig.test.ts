import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSeerrConfig } from "../useSeerrConfig";

vi.mock("../../../utils/api", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "../../../utils/api";

const mockFetchWithAuth = vi.mocked(fetchWithAuth);

const mockSettings = {
    enabled: true,
    api_key: "seerr-key-456",
    base_url: "http://localhost:5055",
};

describe("useSeerrConfig", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("loading settings", () => {
        it("starts in loading state with defaults", () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

            expect(result.current.loading).toBe(true);
            expect(result.current.settings.enabled).toBe(false);
            expect(result.current.settings.base_url).toBe("http://localhost:5055");
        });

        it("loads settings from API", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.settings.enabled).toBe(true);
            expect(result.current.settings.api_key).toBe("seerr-key-456");
            expect(result.current.settings.base_url).toBe("http://localhost:5055");
        });

        it("applies defaults for missing fields", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => ({ enabled: true, api_key: "key" }),
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.settings.base_url).toBe("http://localhost:5055");
        });

        it("sets error on API failure", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                text: async () => "Unauthorized",
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.error).toBeTruthy();
        });

        it("handles null response data", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => null,
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Should keep defaults
            expect(result.current.settings.enabled).toBe(false);
        });
    });

    describe("saveSettings", () => {
        it("posts settings to API and sets success message", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => ({ ok: true, path: "/config", message: "Settings saved", env_override: false }),
            } as Response);

            await act(async () => {
                await result.current.saveSettings();
            });

            expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/admin/config/seerr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: expect.any(String),
            });
            expect(result.current.message).toBe("Settings saved");
            expect(result.current.saving).toBe(false);
        });

        it("sets error on save failure", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                text: async () => "Bad request",
            } as Response);

            await act(async () => {
                await result.current.saveSettings();
            });

            expect(result.current.error).toBeTruthy();
            expect(result.current.saving).toBe(false);
        });
    });

    describe("testConnection", () => {
        it("sets success status on healthy response", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

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

        it("sets error status when health check fails", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => ({ ok: false, error: "Cannot reach Seerr" }),
            } as Response);

            await act(async () => {
                await result.current.testConnection();
            });

            expect(result.current.testStatus).toBe("error");
            expect(result.current.error).toBe("Cannot reach Seerr");
        });

        it("uses default error message when none provided", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => mockSettings,
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchWithAuth.mockResolvedValue({
                ok: true,
                json: async () => ({ ok: false }),
            } as Response);

            await act(async () => {
                await result.current.testConnection();
            });

            expect(result.current.error).toBe("Seerr API health check failed.");
        });
    });

    describe("clearMessages", () => {
        it("clears error and message", async () => {
            mockFetchWithAuth.mockResolvedValue({
                ok: false,
                text: async () => "Error",
            } as Response);

            const { result } = renderHook(() => useSeerrConfig());

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
