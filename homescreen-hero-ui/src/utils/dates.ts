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