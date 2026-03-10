import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tab } from "@headlessui/react";
import { TraktIntegration } from "../components/integrations/TraktIntegration";
import { LetterboxdIntegration } from "../components/integrations/LetterboxdIntegration";
import { MDBListIntegration } from "../components/integrations/MDBListIntegration";
import { AniListIntegration } from "../components/integrations/AniListIntegration";
import { MALIntegration } from "../components/integrations/MALIntegration";
import { TMDbIntegration } from "../components/integrations/TMDbIntegration";

const tabs = [
    { name: "Trakt", key: "trakt", component: TraktIntegration },
    { name: "Letterboxd", key: "letterboxd", component: LetterboxdIntegration },
    { name: "MDBList", key: "mdblist", component: MDBListIntegration },
    { name: "TMDb", key: "tmdb", component: TMDbIntegration },
    { name: "AniList", key: "anilist", component: AniListIntegration },
    { name: "MyAnimeList", key: "mal", component: MALIntegration },
] as const;

export default function ListsPage() {
    const location = useLocation();
    const navigate = useNavigate();

    const selectedIndex = useMemo(() => {
        const hash = location.hash.replace("#", "").toLowerCase();
        const idx = tabs.findIndex((t) => t.key === hash);
        return idx >= 0 ? idx : 0;
    }, [location.hash]);

    const handleTabChange = useCallback(
        (index: number) => {
            navigate(`#${tabs[index].key}`, { replace: true });
        },
        [navigate]
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Lists
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Manage third-party list sources for automated syncing and content discovery.
                </p>
            </div>

            <Tab.Group selectedIndex={selectedIndex} onChange={handleTabChange}>
                <Tab.List className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800">
                    {tabs.map((tab) => (
                        <Tab
                            key={tab.name}
                            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none data-[selected]:bg-primary data-[selected]:text-white data-[selected]:border-primary border-slate-800/60 bg-slate-900/60 text-slate-200 hover:border-slate-700"
                        >
                            {tab.name}
                        </Tab>
                    ))}
                </Tab.List>

                <Tab.Panels>
                    {tabs.map((tab) => (
                        <Tab.Panel key={tab.name} className="space-y-4 focus:outline-none">
                            {tab.key === "letterboxd" && (
                                <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-3">
                                    <p className="text-xs text-slate-300">
                                        <strong>Note:</strong> Letterboxd integration uses web scraping since their
                                        API requires approval. Movies are matched by title and year, which may be
                                        less accurate than ID-based matching.
                                    </p>
                                </div>
                            )}
                            {(tab.key === "anilist" || tab.key === "mal") && (
                                <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-3">
                                    <p className="text-xs text-slate-300">
                                        <strong>Note:</strong> Anime sources are matched to Plex using the{" "}
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
                            )}
                            {tab.component ? (
                                <tab.component />
                            ) : (
                                <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6">
                                    <p className="text-sm text-slate-400">
                                        {tab.name} integration coming soon...
                                    </p>
                                </div>
                            )}
                        </Tab.Panel>
                    ))}
                </Tab.Panels>
            </Tab.Group>
        </div>
    );
}
