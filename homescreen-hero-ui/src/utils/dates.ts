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