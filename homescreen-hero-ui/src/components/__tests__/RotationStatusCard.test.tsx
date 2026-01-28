import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import RotationStatusCard from "../RotationStatusCard";

// Helper to capture navigation
function LocationDisplay() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderWithRouter(ui: React.ReactElement) {
    return render(
        <MemoryRouter>
            {ui}
            <LocationDisplay />
        </MemoryRouter>
    );
}

describe("RotationStatusCard", () => {
    const now = new Date("2025-06-15T12:00:00Z").getTime();

    it("shows loading state", () => {
        renderWithRouter(
            <RotationStatusCard enabled={false} nextRunTime={null} loading currentTime={now} />
        );
        expect(screen.getByText("Checking…")).toBeInTheDocument();
        expect(screen.getByText("Loading status")).toBeInTheDocument();
    });

    it("shows enabled state with countdown", () => {
        renderWithRouter(
            <RotationStatusCard
                enabled={true}
                nextRunTime="2025-06-15T14:30:00Z"
                currentTime={now}
            />
        );
        expect(screen.getByText("Enabled")).toBeInTheDocument();
        expect(screen.getByText("2h 30m 0s")).toBeInTheDocument();
    });

    it("shows disabled state", () => {
        renderWithRouter(
            <RotationStatusCard enabled={false} nextRunTime={null} currentTime={now} />
        );
        expect(screen.getByText("Disabled")).toBeInTheDocument();
        expect(screen.getByText("Auto-rotation is off")).toBeInTheDocument();
    });

    it("shows 'Not scheduled' when enabled but no next run time", () => {
        renderWithRouter(
            <RotationStatusCard enabled={true} nextRunTime={null} currentTime={now} />
        );
        expect(screen.getByText("Enabled")).toBeInTheDocument();
        expect(screen.getByText("Not scheduled")).toBeInTheDocument();
    });

    it("shows 'Any moment now' when next run is in the past", () => {
        renderWithRouter(
            <RotationStatusCard
                enabled={true}
                nextRunTime="2025-06-15T11:00:00Z"
                currentTime={now}
            />
        );
        expect(screen.getByText("Any moment now")).toBeInTheDocument();
    });

    it("navigates to settings on click", async () => {
        const user = userEvent.setup();
        renderWithRouter(
            <RotationStatusCard enabled={true} nextRunTime={null} currentTime={now} />
        );

        await user.click(screen.getByRole("button"));
        expect(screen.getByTestId("location")).toHaveTextContent("/settings?section=rotation");
    });

    it("navigates on Enter key", async () => {
        const user = userEvent.setup();
        renderWithRouter(
            <RotationStatusCard enabled={true} nextRunTime={null} currentTime={now} />
        );

        screen.getByRole("button").focus();
        await user.keyboard("{Enter}");
        expect(screen.getByTestId("location")).toHaveTextContent("/settings?section=rotation");
    });

    it("renders custom icon when provided", () => {
        renderWithRouter(
            <RotationStatusCard
                enabled={true}
                nextRunTime={null}
                currentTime={now}
                icon={<span data-testid="custom-icon">icon</span>}
            />
        );
        expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });
});
