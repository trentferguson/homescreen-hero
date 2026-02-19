import { useState, useEffect, type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface CollapsibleFormSectionProps {
    title: string;
    description?: string;
    children: ReactNode;
    actions?: ReactNode;
    icon?: LucideIcon;
    defaultExpanded?: boolean;
    expanded?: boolean; // controlled mode
}

export default function CollapsibleFormSection({
    title,
    description,
    children,
    actions,
    icon: Icon,
    defaultExpanded = false,
    expanded,
}: CollapsibleFormSectionProps) {
    const [isExpanded, setIsExpanded] = useState(expanded ?? defaultExpanded);

    // Sync with controlled prop when it changes
    useEffect(() => {
        if (expanded !== undefined) {
            setIsExpanded(expanded);
        }
    }, [expanded]);

    return (
        <section className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition"
            >
                <div className="text-left flex items-start gap-3">
                    {Icon && (
                        <div className="rounded-lg bg-primary/10 p-2 border border-primary/20 mt-0.5">
                            <Icon className="h-5 w-5 text-primary" />
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
                        {description && (
                            <p className="text-xs text-slate-400 mt-1">{description}</p>
                        )}
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
                <div className={isExpanded ? "overflow-visible" : "overflow-hidden"}>
                    <div className="px-6 pb-6 space-y-4 border-t border-slate-800">
                        {actions && (
                            <div className="flex justify-end pt-4">
                                {actions}
                            </div>
                        )}
                        <div className={actions ? "" : "pt-4"}>{children}</div>
                    </div>
                </div>
            </div>
        </section>
    );
}
