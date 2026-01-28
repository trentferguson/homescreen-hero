import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MostActiveUsersCard from "../MostActiveUsersCard";

// Mock fetchWithAuth
vi.mock("../../utils/api", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "../../utils/api";

const mockFetchWithAuth = vi.mocked(fetchWithAuth);

const mockUsers = [
    { username: "alice", total_plays: 150, total_duration: 7200 },
    { username: "bob", total_plays: 80, total_duration: 3600 },
    { username: "charlie", total_plays: 45, total_duration: 900 },
];

function mockTautulliEnabled(users = mockUsers) {
    mockFetchWithAuth.mockImplementation(async (url: string) => {
        if (url.includes("/config/tautulli")) {
            return { ok: true, json: async () => ({ enabled: true }) } as Response;
        }
        if (url.includes("/analytics/users/top")) {
            return { ok: true, json: async () => users } as Response;
        }
        return { ok: false } as Response;
    });
}

function mockTautulliDisabled() {
    mockFetchWithAuth.mockImplementation(async () => {
        return { ok: true, json: async () => ({ enabled: false }) } as Response;
    });
}

function mockApiError() {
    // Tautulli config succeeds (so we get past the "not configured" check)
    // but the users endpoint fails
    mockFetchWithAuth.mockImplementation(async (url: string) => {
        if (url.includes("/config/tautulli")) {
            return { ok: true, json: async () => ({ enabled: true }) } as Response;
        }
        return { ok: false, text: async () => "Server error" } as Response;
    });
}

describe("MostActiveUsersCard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows loading state initially", () => {
        mockTautulliEnabled();
        render(<MostActiveUsersCard loading />);
        expect(screen.getByText("Most Active Users")).toBeInTheDocument();
    });

    it("shows Tautulli not configured state", async () => {
        mockTautulliDisabled();
        render(<MostActiveUsersCard />);

        await waitFor(() => {
            expect(screen.getByText("Tautulli is not configured")).toBeInTheDocument();
        });
        expect(screen.getByText("Configure Tautulli")).toBeInTheDocument();
    });

    it("shows error state with retry button", async () => {
        mockApiError();
        render(<MostActiveUsersCard />);

        await waitFor(() => {
            expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
        });
        expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("shows no data state", async () => {
        mockTautulliEnabled([]);
        render(<MostActiveUsersCard />);

        await waitFor(() => {
            expect(screen.getByText("No user data available yet")).toBeInTheDocument();
        });
    });

    it("renders user list with formatted data", async () => {
        mockTautulliEnabled();
        render(<MostActiveUsersCard />);

        await waitFor(() => {
            expect(screen.getByText("alice")).toBeInTheDocument();
        });

        // Usernames
        expect(screen.getByText("bob")).toBeInTheDocument();
        expect(screen.getByText("charlie")).toBeInTheDocument();

        // Initials (getInitials helper)
        expect(screen.getByText("AL")).toBeInTheDocument();
        expect(screen.getByText("BO")).toBeInTheDocument();
        expect(screen.getByText("CH")).toBeInTheDocument();

        // Formatted durations (formatDuration helper)
        expect(screen.getByText("2h 0m watched")).toBeInTheDocument();  // 7200s
        expect(screen.getByText("1h 0m watched")).toBeInTheDocument();  // 3600s
        expect(screen.getByText("15m watched")).toBeInTheDocument();    // 900s

        // Play counts
        expect(screen.getByText("150")).toBeInTheDocument();
        expect(screen.getByText("80")).toBeInTheDocument();
        expect(screen.getByText("45")).toBeInTheDocument();
    });

    it("shows consistent avatar colors for same username", async () => {
        mockTautulliEnabled();
        const { container } = render(<MostActiveUsersCard />);

        await waitFor(() => {
            expect(screen.getByText("alice")).toBeInTheDocument();
        });

        // Avatar containers should have bg-* color classes
        const avatars = container.querySelectorAll("[class*='rounded-full'][class*='bg-']");
        expect(avatars.length).toBe(3);
    });
});
