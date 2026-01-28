import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithAuth } from "../api";

describe("fetchWithAuth", () => {
    const originalLocation = window.location;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockFetch = vi.fn();
        global.fetch = mockFetch;
        localStorage.clear();

        // Mock window.location since jsdom doesn't support navigation
        Object.defineProperty(window, "location", {
            writable: true,
            value: { ...originalLocation, href: "" },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(window, "location", {
            writable: true,
            value: originalLocation,
        });
    });

    it("makes a fetch request to the given URL", async () => {
        mockFetch.mockResolvedValue({ status: 200 });

        await fetchWithAuth("/api/test");

        expect(mockFetch).toHaveBeenCalledWith("/api/test", expect.objectContaining({
            headers: expect.any(Object),
        }));
    });

    it("adds Authorization header when token exists in localStorage", async () => {
        localStorage.setItem("auth_token", "my-jwt-token");
        mockFetch.mockResolvedValue({ status: 200 });

        await fetchWithAuth("/api/test");

        expect(mockFetch).toHaveBeenCalledWith("/api/test", expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: "Bearer my-jwt-token",
            }),
        }));
    });

    it("does not add Authorization header when no token exists", async () => {
        mockFetch.mockResolvedValue({ status: 200 });

        await fetchWithAuth("/api/test");

        const calledHeaders = mockFetch.mock.calls[0][1].headers;
        expect(calledHeaders).not.toHaveProperty("Authorization");
    });

    it("passes through custom options", async () => {
        mockFetch.mockResolvedValue({ status: 200 });

        await fetchWithAuth("/api/test", {
            method: "POST",
            body: JSON.stringify({ data: true }),
        });

        expect(mockFetch).toHaveBeenCalledWith("/api/test", expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ data: true }),
        }));
    });

    it("merges custom headers with auth header", async () => {
        localStorage.setItem("auth_token", "my-token");
        mockFetch.mockResolvedValue({ status: 200 });

        await fetchWithAuth("/api/test", {
            headers: { "Content-Type": "application/json" },
        });

        const calledHeaders = mockFetch.mock.calls[0][1].headers;
        expect(calledHeaders).toEqual({
            "Content-Type": "application/json",
            Authorization: "Bearer my-token",
        });
    });

    it("clears auth and redirects to login on 401 response", async () => {
        localStorage.setItem("auth_token", "expired-token");
        localStorage.setItem("username", "testuser");
        mockFetch.mockResolvedValue({ status: 401 });

        await fetchWithAuth("/api/test");

        expect(localStorage.getItem("auth_token")).toBeNull();
        expect(localStorage.getItem("username")).toBeNull();
        expect(window.location.href).toBe("/login");
    });

    it("does not redirect on non-401 errors", async () => {
        localStorage.setItem("auth_token", "valid-token");
        mockFetch.mockResolvedValue({ status: 500 });

        await fetchWithAuth("/api/test");

        expect(localStorage.getItem("auth_token")).toBe("valid-token");
        expect(window.location.href).not.toBe("/login");
    });

    it("returns the response object", async () => {
        const mockResponse = { status: 200, ok: true };
        mockFetch.mockResolvedValue(mockResponse);

        const result = await fetchWithAuth("/api/test");

        expect(result).toBe(mockResponse);
    });
});
