import { ArrowRight, type LucideIcon } from "lucide-react";

type Tool = {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
};

type ToolCardProps = {
    tool: Tool;
    onClick: () => void;
    index: number;
};

const cardGradients = [
    "from-indigo-500/10 via-slate-900/50 to-slate-900/50 hover:border-indigo-500/40",
    "from-blue-500/10 via-slate-900/50 to-slate-900/50 hover:border-blue-500/40",
    "from-purple-500/10 via-slate-900/50 to-slate-900/50 hover:border-purple-500/40",
    "from-cyan-500/10 via-slate-900/50 to-slate-900/50 hover:border-cyan-500/40",
    "from-amber-500/10 via-slate-900/50 to-slate-900/50 hover:border-amber-500/40",
    "from-emerald-500/10 via-slate-900/50 to-slate-900/50 hover:border-emerald-500/40",
];

const iconColors = [
    "bg-indigo-500/20 text-indigo-400",
    "bg-blue-500/20 text-blue-400",
    "bg-purple-500/20 text-purple-400",
    "bg-cyan-500/20 text-cyan-400",
    "bg-amber-500/20 text-amber-400",
    "bg-emerald-500/20 text-emerald-400",
];

export default function ToolCard({ tool, onClick, index }: ToolCardProps) {
    const Icon = tool.icon;
    const gradient = cardGradients[index % cardGradients.length];
    const iconColor = iconColors[index % iconColors.length];

    return (
        <button
            type="button"
            onClick={onClick}
            className={`group relative overflow-hidden rounded-2xl border border-slate-800/60 bg-gradient-to-br ${gradient} p-6 text-left shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-slide-up`}
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            {/* Icon */}
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${iconColor}`}>
                <Icon size={24} />
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-white mb-2">{tool.title}</h3>

            {/* Description */}
            <p className="text-sm text-slate-400 leading-relaxed">{tool.description}</p>

            {/* Hover indicator */}
            <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <ArrowRight className="h-5 w-5 text-primary" />
            </div>
        </button>
    );
}
