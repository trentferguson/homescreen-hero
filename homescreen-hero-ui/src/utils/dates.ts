export function normalizeIso(iso: string) {
    // If there is no timezone info, assume UTC by appending 'Z'
    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(iso)) return iso;
    return iso + "Z";
}

export function timeAgo(iso: string) {
    const t = Date.parse(normalizeIso(iso));

    if (Number.isNaN(t)) return iso;

    let sec = Math.floor((Date.now() - t) / 1000);

    // If the timestamp is slightly in the future, treat it as "just now"
    if (sec < 0) {
        if (sec > -10) sec = 0; // tolerate small clock skew
        else return `in ${Math.abs(sec)}s`;
    }

    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
}

export function timeUntil(iso: string, now: number = Date.now()) {
    const t = Date.parse(normalizeIso(iso));

    if (Number.isNaN(t)) return iso;

    let sec = Math.floor((t - now) / 1000);

    // If in the past, return "overdue"
    if (sec < 0) return "overdue";

    const days = Math.floor(sec / 86400);
    sec %= 86400;
    const hours = Math.floor(sec / 3600);
    sec %= 3600;
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(" ");
}

type DateRange = {
    start: string;
    end: string;
};

// Parse MM-DD format string into [month, day] tuple
function parseMonthDay(mmdd: string): [number, number] | null {
    const match = mmdd.match(/^(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return [month, day];
}

// Check if today's date falls within a date range (handles year-wrapping)
export function isDateInRange(dateRange: DateRange | null | undefined, today: Date = new Date()): boolean {
    if (!dateRange?.start || !dateRange?.end) return true;

    const startParsed = parseMonthDay(dateRange.start);
    const endParsed = parseMonthDay(dateRange.end);
    if (!startParsed || !endParsed) return true;

    const todayTuple: [number, number] = [today.getMonth() + 1, today.getDate()];
    const [startM, startD] = startParsed;
    const [endM, endD] = endParsed;

    const startTuple: [number, number] = [startM, startD];
    const endTuple: [number, number] = [endM, endD];

    const compareTuples = (a: [number, number], b: [number, number]) => {
        if (a[0] !== b[0]) return a[0] - b[0];
        return a[1] - b[1];
    };

    if (compareTuples(startTuple, endTuple) <= 0) {
        // Normal range (e.g., 11-20 to 12-26)
        return compareTuples(startTuple, todayTuple) <= 0 && compareTuples(todayTuple, endTuple) <= 0;
    } else {
        // Year-wrapping range (e.g., 12-20 to 01-15)
        return compareTuples(todayTuple, startTuple) >= 0 || compareTuples(todayTuple, endTuple) <= 0;
    }
}

type GroupLike = {
    enabled: boolean;
    date_range?: DateRange | null;
};

// Determine if a group is currently active (enabled AND within date range)
// Matches backend logic in rotation.py _group_is_active()
export function isGroupCurrentlyActive(group: GroupLike, today: Date = new Date()): boolean {
    if (!group.enabled) return false;
    return isDateInRange(group.date_range, today);
}

// Get the display status for a group
export type GroupStatus = "active" | "scheduled" | "disabled";

export function getGroupStatus(group: GroupLike, today: Date = new Date()): GroupStatus {
    if (!group.enabled) return "disabled";
    if (!isDateInRange(group.date_range, today)) return "scheduled";
    return "active";
}