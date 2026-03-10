import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HealthCard from "../HealthCard";
import { ThemeProvider } from "../../utils/theme";

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("HealthCard", () => {
    it("renders the title", () => {
        renderWithTheme(<HealthCard title="Plex Server" />);
        expect(screen.getByText("Plex Server")).toBeInTheDocument();
    });

    it("shows loading state", () => {
        renderWithTheme(<HealthCard title="Plex Server" loading />);
        expect(screen.getByText("Checking…")).toBeInTheDocument();
        expect(screen.getByText("Running health check")).toBeInTheDocument();
    });

    it("shows healthy state with default subtitle", () => {
        renderWithTheme(<HealthCard title="Plex Server" ok={true} />);
        expect(screen.getByText("Online")).toBeInTheDocument();
        expect(screen.getByText("All good")).toBeInTheDocument();
    });

    it("shows unhealthy state with default subtitle", () => {
        renderWithTheme(<HealthCard title="Plex Server" ok={false} />);
        expect(screen.getByText("Needs attention")).toBeInTheDocument();
        expect(screen.getByText("Check details")).toBeInTheDocument();
    });

    it("uses custom subtitles when provided", () => {
        renderWithTheme(
            <HealthCard
                title="Plex Server"
                ok={true}
                subtitleOk="Connected"
                subtitleBad="Disconnected"
            />
        );
        expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("uses custom bad subtitle when unhealthy", () => {
        renderWithTheme(
            <HealthCard
                title="Plex Server"
                ok={false}
                subtitleOk="Connected"
                subtitleBad="Disconnected"
            />
        );
        expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });

    it("shows detail text when provided", () => {
        renderWithTheme(<HealthCard title="Plex Server" ok={true} detail="v1.32.0" />);
        expect(screen.getByText("v1.32.0")).toBeInTheDocument();
    });

    it("renders custom icon when provided", () => {
        renderWithTheme(
            <HealthCard
                title="Plex Server"
                ok={true}
                icon={<span data-testid="custom-icon">icon</span>}
            />
        );
        expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });
});
