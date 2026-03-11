import { useState, useRef, useEffect } from "react";
import { Info, Plus, ChevronDown, Lock } from "lucide-react";

interface HiddenWidget {
    id: string;
    name: string;
    description: string;
    available: boolean;
    requiresIntegration?: string;
}

interface EditModeBannerProps {
    hiddenWidgets?: HiddenWidget[];
    onAddWidget?: (widgetId: string) => void;
}

const integrationLabels: Record<string, string> = {
    tautulli: "Tautulli",
    seerr: "Overseerr",
};

export function EditModeBanner({ hiddenWidgets = [], onAddWidget }: EditModeBannerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Sort: available first, then unavailable
    const sortedWidgets = [...hiddenWidgets].sort((a, b) => {
        if (a.available === b.available) return 0;
        return a.available ? -1 : 1;
    });

    return (
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-sm text-amber-400">
            <div className="flex items-center gap-2">
                <Info size={16} className="flex-shrink-0" />
                <span>Drag widgets to reorder. Click the lock icon when done.</span>
            </div>

            {sortedWidgets.length > 0 && (
                <div className="relative">
                    <button
                        ref={buttonRef}
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-medium transition-colors"
                    >
                        <Plus size={14} />
                        <span>Add Widget</span>
                        <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isOpen && (
                        <div
                            ref={dropdownRef}
                            className="absolute right-0 top-full mt-2 w-72 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-50 overflow-hidden"
                        >
                            <div className="px-3 py-2 border-b border-slate-700">
                                <p className="text-xs font-medium text-slate-400">Hidden Widgets</p>
                            </div>
                            <div className="max-h-64 overflow-y-auto scrollbar-thin">
                                {sortedWidgets.map((widget) => (
                                    <button
                                        key={widget.id}
                                        onClick={() => widget.available && onAddWidget?.(widget.id)}
                                        disabled={!widget.available}
                                        className={`w-full px-3 py-2.5 text-left border-b border-slate-700/50 last:border-b-0 transition-colors ${
                                            widget.available
                                                ? "hover:bg-slate-700/50 cursor-pointer"
                                                : "opacity-50 cursor-not-allowed"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-slate-200">{widget.name}</p>
                                            {!widget.available && (
                                                <Lock size={12} className="flex-shrink-0 text-slate-500" />
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {widget.available
                                                ? widget.description
                                                : `Requires ${integrationLabels[widget.requiresIntegration ?? ""] ?? widget.requiresIntegration}`
                                            }
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
