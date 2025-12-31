import type { ReactNode } from "react";

interface FieldRowProps {
    label: string;
    hint?: string;
    children: ReactNode;
    description?: string;
}

export default function FieldRow({ label, hint, description, children }: FieldRowProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-[280px,1fr] gap-3 md:gap-6 items-start">
            <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
                {description ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
                ) : null}
            </div>

            <div className="space-y-2">
                {children}
                {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
            </div>
        </div>
    );
}