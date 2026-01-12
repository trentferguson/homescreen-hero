import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export type ActiveCollection = {
    title: string;
    poster_url?: string | null;
    library?: string | null;
    promoted_to_own_home?: boolean;
    promoted_to_shared?: boolean;
    promoted_to_recommended?: boolean;
};

export default function ActiveCollectionsCard({
    collections,
    loading,
}: {
    collections: ActiveCollection[];
    loading?: boolean;
}) {
    const navigate = useNavigate();
    const [visibilityFilter, setVisibilityFilter] = useState<"all" | "my_home" | "shared" | "recommended">("all");

    const filteredCollections = useMemo(() => {
        if (visibilityFilter === "all") {
            return collections;
        } else if (visibilityFilter === "my_home") {
            return collections.filter(c => c.promoted_to_own_home);
        } else if (visibilityFilter === "shared") {
            return collections.filter(c => c.promoted_to_shared);
        } else if (visibilityFilter === "recommended") {
            return collections.filter(c => c.promoted_to_recommended);
        }
        return collections;
    }, [collections, visibilityFilter]);

    const handleCollectionClick = (collection: ActiveCollection) => {
        if (collection.library) {
            navigate(
                `/collections/${encodeURIComponent(collection.library)}/${encodeURIComponent(collection.title)}`
            );
        }
    };
    return (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md px-5 py-4 dark:bg-card-dark dark:border-slate-800/80 dark:hover:border-slate-700 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Active Collections</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        Currently featured on your Plex home screen
                    </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setVisibilityFilter("all")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        visibilityFilter === "all"
                            ? "bg-primary text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                    }`}
                >
                    All {!loading && collections.length > 0 && `(${collections.length})`}
                </button>
                <button
                    type="button"
                    onClick={() => setVisibilityFilter("my_home")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        visibilityFilter === "my_home"
                            ? "bg-primary text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                    }`}
                >
                    My Home {!loading && `(${collections.filter(c => c.promoted_to_own_home).length})`}
                </button>
                <button
                    type="button"
                    onClick={() => setVisibilityFilter("shared")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        visibilityFilter === "shared"
                            ? "bg-primary text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                    }`}
                >
                    Shared Users {!loading && `(${collections.filter(c => c.promoted_to_shared).length})`}
                </button>
                <button
                    type="button"
                    onClick={() => setVisibilityFilter("recommended")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        visibilityFilter === "recommended"
                            ? "bg-primary text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                    }`}
                >
                    Recommended {!loading && `(${collections.filter(c => c.promoted_to_recommended).length})`}
                </button>
                </div>
            </div>

            {loading ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="w-28 sm:w-32 shrink-0">
                            <div className="aspect-[2/3] rounded-xl bg-slate-200 animate-pulse dark:bg-slate-800/60" />
                            <div className="h-3 mt-2 rounded bg-slate-200 animate-pulse dark:bg-slate-800/60" />
                        </div>
                    ))}
                </div>
            ) : filteredCollections.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-400 py-4">
                    No active collections {visibilityFilter !== "all" ? "in this category" : "yet"}.
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto px-2 py-2 -mx-2 -my-2 scrollbar-hover-only">
                    {filteredCollections.map((c, index) => (
                        <button
                            key={c.title}
                            onClick={() => handleCollectionClick(c)}
                            disabled={!c.library}
                            className="w-28 sm:w-32 shrink-0 animate-fade-in text-left disabled:cursor-default"
                            style={{
                                animationDelay: `${index * 0.1}s`,
                            }}
                        >
                            <div className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 shadow-md hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 ring-1 ring-slate-700/50 hover:ring-slate-600 cursor-pointer">
                                <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                                    style={{
                                        backgroundImage: c.poster_url
                                            ? `url('${c.poster_url}')`
                                            : "none",
                                    }}
                                />
                                {!c.poster_url && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-medium">
                                        No Poster
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-70 group-hover:opacity-50 transition-opacity duration-300" />
                            </div>

                            <div className="mt-2.5">
                                <div className="text-sm font-semibold truncate text-slate-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors">
                                    {c.title}
                                </div>

                                {c.library && (
                                    <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 font-medium">
                                        {c.library}
                                    </span>
                                )}
                            </div>

                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}