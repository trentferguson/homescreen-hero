import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    normalizeIso,
    timeAgo,
    timeUntil,
    isDateInRange,
    isGroupCurrentlyActive,
    getGroupStatus,
} from "../dates";

describe("normalizeIso", () => {
    it("returns string as-is if it already has Z suffix", () => {
        expect(normalizeIso("2025-01-15T10:30:00Z")).toBe("2025-01-15T10:30:00Z");
    });

    it("returns string as-is if it has lowercase z suffix", () => {
        expect(normalizeIso("2025-01-15T10:30:00z")).toBe("2025-01-15T10:30:00z");
    });

    it("returns string as-is if it has timezone offset", () => {
        expect(normalizeIso("2025-01-15T10:30:00+05:30")).toBe("2025-01-15T10:30:00+05:30");
        expect(normalizeIso("2025-01-15T10:30:00-04:00")).toBe("2025-01-15T10:30:00-04:00");
    });

    it("appends Z when no timezone info present", () => {
        expect(normalizeIso("2025-01-15T10:30:00")).toBe("2025-01-15T10:30:00Z");
    });

    it("appends Z to date-only strings", () => {
        expect(normalizeIso("2025-01-15")).toBe("2025-01-15Z");
    });
});

describe("timeAgo", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns seconds ago for recent timestamps", () => {
        expect(timeAgo("2025-06-15T11:59:30Z")).toBe("30s ago");
    });

    it("returns 0s ago for current time", () => {
        expect(timeAgo("2025-06-15T12:00:00Z")).toBe("0s ago");
    });

    it("returns minutes ago", () => {
        expect(timeAgo("2025-06-15T11:45:00Z")).toBe("15m ago");
    });

    it("returns hours ago", () => {
        expect(timeAgo("2025-06-15T09:00:00Z")).toBe("3h ago");
    });

    it("returns days ago", () => {
        expect(timeAgo("2025-06-13T12:00:00Z")).toBe("2d ago");
    });

    it("returns the raw string for unparseable dates", () => {
        expect(timeAgo("not-a-date")).toBe("not-a-date");
    });

    it("tolerates small clock skew (up to 10s in future)", () => {
        expect(timeAgo("2025-06-15T12:00:05Z")).toBe("0s ago");
    });

    it("shows future time for timestamps more than 10s ahead", () => {
        expect(timeAgo("2025-06-15T12:00:30Z")).toBe("in 30s");
    });

    it("normalizes timestamps without timezone info", () => {
        // Should treat as UTC and calculate correctly
        expect(timeAgo("2025-06-15T11:59:30")).toBe("30s ago");
    });
});

describe("timeUntil", () => {
    const now = new Date("2025-06-15T12:00:00Z").getTime();

    it("returns seconds for short durations", () => {
        expect(timeUntil("2025-06-15T12:00:45Z", now)).toBe("45s");
    });

    it("returns minutes and seconds", () => {
        expect(timeUntil("2025-06-15T12:05:30Z", now)).toBe("5m 30s");
    });

    it("returns hours, minutes, and seconds", () => {
        expect(timeUntil("2025-06-15T14:30:15Z", now)).toBe("2h 30m 15s");
    });

    it("returns days, hours, minutes, seconds", () => {
        expect(timeUntil("2025-06-17T14:30:15Z", now)).toBe("2d 2h 30m 15s");
    });

    it("returns overdue for past timestamps", () => {
        expect(timeUntil("2025-06-15T11:00:00Z", now)).toBe("overdue");
    });

    it("returns 0s for exact current time", () => {
        expect(timeUntil("2025-06-15T12:00:00Z", now)).toBe("0s");
    });

    it("returns the raw string for unparseable dates", () => {
        expect(timeUntil("garbage", now)).toBe("garbage");
    });

    it("omits zero components", () => {
        // Exactly 2 hours from now - no minutes or seconds
        expect(timeUntil("2025-06-15T14:00:00Z", now)).toBe("2h");
    });
});

describe("isDateInRange", () => {
    it("returns true when dateRange is null", () => {
        expect(isDateInRange(null)).toBe(true);
    });

    it("returns true when dateRange is undefined", () => {
        expect(isDateInRange(undefined)).toBe(true);
    });

    it("returns true when start is empty", () => {
        expect(isDateInRange({ start: "", end: "12-31" })).toBe(true);
    });

    it("returns true when end is empty", () => {
        expect(isDateInRange({ start: "01-01", end: "" })).toBe(true);
    });

    it("returns true when today is within a normal range", () => {
        const today = new Date(2025, 5, 15); // June 15
        expect(isDateInRange({ start: "6-1", end: "6-30" }, today)).toBe(true);
    });

    it("returns false when today is outside a normal range", () => {
        const today = new Date(2025, 5, 15); // June 15
        expect(isDateInRange({ start: "7-1", end: "7-31" }, today)).toBe(false);
    });

    it("returns true on the start boundary", () => {
        const today = new Date(2025, 5, 1); // June 1
        expect(isDateInRange({ start: "6-1", end: "6-30" }, today)).toBe(true);
    });

    it("returns true on the end boundary", () => {
        const today = new Date(2025, 5, 30); // June 30
        expect(isDateInRange({ start: "6-1", end: "6-30" }, today)).toBe(true);
    });

    it("handles year-wrapping range (Dec to Jan)", () => {
        const december = new Date(2025, 11, 25); // Dec 25
        const january = new Date(2026, 0, 10); // Jan 10
        const march = new Date(2025, 2, 15); // Mar 15

        const range = { start: "12-20", end: "1-15" };
        expect(isDateInRange(range, december)).toBe(true);
        expect(isDateInRange(range, january)).toBe(true);
        expect(isDateInRange(range, march)).toBe(false);
    });

    it("returns true for invalid date format (fails gracefully)", () => {
        expect(isDateInRange({ start: "bad", end: "data" })).toBe(true);
    });

    it("returns true for out-of-bounds month/day", () => {
        expect(isDateInRange({ start: "13-1", end: "14-1" })).toBe(true);
    });
});

describe("isGroupCurrentlyActive", () => {
    const today = new Date(2025, 5, 15); // June 15

    it("returns false when group is disabled", () => {
        expect(isGroupCurrentlyActive({ enabled: false }, today)).toBe(false);
    });

    it("returns true when group is enabled with no date range", () => {
        expect(isGroupCurrentlyActive({ enabled: true }, today)).toBe(true);
    });

    it("returns true when group is enabled and within date range", () => {
        const group = { enabled: true, date_range: { start: "6-1", end: "6-30" } };
        expect(isGroupCurrentlyActive(group, today)).toBe(true);
    });

    it("returns false when group is enabled but outside date range", () => {
        const group = { enabled: true, date_range: { start: "7-1", end: "7-31" } };
        expect(isGroupCurrentlyActive(group, today)).toBe(false);
    });

    it("returns false when group is disabled even if in date range", () => {
        const group = { enabled: false, date_range: { start: "6-1", end: "6-30" } };
        expect(isGroupCurrentlyActive(group, today)).toBe(false);
    });
});

describe("getGroupStatus", () => {
    const today = new Date(2025, 5, 15); // June 15

    it("returns disabled when group is not enabled", () => {
        expect(getGroupStatus({ enabled: false }, today)).toBe("disabled");
    });

    it("returns active when group is enabled and in range", () => {
        const group = { enabled: true, date_range: { start: "6-1", end: "6-30" } };
        expect(getGroupStatus(group, today)).toBe("active");
    });

    it("returns scheduled when group is enabled but outside range", () => {
        const group = { enabled: true, date_range: { start: "7-1", end: "7-31" } };
        expect(getGroupStatus(group, today)).toBe("scheduled");
    });

    it("returns active when enabled with no date range", () => {
        expect(getGroupStatus({ enabled: true }, today)).toBe("active");
    });
});
