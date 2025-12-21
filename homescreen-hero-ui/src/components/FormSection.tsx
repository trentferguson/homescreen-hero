import type { ReactNode } from "react";

interface FormSectionProps {
    title: string;
    description?: string;
    children: ReactNode;
    actions?: ReactNode;
}

export default function FormSection({ title, description, children, actions }: FormSectionProps) {
    return (
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-card-dark shadow-sm p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                    {description ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                    ) : null}
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>

            <div className="space-y-4">{children}</div>
        </section>
    );
}