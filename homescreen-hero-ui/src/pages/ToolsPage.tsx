import { useState } from "react";
import { Calendar, Wrench } from "lucide-react";
import ToolCard from "../components/tools/ToolCard";
import DateAddedEditor from "../components/tools/DateAddedEditor";

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
];

export default function ToolsPage() {
    const [activeTool, setActiveTool] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Utilities</p>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tight text-white">Tools</h1>
                        <p className="text-slate-400 text-sm max-w-2xl">
                            Utilities to help manage your Plex library beyond collection rotation.
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                        <span className="text-xs uppercase tracking-wide text-slate-500">Available</span>
                        <div className="flex items-center gap-3 text-sm text-slate-200">
                            <span className="rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2">
                                {tools.length} {tools.length === 1 ? "tool" : "tools"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tools Grid */}
            <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5 p-6 space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-white">Available Tools</h3>
                        <p className="text-sm text-slate-400">Click a tool to open it.</p>
                    </div>
                </div>

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
                    <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/50 p-6 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-900">
                            <Wrench className="h-4 w-4 text-slate-400" />
                        </div>
                        <p className="mt-3 text-sm text-slate-300">No tools available yet.</p>
                    </div>
                )}
            </section>

            {/* Tool Modals */}
            {activeTool === "date-added-editor" && (
                <DateAddedEditor onClose={() => setActiveTool(null)} />
            )}
        </div>
    );
}
