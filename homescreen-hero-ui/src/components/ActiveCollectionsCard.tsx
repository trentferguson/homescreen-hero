import { useNavigate } from "react-router-dom";

export type ActiveCollection = {
    title: string;
    poster_url?: string | null;
    library?: string | null;
};

export default function ActiveCollectionsCard({
    collections,
    loading,
}: {
    collections: ActiveCollection[];
    loading?: boolean;
}) {
    const navigate = useNavigate();

    const handleCollectionClick = (collection: ActiveCollection) => {
        if (collection.library) {
            navigate(
                `/collections/${encodeURIComponent(collection.library)}/${encodeURIComponent(collection.title)}`
            );
        }
    };
    return (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md p-5 dark:bg-card-dark dark:border-slate-800/80 dark:hover:border-slate-700 transition-all duration-300">
            <div className="flex items-end justify-between mb-5">
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Active Collections</h3>
                        {!loading && collections.length > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-primary/10 text-primary border border-primary/20">
                                {collections.length}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        Currently featured on your Plex home screen
                    </p>
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
            ) : collections.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-400 py-4">No active collections yet.</div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hover-only">
                    {collections.map((c, index) => (
                        <button
                            key={c.title}
                            onClick={() => handleCollectionClick(c)}
                            disabled={!c.library}
                            className="w-28 sm:w-32 shrink-0 animate-fade-in text-left disabled:cursor-default"
                            style={{
                                animationDelay: `${index * 0.1}s`,
                            }}
                        >
                            <div className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 shadow-md hover:shadow-xl transition-all duration-300 ring-1 ring-slate-700/50 hover:ring-slate-600 cursor-pointer">
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