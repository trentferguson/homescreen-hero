import { useState } from "react";
import { ChevronRight, Tv } from "lucide-react";
import { AniListIntegration } from "./AniListIntegration";
import { MALIntegration } from "./MALIntegration";

export function AnimeIntegration() {
    const [anilistExpanded, setAnilistExpanded] = useState(true);
    const [malExpanded, setMalExpanded] = useState(false);

    return (
        <div className="space-y-4">
            {/* Shared note */}
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-3">
                <p className="text-xs text-slate-300">
                    All anime sources are matched to Plex using the{" "}
                    <a
                        href="https://github.com/Fribb/anime-lists"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-slate-100"
                    >
                        anime-lists
                    </a>{" "}
                    ID mapping database, with a fallback to title/year matching. Point your
                    sources at a show library for anime series, or a movie library for anime films.
                </p>
            </div>

            {/* AniList */}
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 overflow-hidden shadow-lg shadow-primary/5">
                <button
                    type="button"
                    onClick={() => setAnilistExpanded(!anilistExpanded)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition"
                >
                    <div className="text-left flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 border border-primary/20 mt-0.5">
                            <Tv className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">AniList</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Sync your AniList anime lists to Plex collections.
                            </p>
                        </div>
                    </div>
                    <ChevronRight
                        className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${
                            anilistExpanded ? "rotate-90" : ""
                        }`}
                    />
                </button>

                <div
                    className={`grid transition-all duration-300 ease-in-out ${
                        anilistExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                >
                    <div className="overflow-hidden">
                        <div className="px-6 pb-6 space-y-4 border-t border-slate-800">
                            <div className="pt-4">
                                <AniListIntegration />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAL */}
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 overflow-hidden shadow-lg shadow-primary/5">
                <button
                    type="button"
                    onClick={() => setMalExpanded(!malExpanded)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition"
                >
                    <div className="text-left flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 border border-primary/20 mt-0.5">
                            <Tv className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">MyAnimeList</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Sync your MAL anime lists, rankings, and seasonal charts to Plex collections.
                            </p>
                        </div>
                    </div>
                    <ChevronRight
                        className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${
                            malExpanded ? "rotate-90" : ""
                        }`}
                    />
                </button>

                <div
                    className={`grid transition-all duration-300 ease-in-out ${
                        malExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                >
                    <div className="overflow-hidden">
                        <div className="px-6 pb-6 space-y-4 border-t border-slate-800">
                            <div className="pt-4">
                                <MALIntegration />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
