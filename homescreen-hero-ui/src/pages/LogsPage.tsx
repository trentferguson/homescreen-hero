import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { Copy, Pause, Play, RefreshCw, Search, Trash2 } from "lucide-react";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "ALL";

function guessLevel(line: string): Exclude<LogLevel, "ALL"> | null {
    const up = line.toUpperCase();
    if (up.includes(" ERROR ") || up.startsWith("ERROR") || up.includes("] ERROR")) return "ERROR";
    if (up.includes(" WARN ") || up.startsWith("WARN") || up.includes("] WARN")) return "WARN";
    if (up.includes(" INFO ") || up.startsWith("INFO") || up.includes("] INFO")) return "INFO";
    if (up.includes(" DEBUG ") || up.startsWith("DEBUG") || up.includes("] DEBUG")) return "DEBUG";
    return null;
}

function LevelBadge({ level }: { level: Exclude<LogLevel, "ALL"> | null }) {
    const cls =
        level === "ERROR"
            ? "bg-red-500/15 text-red-300 ring-red-500/20"
            : level === "WARN"
                ? "bg-amber-500/15 text-amber-300 ring-amber-500/20"
                : level === "INFO"
                    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20"
                    : level === "DEBUG"
                        ? "bg-sky-500/15 text-sky-300 ring-sky-500/20"
                        : "bg-slate-500/10 text-slate-300 ring-slate-500/20";

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
            {level ?? "LOG"}
        </span>
    );
}

function IconButton({
    label,
    onClick,
    disabled,
    children,
}: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-800 bg-white/5 hover:bg-white/10 text-slate-200 disabled:opacity-60 disabled:hover:bg-white/5 transition-colors"
        >
            {children}
        </button>
    );
}

export default function LogsPage() {
    const [lines, setLines] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [query, setQuery] = useState("");
    const [level, setLevel] = useState<LogLevel>("ALL");
    const [paused, setPaused] = useState(false);
    const [follow, setFollow] = useState(true);

    const scrollerRef = useRef<HTMLDivElement | null>(null);

    async function fetchLogs() {
        setLoading(true);
        setError(null);

        try {
            const res = await fetchWithAuth("/api/logs/tail"); // or "/logs" depending on your proxy
            const text = await res.text();

            if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

            // 1) If it looks like JSON, try JSON parsing
            const trimmed = text.trim();

            let nextLines: string[] = [];

            if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                try {
                    const json = JSON.parse(trimmed);

                    // Supports:
                    // - ["line1", "line2"]
                    // - { "lines": [...] }
                    // - { "text": "...\n..." }
                    if (Array.isArray(json)) {
                        nextLines = json.map(String);
                    } else if (Array.isArray(json.lines)) {
                        nextLines = json.lines.map(String);
                    } else if (typeof json.text === "string") {
                        nextLines = json.text.split(/\r?\n/);
                    } else {
                        // fallback: stringify object
                        nextLines = [JSON.stringify(json, null, 2)];
                    }
                } catch {
                    // If JSON.parse fails, fall through and treat as raw text
                    nextLines = trimmed.split(/\r?\n/);
                }
            } else {
                // 2) Plain text logs
                nextLines = trimmed.length ? trimmed.split(/\r?\n/).filter(Boolean) : [];
            }

            // 3) NDJSON fallback: if lines look like JSON objects, keep as strings (or parse if you want)
            setLines(nextLines);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load logs");
        } finally {
            setLoading(false);
        }
    }


    // initial load + polling
    useEffect(() => {
        fetchLogs();
    }, []);

    useEffect(() => {
        if (paused) return;
        const id = window.setInterval(fetchLogs, 2000);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paused]);

    // auto-follow
    useEffect(() => {
        if (!follow) return;
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [lines, follow]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return lines.filter((line) => {
            const lvl = guessLevel(line);
            if (level !== "ALL" && lvl !== level) return false;
            if (q && !line.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [lines, query, level]);

    const counts = useMemo(() => {
        let errorN = 0,
            warnN = 0,
            infoN = 0,
            debugN = 0;
        for (const l of lines) {
            const lvl = guessLevel(l);
            if (lvl === "ERROR") errorN++;
            else if (lvl === "WARN") warnN++;
            else if (lvl === "INFO") infoN++;
            else if (lvl === "DEBUG") debugN++;
        }
        return { errorN, warnN, infoN, debugN };
    }, [lines]);

    function copyVisible() {
        const text = filtered.join("\n");
        navigator.clipboard.writeText(text);
    }

    function clearLocal() {
        setLines([]);
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-white text-2xl font-bold">Logs</h1>
                    <p className="text-slate-400 text-sm">
                        {lines.length} lines • {counts.errorN} errors • {counts.warnN} warnings
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <IconButton label="Refresh" onClick={fetchLogs} disabled={loading}>
                        <RefreshCw size={18} />
                        Refresh
                    </IconButton>

                    <IconButton
                        label={paused ? "Resume polling" : "Pause polling"}
                        onClick={() => setPaused((p) => !p)}
                    >
                        {paused ? <Play size={18} /> : <Pause size={18} />}
                        {paused ? "Resume" : "Pause"}
                    </IconButton>

                    <IconButton label="Copy visible" onClick={copyVisible} disabled={filtered.length === 0}>
                        <Copy size={18} />
                        Copy
                    </IconButton>

                    <IconButton label="Clear (local)" onClick={clearLocal} disabled={lines.length === 0}>
                        <Trash2 size={18} />
                        Clear
                    </IconButton>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search logs…"
                        className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                <div className="flex gap-3 items-center">
                    <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value as LogLevel)}
                        className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="ALL">All levels</option>
                        <option value="ERROR">Error</option>
                        <option value="WARN">Warn</option>
                        <option value="INFO">Info</option>
                        <option value="DEBUG">Debug</option>
                    </select>

                    <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
                        <input
                            type="checkbox"
                            checked={follow}
                            onChange={(e) => setFollow(e.target.checked)}
                            className="accent-emerald-500"
                        />
                        Follow
                    </label>
                </div>
            </div>

            {/* Viewer */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <div className="text-slate-200 font-semibold text-sm">Log stream</div>
                    <div className="text-slate-400 text-xs">
                        Showing {filtered.length} / {lines.length}
                    </div>
                </div>

                {error ? (
                    <div className="p-4 text-amber-300 text-sm whitespace-pre-wrap">{error}</div>
                ) : (
                    <div
                        ref={scrollerRef}
                        className="max-h-[70vh] overflow-auto font-mono text-[12px] leading-relaxed"
                    >
                        {loading && lines.length === 0 ? (
                            <div className="p-4 text-slate-400">Loading logs…</div>
                        ) : filtered.length === 0 ? (
                            <div className="p-4 text-slate-400">No matching log lines.</div>
                        ) : (
                            filtered.map((line, idx) => {
                                const lvl = guessLevel(line);
                                return (
                                    <div
                                        key={`${idx}-${line.slice(0, 16)}`}
                                        className="grid grid-cols-[52px_90px_1fr] gap-3 px-4 py-2 border-b border-slate-900/60 hover:bg-white/[0.03]"
                                    >
                                        <div className="text-slate-600 text-right tabular-nums">{idx + 1}</div>
                                        <div>
                                            <LevelBadge level={lvl} />
                                        </div>
                                        <div className="text-slate-200 whitespace-pre-wrap break-words">{line}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
