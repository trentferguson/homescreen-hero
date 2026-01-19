import { useState } from "react";
import { Calendar, Wrench, History } from "lucide-react";
import ToolCard from "../components/tools/ToolCard";
import DateAddedEditor from "../components/tools/DateAddedEditor";
import WatchHistoryCleaner from "../components/tools/WatchHistoryCleaner";

type Tool = {
    id: string;
    title: string;
    description: string;
    icon: typeof Calendar;
};

const tools: Tool[] = [
    {
        id: "date-added-editor",
        title: "Date Added Editor",
        description: "Change when items appear as 'recently added' in Plex",
        icon: Calendar,
    },
    {
        id: "watch-history-cleaner",
        title: "Watch History Cleaner",
        description: "Mark TV shows as unwatched to rewatch them",
        icon: History,
    },
];

export default function ToolsPage() {
    const [activeTool, setActiveTool] = useState<string | null>(null);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-1.5">
                <h1 className="text-3xl font-black tracking-tight text-white">Tools</h1>
                <p className="text-slate-400 text-sm max-w-2xl">
                    Utilities to help manage your Plex library beyond collection rotation.
                </p>
            </div>

            {/* Tools Grid */}
            {tools.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {tools.map((tool, index) => (
                        <ToolCard
                            key={tool.id}
                            tool={tool}
                            onClick={() => setActiveTool(tool.id)}
                            index={index}
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/50 p-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                        <Wrench className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="mt-4 text-sm text-slate-300">No tools available yet.</p>
                </div>
            )}

            {/* Tool Modals */}
            {activeTool === "date-added-editor" && (
                <DateAddedEditor onClose={() => setActiveTool(null)} />
            )}
            {activeTool === "watch-history-cleaner" && (
                <WatchHistoryCleaner onClose={() => setActiveTool(null)} />
            )}
        </div>
    );
}
