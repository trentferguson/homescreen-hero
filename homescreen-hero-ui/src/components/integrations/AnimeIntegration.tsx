import { useState } from "react";
import { ChevronRight, Tv } from "lucide-react";
import { AniListIntegration } from "./AniListIntegration";

export function AnimeIntegration() {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 overflow-hidden shadow-lg shadow-primary/5">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
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
                            isExpanded ? "rotate-90" : ""
                        }`}
                    />
                </button>

                <div
                    className={`grid transition-all duration-300 ease-in-out ${
                        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
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
        </div>
    );
}
