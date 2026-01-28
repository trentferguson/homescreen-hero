import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecentRotationsCard from "../RecentRotationsCard";

const mockItems = [
    {
        id: 1,
        created_at: "2025-06-15T12:00:00Z",
        success: true,
        summary: "Rotated 5 collections",
        error_message: null,
        featured_collections: ["Action", "Comedy"],
    },
    {
        id: 2,
        created_at: "2025-06-15T11:00:00Z",
        success: false,
        summary: "Rotation failed",
        error_message: "Connection refused",
        featured_collections: [],
    },
    {
        id: 3,
        created_at: "2025-06-15T10:00:00Z",
        success: true,
        summary: "Rotated 3 collections",
        error_message: null,
        featured_collections: ["Horror", "Sci-Fi", "Drama"],
    },
];

const mockLastRun = {
    created_at: "2025-06-15T12:00:00Z",
    success: true,
    duration: 5.2,
};

// Stub time formatter so tests don't depend on real time
const stubTimeAgo = () => "5m ago";

describe("RecentRotationsCard", () => {
    it("renders the card title", () => {
        render(
            <RecentRotationsCard
                items={[]}
                lastRun={null}
                formatTimeAgo={stubTimeAgo}
            />
        );
        expect(screen.getByText("Recent Rotations")).toBeInTheDocument();
    });

    it("shows loading skeleton when loading", () => {
        const { container } = render(
            <RecentRotationsCard
                items={[]}
                lastRun={null}
                loading
                formatTimeAgo={stubTimeAgo}
            />
        );
        const skeletons = container.querySelectorAll(".animate-pulse");
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it("shows empty state when no items", () => {
        render(
            <RecentRotationsCard
                items={[]}
                lastRun={null}
                formatTimeAgo={stubTimeAgo}
            />
        );
        expect(screen.getByText("No rotation history available yet.")).toBeInTheDocument();
    });

    it("renders rotation events", () => {
        render(
            <RecentRotationsCard
                items={mockItems}
                lastRun={mockLastRun}
                formatTimeAgo={stubTimeAgo}
            />
        );
        expect(screen.getByText("Rotated 5 collections")).toBeInTheDocument();
        expect(screen.getByText("Rotation failed")).toBeInTheDocument();
        expect(screen.getByText("Rotated 3 collections")).toBeInTheDocument();
    });

    it("shows error messages for failed rotations", () => {
        render(
            <RecentRotationsCard
                items={mockItems}
                lastRun={mockLastRun}
                formatTimeAgo={stubTimeAgo}
            />
        );
        expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });

    it("shows last run status pill", () => {
        render(
            <RecentRotationsCard
                items={mockItems}
                lastRun={mockLastRun}
                formatTimeAgo={stubTimeAgo}
            />
        );
        // The last run section shows a Success pill
        expect(screen.getAllByText("Success").length).toBeGreaterThan(0);
    });

    it("respects the limit prop", () => {
        render(
            <RecentRotationsCard
                items={mockItems}
                lastRun={mockLastRun}
                limit={2}
                formatTimeAgo={stubTimeAgo}
            />
        );
        expect(screen.getByText("Rotated 5 collections")).toBeInTheDocument();
        expect(screen.getByText("Rotation failed")).toBeInTheDocument();
        expect(screen.queryByText("Rotated 3 collections")).not.toBeInTheDocument();
    });

    it("opens detail modal when clicking a rotation event", async () => {
        const user = userEvent.setup();
        render(
            <RecentRotationsCard
                items={mockItems}
                lastRun={mockLastRun}
                formatTimeAgo={stubTimeAgo}
            />
        );

        await user.click(screen.getByText("Rotated 5 collections"));
        expect(screen.getByText("Rotation Details")).toBeInTheDocument();
        expect(screen.getByText("Featured Collections (2)")).toBeInTheDocument();
        expect(screen.getByText("Action")).toBeInTheDocument();
        expect(screen.getByText("Comedy")).toBeInTheDocument();
    });

    it("closes detail modal when clicking close button", async () => {
        const user = userEvent.setup();
        render(
            <RecentRotationsCard
                items={mockItems}
                lastRun={mockLastRun}
                formatTimeAgo={stubTimeAgo}
            />
        );

        await user.click(screen.getByText("Rotated 5 collections"));
        expect(screen.getByText("Rotation Details")).toBeInTheDocument();

        await user.click(screen.getByLabelText("Close rotation details"));
        expect(screen.queryByText("Rotation Details")).not.toBeInTheDocument();
    });

    it("shows error message in detail modal for failed rotations", async () => {
        const user = userEvent.setup();
        render(
            <RecentRotationsCard
                items={mockItems}
                lastRun={mockLastRun}
                formatTimeAgo={stubTimeAgo}
            />
        );

        await user.click(screen.getByText("Rotation failed"));
        expect(screen.getByText("Error Message")).toBeInTheDocument();
        // The error message appears both in the list and the modal
        expect(screen.getAllByText("Connection refused").length).toBeGreaterThanOrEqual(1);
    });

    it("shows 'No collections featured' when rotation has empty collections", async () => {
        const user = userEvent.setup();
        render(
            <RecentRotationsCard
                items={mockItems}
                lastRun={mockLastRun}
                formatTimeAgo={stubTimeAgo}
            />
        );

        await user.click(screen.getByText("Rotation failed"));
        expect(screen.getByText("No collections featured")).toBeInTheDocument();
    });

    it("uses the injectable formatTimeAgo function", () => {
        const customFormatter = () => "just now";
        render(
            <RecentRotationsCard
                items={mockItems}
                lastRun={mockLastRun}
                formatTimeAgo={customFormatter}
            />
        );
        // Should find "just now" in the rendered output (from lastRun and items)
        expect(screen.getAllByText(/just now/).length).toBeGreaterThan(0);
    });
});
