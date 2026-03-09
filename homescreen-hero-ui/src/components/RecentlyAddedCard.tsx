import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Film } from "lucide-react";
import { fetchWithAuth } from "../utils/api";
import { timeAgo } from "../utils/dates";

type RecentlyAddedItem = {
    title: string;
    year: number | null;
    added_at: string | null;
    thumb: string | null;
    media_type: string;
    rating_key: string;
    library: string;
};

const AUTO_SCROLL_INTERVAL = 6000;

export default function RecentlyAddedCard({ loading }: { loading?: boolean }) {
    const [items, setItems] = useState<RecentlyAddedItem[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [prevIndex, setPrevIndex] = useState<number | null>(null);
    // "idle" = static, "ready" = both images mounted but no transition yet, "animating" = transition running
    const [animPhase, setAnimPhase] = useState<"idle" | "ready" | "animating">("idle");
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setDataLoading(true);
        setError(null);
        try {
            const response = await fetchWithAuth("/api/collections/recently-added?limit=10");
            if (!response.ok) throw new Error("Failed to load recently added");
            const data = await response.json();
            setItems(data.items || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setDataLoading(false);
        }
    };

    const goTo = useCallback(
        (index: number) => {
            if (items.length === 0 || index === currentIndex) return;
            setPrevIndex(currentIndex);
            setCurrentIndex(index);
            // Mount both images first, then trigger animation on next frame
            setAnimPhase("ready");
        },
        [items.length, currentIndex],
    );

    // When "ready", trigger the actual transition on the next frame so the browser
    // has painted the incoming image at its initial (hidden) state first
    useEffect(() => {
        if (animPhase === "ready") {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setAnimPhase("animating");
                });
            });
        }
        if (animPhase === "animating") {
            const timeout = setTimeout(() => {
                setPrevIndex(null);
                setAnimPhase("idle");
            }, 1200);
            return () => clearTimeout(timeout);
        }
    }, [animPhase]);

    const goNext = useCallback(() => {
        if (items.length === 0) return;
        goTo((currentIndex + 1) % items.length);
    }, [currentIndex, items.length, goTo]);

    const goPrev = useCallback(() => {
        if (items.length === 0) return;
        goTo((currentIndex - 1 + items.length) % items.length);
    }, [currentIndex, items.length, goTo]);

    // Auto-scroll
    useEffect(() => {
        if (items.length <= 1) return;
        timerRef.current = setInterval(goNext, AUTO_SCROLL_INTERVAL);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [items.length, goNext]);

    // Reset timer on manual navigation
    const resetTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (items.length > 1) {
            timerRef.current = setInterval(goNext, AUTO_SCROLL_INTERVAL);
        }
    }, [items.length, goNext]);

    const handlePrev = () => {
        goPrev();
        resetTimer();
    };

    const handleNext = () => {
        goNext();
        resetTimer();
    };

    const handleDotClick = (index: number) => {
        if (index === currentIndex) return;
        goTo(index);
        resetTimer();
    };

    // Skeleton / loading
    if (loading || dataLoading) {
        return (
            <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 transition-all duration-300 overflow-hidden h-[420px] flex flex-col">
                <div className="flex-1 bg-slate-800/50 animate-pulse" />
                <div className="p-3 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-slate-800 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-slate-800 animate-pulse" />
                </div>
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 p-5 transition-all duration-300 h-[420px] flex flex-col items-center justify-center">
                <Film className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-sm text-red-400 mb-3 text-center">{error}</p>
                <button
                    onClick={loadData}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Empty
    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-500/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-slate-500/5 p-5 transition-all duration-300 h-[420px] flex flex-col items-center justify-center">
                <Film className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-sm text-slate-400">No recently added items</p>
            </div>
        );
    }

    const current = items[currentIndex];

    return (
        <div className="group rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 transition-all duration-300 overflow-hidden h-[420px] flex flex-col relative">
            {/* Poster area */}
            <div className="flex-1 relative overflow-hidden bg-slate-900">
                {/* Outgoing image - zooms up and fades out */}
                {prevIndex !== null && items[prevIndex]?.thumb && (
                    <img
                        key={`prev-${items[prevIndex].rating_key}`}
                        src={items[prevIndex].thumb}
                        alt={items[prevIndex].title}
                        className={`absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] ease-out ${
                            animPhase === "animating"
                                ? "opacity-0 scale-110"
                                : "opacity-100 scale-100"
                        }`}
                    />
                )}

                {/* Current image - fades in from slight scale-down */}
                {current.thumb ? (
                    <img
                        key={current.rating_key}
                        src={current.thumb}
                        alt={current.title}
                        className={`absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] ease-out ${
                            animPhase === "ready"
                                ? "opacity-0 scale-95"
                                : "opacity-100 scale-100"
                        }`}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                        <Film className="w-12 h-12 text-slate-600" />
                    </div>
                )}

                {/* Navigation arrows - visible on hover */}
                {items.length > 1 && (
                    <>
                        <button
                            onClick={handlePrev}
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleNext}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </>
                )}
            </div>

            {/* Info overlay at bottom */}
            <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent absolute bottom-0 left-0 right-0 p-3 pt-8">
                <p className="text-sm font-semibold text-white truncate" title={current.title}>
                    {current.title}
                    {current.year && <span className="text-white/50 font-normal ml-1">({current.year})</span>}
                </p>
                <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-white/50">
                        {current.added_at ? timeAgo(current.added_at) : current.library}
                    </p>
                    {/* Dot indicators */}
                    {items.length > 1 && (
                        <div className="flex items-center gap-1">
                            {items.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleDotClick(i)}
                                    className={`rounded-full transition-all duration-200 ${
                                        i === currentIndex
                                            ? "bg-primary w-3 h-1.5"
                                            : "bg-white/30 hover:bg-white/50 w-1.5 h-1.5"
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
